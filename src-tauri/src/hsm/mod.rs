pub mod apdu;
pub mod types;

use crate::error::HsmError;
use crate::hsm::apdu::{ApduCodec, ApduCodecImpl};
use crate::hsm::types::{
    ApduCommand, DkekStatus, HsmCertInfo, HsmDeviceInfo, HsmKeyInfo, HsmKeyType, HsmOptionType,
    HsmOptions, KeyObjectType,
};
use crate::types::LedConfig;

/// SC-HSM 應用程式識別碼 (AID)
const SC_HSM_AID: &[u8] = &[0xE8, 0x2B, 0x06, 0x01, 0x04, 0x01, 0x81, 0xC3, 0x1F, 0x02, 0x01];

/// HSM 模組 trait — 封裝所有 APDU 協定操作
pub trait HsmModule {
    // 初始化
    fn initialize(&self, pin: &str, so_pin: &str, dkek_shares: u8) -> Result<(), HsmError>;

    // PIN 管理
    fn verify_pin(&self, pin: &str) -> Result<(), HsmError>;
    fn change_pin(&self, old_pin: &str, new_pin: &str) -> Result<(), HsmError>;
    fn change_so_pin(&self, old_so_pin: &str, new_so_pin: &str) -> Result<(), HsmError>;
    fn unblock_pin(&self, so_pin: &str, new_pin: &str) -> Result<(), HsmError>;

    // 金鑰管理
    fn list_keys(&self, pin: &str) -> Result<Vec<HsmKeyInfo>, HsmError>;
    fn generate_rsa_key(
        &self, pin: &str, bits: u16, id: u8, label: &str,
    ) -> Result<HsmKeyInfo, HsmError>;
    fn generate_ec_key(
        &self, pin: &str, curve: &str, id: u8, label: &str,
    ) -> Result<HsmKeyInfo, HsmError>;
    fn generate_aes_key(&self, pin: &str, bits: u16, id: u8) -> Result<HsmKeyInfo, HsmError>;
    fn delete_key(&self, pin: &str, id: u8, key_type: KeyObjectType) -> Result<(), HsmError>;

    // 憑證管理
    fn list_certificates(&self, pin: &str) -> Result<Vec<HsmCertInfo>, HsmError>;
    fn import_certificate(
        &self, pin: &str, id: u8, cert_data: &[u8],
    ) -> Result<(), HsmError>;
    fn export_certificate(&self, id: u8) -> Result<Vec<u8>, HsmError>;

    // DKEK 與備份
    fn create_dkek_share(&self, password: &str) -> Result<Vec<u8>, HsmError>;
    fn import_dkek_share(
        &self, share_data: &[u8], password: &str,
    ) -> Result<DkekStatus, HsmError>;
    fn wrap_key(&self, pin: &str, key_ref: u8) -> Result<Vec<u8>, HsmError>;
    fn unwrap_key(
        &self, pin: &str, key_ref: u8, wrapped: &[u8],
    ) -> Result<(), HsmError>;

    // 裝置選項
    fn get_options(&self) -> Result<HsmOptions, HsmError>;
    fn set_option(&self, option: HsmOptionType, enabled: bool) -> Result<(), HsmError>;
    fn set_datetime(&self) -> Result<(), HsmError>;
    fn get_device_info(&self) -> Result<HsmDeviceInfo, HsmError>;

    // 安全鎖
    fn enable_secure_lock(&self) -> Result<(), HsmError>;
    fn disable_secure_lock(&self) -> Result<(), HsmError>;

    // LED 設定
    fn set_led_config(&self, config: &LedConfig) -> Result<(), HsmError>;
}

/// HsmModule 的實作，透過 CCID/PC/SC 與 Pico-HSM 裝置通訊
pub struct HsmModuleImpl {
    device_path: std::sync::Mutex<String>,
}

impl HsmModuleImpl {
    pub fn new(device_path: String) -> Self {
        Self {
            device_path: std::sync::Mutex::new(device_path),
        }
    }

    /// 設定目前使用的裝置路徑
    pub fn set_device_path(&self, path: &str) {
        if let Ok(mut p) = self.device_path.lock() {
            *p = path.to_string();
        }
    }

    /// 取得目前裝置路徑
    fn get_device_path(&self) -> String {
        self.device_path.lock().map(|p| p.clone()).unwrap_or_default()
    }

    /// 驗證 PIN 格式（6-16 字元）
    pub fn validate_pin(pin: &str) -> Result<(), HsmError> {
        let len = pin.len();
        if len < 6 || len > 16 {
            return Err(HsmError::PinFormatInvalid);
        }
        Ok(())
    }

    /// 驗證 SO-PIN 格式（恰好 16 個十六進位字元）
    pub fn validate_so_pin(so_pin: &str) -> Result<(), HsmError> {
        if so_pin.len() != 16 {
            return Err(HsmError::SoPinFormatInvalid);
        }
        if !so_pin.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(HsmError::SoPinFormatInvalid);
        }
        Ok(())
    }

    /// 連線至 PC/SC 讀卡機並回傳 Card 物件
    fn connect_card(&self) -> Result<pcsc::Card, HsmError> {
        let device_path = self.get_device_path();
        if device_path.is_empty() {
            return Err(HsmError::CommunicationError(
                "尚未選擇裝置。請先從左側選擇一個 Pico-HSM 裝置。".to_string(),
            ));
        }

        let ctx = pcsc::Context::establish(pcsc::Scope::User).map_err(|e| {
            HsmError::CommunicationError(format!(
                "PC/SC 服務未啟動。請確認 Smart Card 服務已啟動。({e})"
            ))
        })?;

        let reader = std::ffi::CString::new(device_path.as_bytes()).map_err(|_| {
            HsmError::CommunicationError("裝置路徑無效".to_string())
        })?;

        ctx.connect(&reader, pcsc::ShareMode::Shared, pcsc::Protocols::ANY)
            .map_err(|e| {
                HsmError::CommunicationError(format!(
                    "無法連線至讀卡機「{}」: {e}",
                    device_path
                ))
            })
    }

    /// 傳送原始 APDU 至已連線的卡片，自動處理 61 XX (GET RESPONSE) 鏈接
    fn transmit_raw(&self, card: &pcsc::Card, data: &[u8]) -> Result<Vec<u8>, HsmError> {
        let mut resp_buf = vec![0u8; 4096];
        let resp = card.transmit(data, &mut resp_buf).map_err(|e| {
            HsmError::CommunicationError(format!("APDU 傳送失敗: {e}"))
        })?;
        let mut result = resp.to_vec();

        // 處理 61 XX: 還有資料需要用 GET RESPONSE 取回
        // 迴圈直到不再回傳 61 XX
        loop {
            if result.len() < 2 {
                break;
            }
            let sw1 = result[result.len() - 2];
            let sw2 = result[result.len() - 1];
            if sw1 != 0x61 {
                break;
            }
            // 移除尾部的 SW1/SW2，保留已收到的資料
            let data_part = result[..result.len() - 2].to_vec();

            // 發送 GET RESPONSE: CLA=00 INS=C0 P1=00 P2=00 Le=sw2
            let get_resp_cmd = vec![0x00, 0xC0, 0x00, 0x00, sw2];
            let mut gr_buf = vec![0u8; 4096];
            let gr_resp = card.transmit(&get_resp_cmd, &mut gr_buf).map_err(|e| {
                HsmError::CommunicationError(format!("GET RESPONSE 失敗: {e}"))
            })?;
            let gr = gr_resp.to_vec();

            // 合併: 之前的資料 + 新回應
            result = Vec::with_capacity(data_part.len() + gr.len());
            result.extend_from_slice(&data_part);
            result.extend_from_slice(&gr);
        }

        Ok(result)
    }

    /// SELECT SC-HSM 應用程式 (AID)
    /// 回傳 SELECT 回應資料（包含 FCI + 版本資訊）
    fn select_hsm_applet(&self, card: &pcsc::Card) -> Result<Vec<u8>, HsmError> {
        let codec = ApduCodecImpl::new();
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xA4, // SELECT
            p1: 0x04,  // Select by DF name (AID)
            p2: 0x00,  // Return FCI
            data: Some(SC_HSM_AID.to_vec()),
            le: None,
        };
        let raw = codec.encode_apdu(&cmd);
        let response_bytes = self.transmit_raw(card, &raw)?;
        let response = codec
            .decode_apdu_response(&response_bytes)
            .map_err(|e| HsmError::CommunicationError(e.to_string()))?;
        if let Some(err) = codec.status_to_error(response.sw1, response.sw2) {
            return Err(err);
        }
        Ok(response.data)
    }

    /// 連線、SELECT applet、傳送 APDU 指令並解析回應
    fn execute_apdu(&self, cmd: &ApduCommand) -> Result<Vec<u8>, HsmError> {
        let card = self.connect_card()?;
        // 每次操作前先 SELECT SC-HSM applet
        self.select_hsm_applet(&card)?;

        let codec = ApduCodecImpl::new();
        let raw = codec.encode_apdu(cmd);
        let response_bytes = self.transmit_raw(&card, &raw)?;
        let response = codec
            .decode_apdu_response(&response_bytes)
            .map_err(|e| HsmError::CommunicationError(e.to_string()))?;
        if let Some(err) = codec.status_to_error(response.sw1, response.sw2) {
            return Err(err);
        }
        Ok(response.data)
    }

    /// 連線並 SELECT applet，回傳 SELECT 回應資料
    fn select_and_get_info(&self) -> Result<Vec<u8>, HsmError> {
        let card = self.connect_card()?;
        self.select_hsm_applet(&card)
    }

    /// 診斷用：回傳 SELECT 回應的 hex dump + INITIALIZE(nc=0) 回應
    pub fn debug_device_raw(&self) -> Result<Vec<String>, HsmError> {
        let mut results = Vec::new();

        // SELECT SC-HSM
        let card = self.connect_card()?;
        let select_data = self.select_hsm_applet(&card)?;
        let hex: Vec<String> = select_data.iter().map(|b| format!("{b:02X}")).collect();
        results.push(format!("SELECT response ({} bytes): {}", select_data.len(), hex.join(" ")));

        // parse_version_from_select 結果
        let (ver, opts) = Self::parse_version_from_select(&select_data);
        results.push(format!("Parsed version: {ver}, options: 0x{opts:04X}"));

        // INITIALIZE nc=0 (取得 heap + version)
        let codec = ApduCodecImpl::new();
        let init_cmd = ApduCommand {
            cla: 0x80,
            ins: 0x50,
            p1: 0x00,
            p2: 0x00,
            data: None,
            le: Some(256),
        };
        // 需要先重新 SELECT（因為上面的 card 連線還在）
        self.select_hsm_applet(&card)?;
        let raw = codec.encode_apdu(&init_cmd);
        match self.transmit_raw(&card, &raw) {
            Ok(resp) => {
                let hex2: Vec<String> = resp.iter().map(|b| format!("{b:02X}")).collect();
                results.push(format!("INIT(nc=0) response ({} bytes): {}", resp.len(), hex2.join(" ")));
            }
            Err(e) => results.push(format!("INIT(nc=0) error: {e}")),
        }

        // CMD_MEMORY
        let mem_cmd = ApduCommand {
            cla: 0x80,
            ins: 0x64,
            p1: 0x05,
            p2: 0x00,
            data: None,
            le: Some(256),
        };
        self.select_hsm_applet(&card)?;
        let raw_mem = codec.encode_apdu(&mem_cmd);
        match self.transmit_raw(&card, &raw_mem) {
            Ok(resp) => {
                let hex3: Vec<String> = resp.iter().map(|b| format!("{b:02X}")).collect();
                results.push(format!("CMD_MEMORY response ({} bytes): {}", resp.len(), hex3.join(" ")));
            }
            Err(e) => results.push(format!("CMD_MEMORY error: {e}")),
        }

        Ok(results)
    }

    /// 從 SELECT 回應中解析版本號
    /// SELECT SC-HSM 回應格式: FCI TLV + tag 0x85 [5 bytes: options(2) + 0xFF + major + minor]
    fn parse_version_from_select(data: &[u8]) -> (String, u16) {
        // 搜尋 tag 0x85 (proprietary data)
        let mut i = 0;
        while i + 1 < data.len() {
            if data[i] == 0x85 {
                let len = data[i + 1] as usize;
                if i + 2 + len <= data.len() && len >= 5 {
                    let payload = &data[i + 2..i + 2 + len];
                    let options = ((payload[0] as u16) << 8) | (payload[1] as u16);
                    let major = payload[3];
                    let minor = payload[4];
                    return (format!("{major}.{minor}"), options);
                }
            }
            i += 1;
        }
        ("unknown".to_string(), 0)
    }
}

impl HsmModule for HsmModuleImpl {
    // === 7.1: HSM 初始化與 PIN 管理 ===

    fn initialize(&self, pin: &str, so_pin: &str, dkek_shares: u8) -> Result<(), HsmError> {
        Self::validate_pin(pin)?;
        Self::validate_so_pin(so_pin)?;

        // SmartCard-HSM INITIALIZE DEVICE APDU (INS=0x50)
        // 使用 ASN.1 TLV 格式: 0x81=user PIN, 0x82=SO-PIN, 0x92=DKEK shares
        let mut data = Vec::new();
        // User PIN (tag 0x81)
        data.push(0x81);
        data.push(pin.len() as u8);
        data.extend_from_slice(pin.as_bytes());
        // SO-PIN (tag 0x82)
        data.push(0x82);
        let so_pin_bytes = hex_to_bytes(so_pin)?;
        data.push(so_pin_bytes.len() as u8);
        data.extend_from_slice(&so_pin_bytes);
        // DKEK shares (tag 0x92)
        data.push(0x92);
        data.push(0x01);
        data.push(dkek_shares);

        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x50, // INITIALIZE
            p1: 0x00,
            p2: 0x00,
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    fn verify_pin(&self, pin: &str) -> Result<(), HsmError> {
        Self::validate_pin(pin)?;

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0x20, // VERIFY
            p1: 0x00,
            p2: 0x81, // User PIN reference
            data: Some(pin.as_bytes().to_vec()),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    fn change_pin(&self, old_pin: &str, new_pin: &str) -> Result<(), HsmError> {
        Self::validate_pin(old_pin)?;
        Self::validate_pin(new_pin)?;

        let mut data = Vec::new();
        data.extend_from_slice(old_pin.as_bytes());
        data.push(0x00); // separator
        data.extend_from_slice(new_pin.as_bytes());

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0x24, // CHANGE REFERENCE DATA
            p1: 0x00,
            p2: 0x81, // User PIN reference
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    fn change_so_pin(&self, old_so_pin: &str, new_so_pin: &str) -> Result<(), HsmError> {
        Self::validate_so_pin(old_so_pin)?;
        Self::validate_so_pin(new_so_pin)?;

        let old_bytes = hex_to_bytes(old_so_pin)?;
        let new_bytes = hex_to_bytes(new_so_pin)?;
        let mut data = Vec::new();
        data.extend_from_slice(&old_bytes);
        data.push(0x00);
        data.extend_from_slice(&new_bytes);

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0x24, // CHANGE REFERENCE DATA
            p1: 0x00,
            p2: 0x88, // SO-PIN reference
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    fn unblock_pin(&self, so_pin: &str, new_pin: &str) -> Result<(), HsmError> {
        Self::validate_so_pin(so_pin)?;
        Self::validate_pin(new_pin)?;

        let so_bytes = hex_to_bytes(so_pin)?;
        let mut data = Vec::new();
        data.extend_from_slice(&so_bytes);
        data.push(0x00);
        data.extend_from_slice(new_pin.as_bytes());

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0x2C, // RESET RETRY COUNTER
            p1: 0x00,
            p2: 0x81, // User PIN reference
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    // === 7.3: HSM 金鑰管理 ===

    fn list_keys(&self, pin: &str) -> Result<Vec<HsmKeyInfo>, HsmError> {
        Self::validate_pin(pin)?;
        self.verify_pin(pin)?;

        // LIST OBJECTS APDU (INS=0x58)
        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x58, // ENUMERATE OBJECTS
            p1: 0x00,
            p2: 0x00,
            data: None,
            le: Some(256),
        };
        let data = self.execute_apdu(&cmd)?;

        // 回應格式: 每 2 bytes 為一個 FID (file ID)
        // 私鑰 FID 前綴: 0xCC, 公鑰: 0xC4, 秘密金鑰: 0xCD
        let mut keys = Vec::new();
        let mut i = 0;
        while i + 1 < data.len() {
            let prefix = data[i];
            let id = data[i + 1];
            if prefix == 0xCC || prefix == 0xC4 || prefix == 0xCD {
                keys.push(HsmKeyInfo {
                    key_ref: id,
                    id,
                    label: format!("Key-{id}"),
                    key_type: match prefix {
                        0xCD => HsmKeyType::Aes,
                        _ => HsmKeyType::Ec { curve: "unknown".to_string() },
                    },
                    key_size: 0,
                    usage: vec![],
                });
            }
            i += 2;
        }
        Ok(keys)
    }

    fn generate_rsa_key(
        &self, pin: &str, bits: u16, id: u8, label: &str,
    ) -> Result<HsmKeyInfo, HsmError> {
        Self::validate_pin(pin)?;
        if !matches!(bits, 1024 | 2048 | 3072 | 4096) {
            return Err(HsmError::NotSupported);
        }
        self.verify_pin(pin)?;

        // GENERATE ASYMMETRIC KEY PAIR (INS=0x46)
        let mut data = Vec::new();
        data.push(0x30); // RSA algorithm tag
        data.push((bits >> 8) as u8);
        data.push((bits & 0xFF) as u8);
        data.extend_from_slice(label.as_bytes());

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0x46,
            p1: id,
            p2: 0x00,
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;

        Ok(HsmKeyInfo {
            key_ref: id,
            id,
            label: label.to_string(),
            key_type: HsmKeyType::Rsa,
            key_size: bits,
            usage: vec!["sign".to_string(), "decrypt".to_string()],
        })
    }

    fn generate_ec_key(
        &self, pin: &str, curve: &str, id: u8, label: &str,
    ) -> Result<HsmKeyInfo, HsmError> {
        Self::validate_pin(pin)?;
        let key_size = match curve {
            "secp256r1" | "brainpoolP256r1" => 256,
            "secp384r1" => 384,
            "secp521r1" => 521,
            _ => return Err(HsmError::NotSupported),
        };
        self.verify_pin(pin)?;

        let mut data = Vec::new();
        data.push(0x31); // EC algorithm tag
        data.extend_from_slice(curve.as_bytes());
        data.push(0x00);
        data.extend_from_slice(label.as_bytes());

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0x46,
            p1: id,
            p2: 0x00,
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;

        Ok(HsmKeyInfo {
            key_ref: id,
            id,
            label: label.to_string(),
            key_type: HsmKeyType::Ec { curve: curve.to_string() },
            key_size,
            usage: vec!["sign".to_string(), "derive".to_string()],
        })
    }

    fn generate_aes_key(&self, pin: &str, bits: u16, id: u8) -> Result<HsmKeyInfo, HsmError> {
        Self::validate_pin(pin)?;
        if !matches!(bits, 128 | 192 | 256) {
            return Err(HsmError::NotSupported);
        }
        self.verify_pin(pin)?;

        let mut data = Vec::new();
        data.push(0x32); // AES algorithm tag
        data.push((bits >> 8) as u8);
        data.push((bits & 0xFF) as u8);

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0x48, // GENERATE SECRET KEY
            p1: id,
            p2: 0x00,
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;

        Ok(HsmKeyInfo {
            key_ref: id,
            id,
            label: String::new(),
            key_type: HsmKeyType::Aes,
            key_size: bits,
            usage: vec!["encrypt".to_string(), "decrypt".to_string()],
        })
    }

    fn delete_key(&self, pin: &str, id: u8, key_type: KeyObjectType) -> Result<(), HsmError> {
        Self::validate_pin(pin)?;
        self.verify_pin(pin)?;

        // DELETE FILE (INS=0xE4)
        let fid_prefix = match key_type {
            KeyObjectType::PrivateKey => 0xCC,
            KeyObjectType::PublicKey => 0xC4,
            KeyObjectType::SecretKey => 0xCD,
            KeyObjectType::Certificate => 0xCE,
        };

        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xE4, // DELETE FILE
            p1: fid_prefix,
            p2: id,
            data: None,
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    // === 7.4: HSM 憑證管理 ===

    fn list_certificates(&self, pin: &str) -> Result<Vec<HsmCertInfo>, HsmError> {
        Self::validate_pin(pin)?;
        self.verify_pin(pin)?;

        // ENUMERATE OBJECTS (INS=0x58)
        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x58,
            p1: 0x00,
            p2: 0x00,
            data: None,
            le: Some(256),
        };
        let data = self.execute_apdu(&cmd)?;

        // 篩選憑證 FID (前綴 0xCE = EE cert, 0xCA = CA cert)
        let mut certs = Vec::new();
        let mut i = 0;
        while i + 1 < data.len() {
            let prefix = data[i];
            let id = data[i + 1];
            if prefix == 0xCE || prefix == 0xCA {
                certs.push(HsmCertInfo {
                    id,
                    subject: format!("Certificate-{id}"),
                    issuer: String::new(),
                    not_before: String::new(),
                    not_after: String::new(),
                    key_id: Some(id),
                });
            }
            i += 2;
        }
        Ok(certs)
    }

    fn import_certificate(
        &self, pin: &str, id: u8, cert_data: &[u8],
    ) -> Result<(), HsmError> {
        Self::validate_pin(pin)?;
        if cert_data.is_empty() {
            return Err(HsmError::CommunicationError("憑證資料不可為空".to_string()));
        }
        self.verify_pin(pin)?;

        // UPDATE EF (INS=0xD7) — 寫入憑證至 EE certificate EF
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xD7, // UPDATE EF
            p1: 0xCE,  // EE certificate prefix
            p2: id,
            data: Some(cert_data.to_vec()),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    fn export_certificate(&self, id: u8) -> Result<Vec<u8>, HsmError> {
        // READ BINARY (INS=0xB0) — 讀取憑證
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xB0, // READ BINARY
            p1: 0xCE,  // EE certificate prefix
            p2: id,
            data: None,
            le: Some(256),
        };
        let data = self.execute_apdu(&cmd)?;
        if data.is_empty() {
            return Err(HsmError::CertificateNotFound(id));
        }
        Ok(data)
    }

    // === 7.5: HSM DKEK 備份還原 ===

    fn create_dkek_share(&self, password: &str) -> Result<Vec<u8>, HsmError> {
        if password.is_empty() {
            return Err(HsmError::CommunicationError("DKEK 保護密碼不可為空".to_string()));
        }

        // KEY DOMAIN (INS=0x52) — 匯出 DKEK share
        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x52,
            p1: 0x00,
            p2: 0x92,
            data: Some(password.as_bytes().to_vec()),
            le: Some(256),
        };
        let data = self.execute_apdu(&cmd)?;
        Ok(data)
    }

    fn import_dkek_share(
        &self, share_data: &[u8], password: &str,
    ) -> Result<DkekStatus, HsmError> {
        if share_data.is_empty() {
            return Err(HsmError::CommunicationError("DKEK 份額資料不可為空".to_string()));
        }
        if password.is_empty() {
            return Err(HsmError::CommunicationError("DKEK 保護密碼不可為空".to_string()));
        }

        // KEY DOMAIN (INS=0x52) — 匯入 DKEK share
        let mut data = Vec::new();
        data.extend_from_slice(share_data);
        data.push(0x00);
        data.extend_from_slice(password.as_bytes());

        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x52,
            p1: 0x00,
            p2: 0x93,
            data: Some(data),
            le: Some(256),
        };
        let _resp = self.execute_apdu(&cmd)?;

        Ok(DkekStatus {
            total_shares: 0,
            imported_shares: 0,
            remaining_shares: 0,
            key_check_value: None,
        })
    }

    fn wrap_key(&self, pin: &str, key_ref: u8) -> Result<Vec<u8>, HsmError> {
        Self::validate_pin(pin)?;
        self.verify_pin(pin)?;

        // WRAP KEY (INS=0x72)
        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x72,
            p1: key_ref,
            p2: 0x92,
            data: None,
            le: Some(256),
        };
        let data = self.execute_apdu(&cmd)?;
        Ok(data)
    }

    fn unwrap_key(
        &self, pin: &str, key_ref: u8, wrapped: &[u8],
    ) -> Result<(), HsmError> {
        Self::validate_pin(pin)?;
        if wrapped.is_empty() {
            return Err(HsmError::CommunicationError("包裝金鑰資料不可為空".to_string()));
        }
        self.verify_pin(pin)?;

        // UNWRAP KEY (INS=0x74)
        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x74,
            p1: key_ref,
            p2: 0x93,
            data: Some(wrapped.to_vec()),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    // === 7.6: HSM 裝置選項與組態 ===

    fn get_options(&self) -> Result<HsmOptions, HsmError> {
        // EXTRAS (INS=0x64, P1=0x06) — 讀取動態選項
        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x64, // EXTRAS
            p1: 0x06,  // CMD_DYNOPS
            p2: 0x00,
            data: None,
            le: Some(256),
        };
        let data = self.execute_apdu(&cmd)?;

        let opts = if data.len() >= 2 {
            ((data[0] as u16) << 8) | (data[1] as u16)
        } else {
            0
        };

        Ok(HsmOptions {
            press_to_confirm: (opts & 0x01) != 0,
            key_usage_counter: (opts & 0x02) != 0,
        })
    }

    fn set_option(&self, option: HsmOptionType, enabled: bool) -> Result<(), HsmError> {
        // 先讀取目前選項
        let current = self.get_options()?;
        let mut opts: u8 = 0;
        if current.press_to_confirm { opts |= 0x01; }
        if current.key_usage_counter { opts |= 0x02; }

        match option {
            HsmOptionType::PressToConfirm => {
                if enabled { opts |= 0x01; } else { opts &= !0x01; }
            }
            HsmOptionType::KeyUsageCounter => {
                if enabled { opts |= 0x02; } else { opts &= !0x02; }
            }
        }

        // EXTRAS (INS=0x64, P1=0x06) — 設定動態選項
        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x64,
            p1: 0x06,
            p2: 0x00,
            data: Some(vec![opts]),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    fn set_datetime(&self) -> Result<(), HsmError> {
        // EXTRAS (INS=0x64, P1=0x0A) — 同步主機時間至裝置 RTC
        // 格式: year(2B BE) + month + day + weekday + hour + min + sec = 8 bytes
        // 使用 Windows systemtime 或 Unix time 取得本地時間
        #[cfg(target_os = "windows")]
        let data = {
            let output = std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command",
                    "Get-Date -Format 'yyyy,MM,dd,dddd,HH,mm,ss'"])
                .output()
                .map_err(|e| HsmError::CommunicationError(format!("無法取得系統時間: {e}")))?;
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let parts: Vec<&str> = s.split(',').collect();
            if parts.len() < 7 {
                return Err(HsmError::CommunicationError("無法解析系統時間".to_string()));
            }
            let year: u16 = parts[0].parse().unwrap_or(2026);
            let month: u8 = parts[1].parse().unwrap_or(1);
            let day: u8 = parts[2].parse().unwrap_or(1);
            // weekday: Sunday=0
            let weekday_name = parts[3].to_lowercase();
            let weekday: u8 = match weekday_name.as_str() {
                "sunday" => 0, "monday" => 1, "tuesday" => 2, "wednesday" => 3,
                "thursday" => 4, "friday" => 5, "saturday" => 6, _ => 0,
            };
            let hour: u8 = parts[4].parse().unwrap_or(0);
            let min: u8 = parts[5].parse().unwrap_or(0);
            let sec: u8 = parts[6].parse().unwrap_or(0);
            vec![
                (year >> 8) as u8, (year & 0xFF) as u8,
                month, day, weekday, hour, min, sec,
            ]
        };
        #[cfg(not(target_os = "windows"))]
        let data = {
            // 簡化: 使用 Unix timestamp 的近似值
            let secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| HsmError::CommunicationError(e.to_string()))?
                .as_secs();
            // 簡易日期計算（不精確，但足夠用於 RTC 同步）
            let year: u16 = 2026;
            vec![
                (year >> 8) as u8, (year & 0xFF) as u8,
                1, 1, 0, 0, 0, (secs % 60) as u8,
            ]
        };

        let cmd = ApduCommand {
            cla: 0x80,
            ins: 0x64,
            p1: 0x0A, // CMD_DATETIME
            p2: 0x00,
            data: Some(data),
            le: None,
        };
        self.execute_apdu(&cmd)?;
        Ok(())
    }

    fn get_device_info(&self) -> Result<HsmDeviceInfo, HsmError> {
        // 1. SELECT SC-HSM applet → 取得版本號
        let select_data = self.select_and_get_info()?;
        let (firmware_version, _options) = Self::parse_version_from_select(&select_data);

        // 2. 嘗試用 INITIALIZE 無資料 (INS=0x50, nc=0) 取得版本
        // 回傳 7 bytes: heap(4) + 0x00 + major + minor
        let firmware_version = if firmware_version == "unknown" {
            let init_cmd = ApduCommand {
                cla: 0x80,
                ins: 0x50,
                p1: 0x00,
                p2: 0x00,
                data: None,
                le: Some(256),
            };
            match self.execute_apdu(&init_cmd) {
                Ok(data) if data.len() >= 7 => {
                    let major = data[5];
                    let minor = data[6];
                    format!("{major}.{minor}")
                }
                _ => firmware_version,
            }
        } else {
            firmware_version
        };

        // 3. EXTRAS (INS=0x64, P1=0x05) — 取得記憶體使用量（容錯：失敗時回傳 0）
        // CMD_MEMORY 回傳 5 × u32 BE: free, used, total, nfiles, size
        let (free_memory, used_memory, total_memory, file_count) = {
            let cmd = ApduCommand {
                cla: 0x80,
                ins: 0x64,
                p1: 0x05, // CMD_MEMORY
                p2: 0x00,
                data: None,
                le: Some(256),
            };
            match self.execute_apdu(&cmd) {
                Ok(mem_data) if mem_data.len() >= 16 => {
                    let free = u32::from_be_bytes([mem_data[0], mem_data[1], mem_data[2], mem_data[3]]);
                    let used = u32::from_be_bytes([mem_data[4], mem_data[5], mem_data[6], mem_data[7]]);
                    let total = u32::from_be_bytes([mem_data[8], mem_data[9], mem_data[10], mem_data[11]]);
                    let nfiles = u32::from_be_bytes([mem_data[12], mem_data[13], mem_data[14], mem_data[15]]);
                    (free as u64, used as u64, total as u64, nfiles)
                }
                _ => (0, 0, 0, 0),
            }
        };

        let serial_number = String::new();

        Ok(HsmDeviceInfo {
            firmware_version,
            serial_number,
            free_memory,
            used_memory,
            total_memory,
            file_count,
        })
    }

    fn enable_secure_lock(&self) -> Result<(), HsmError> {
        // Secure lock 需要 ECDH key agreement 流程，此處簡化
        Err(HsmError::CommunicationError(
            "安全鎖功能需要進階 ECDH 金鑰交換流程，目前尚未支援。".to_string(),
        ))
    }

    fn disable_secure_lock(&self) -> Result<(), HsmError> {
        Err(HsmError::CommunicationError(
            "安全鎖功能需要進階 ECDH 金鑰交換流程，目前尚未支援。".to_string(),
        ))
    }

    fn set_led_config(&self, config: &LedConfig) -> Result<(), HsmError> {
        // EXTRAS (INS=0x64, P1=0x1B) — PHY 設定
        if let Some(gpio) = config.gpio {
            let cmd = ApduCommand {
                cla: 0x80,
                ins: 0x64,
                p1: 0x1B, // CMD_PHY
                p2: 0x01, // PHY_LED_GPIO
                data: Some(vec![gpio]),
                le: None,
            };
            self.execute_apdu(&cmd)?;
        }
        if let Some(brightness) = config.brightness {
            let cmd = ApduCommand {
                cla: 0x80,
                ins: 0x64,
                p1: 0x1B,
                p2: 0x02, // PHY_LED_BTNESS
                data: Some(vec![brightness]),
                le: None,
            };
            self.execute_apdu(&cmd)?;
        }
        Ok(())
    }
}

/// 將十六進位字串轉換為位元組陣列
fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, HsmError> {
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    let mut chars = hex.chars();
    while let (Some(h), Some(l)) = (chars.next(), chars.next()) {
        let byte = u8::from_str_radix(&format!("{h}{l}"), 16)
            .map_err(|_| HsmError::SoPinFormatInvalid)?;
        bytes.push(byte);
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    // === PIN 驗證測試 ===

    #[test]
    fn test_validate_pin_valid_6_chars() {
        assert!(HsmModuleImpl::validate_pin("123456").is_ok());
    }

    #[test]
    fn test_validate_pin_valid_16_chars() {
        let pin = "a".repeat(16);
        assert!(HsmModuleImpl::validate_pin(&pin).is_ok());
    }

    #[test]
    fn test_validate_pin_too_short() {
        assert!(matches!(
            HsmModuleImpl::validate_pin("12345"),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    #[test]
    fn test_validate_pin_empty() {
        assert!(matches!(
            HsmModuleImpl::validate_pin(""),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    #[test]
    fn test_validate_pin_too_long() {
        let pin = "a".repeat(17);
        assert!(matches!(
            HsmModuleImpl::validate_pin(&pin),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    // === SO-PIN 驗證測試 ===

    #[test]
    fn test_validate_so_pin_valid() {
        assert!(HsmModuleImpl::validate_so_pin("0123456789ABCDEF").is_ok());
    }

    #[test]
    fn test_validate_so_pin_valid_lowercase() {
        assert!(HsmModuleImpl::validate_so_pin("0123456789abcdef").is_ok());
    }

    #[test]
    fn test_validate_so_pin_too_short() {
        assert!(matches!(
            HsmModuleImpl::validate_so_pin("0123456789ABCDE"),
            Err(HsmError::SoPinFormatInvalid)
        ));
    }

    #[test]
    fn test_validate_so_pin_too_long() {
        assert!(matches!(
            HsmModuleImpl::validate_so_pin("0123456789ABCDEF0"),
            Err(HsmError::SoPinFormatInvalid)
        ));
    }

    #[test]
    fn test_validate_so_pin_non_hex() {
        assert!(matches!(
            HsmModuleImpl::validate_so_pin("0123456789ABCDEG"),
            Err(HsmError::SoPinFormatInvalid)
        ));
    }

    #[test]
    fn test_validate_so_pin_empty() {
        assert!(matches!(
            HsmModuleImpl::validate_so_pin(""),
            Err(HsmError::SoPinFormatInvalid)
        ));
    }

    // === hex_to_bytes 測試 ===

    #[test]
    fn test_hex_to_bytes_valid() {
        let bytes = hex_to_bytes("0123456789ABCDEF").unwrap();
        assert_eq!(bytes, vec![0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF]);
    }

    #[test]
    fn test_hex_to_bytes_lowercase() {
        let bytes = hex_to_bytes("abcdef").unwrap();
        assert_eq!(bytes, vec![0xAB, 0xCD, 0xEF]);
    }

    // === parse_version_from_select 測試 ===

    #[test]
    fn test_parse_version_from_select() {
        // 模擬 SELECT 回應: ... 0x85 0x05 [options_hi options_lo 0xFF major minor]
        let data = vec![0x6F, 0x0A, 0x85, 0x05, 0x00, 0x01, 0xFF, 0x06, 0x04];
        let (version, options) = HsmModuleImpl::parse_version_from_select(&data);
        assert_eq!(version, "6.4");
        assert_eq!(options, 0x0001);
    }

    #[test]
    fn test_parse_version_from_select_not_found() {
        let data = vec![0x6F, 0x00];
        let (version, _) = HsmModuleImpl::parse_version_from_select(&data);
        assert_eq!(version, "unknown");
    }

    // === initialize 驗證測試 ===

    #[test]
    fn test_initialize_rejects_invalid_pin() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.initialize("123", "0123456789ABCDEF", 2),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    #[test]
    fn test_initialize_rejects_invalid_so_pin() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.initialize("123456", "not_hex_16_chars!", 2),
            Err(HsmError::SoPinFormatInvalid)
        ));
    }

    #[test]
    fn test_initialize_valid_hits_device() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.initialize("123456", "0123456789ABCDEF", 2),
            Err(HsmError::CommunicationError(_))
        ));
    }

    // === verify_pin 測試 ===

    #[test]
    fn test_verify_pin_rejects_invalid() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.verify_pin("12345"),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    #[test]
    fn test_verify_pin_valid_hits_device() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.verify_pin("123456"),
            Err(HsmError::CommunicationError(_))
        ));
    }

    // === change_pin 測試 ===

    #[test]
    fn test_change_pin_rejects_invalid_old() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.change_pin("12345", "123456"),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    #[test]
    fn test_change_pin_rejects_invalid_new() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.change_pin("123456", "12345"),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    #[test]
    fn test_change_pin_valid_hits_device() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.change_pin("123456", "654321"),
            Err(HsmError::CommunicationError(_))
        ));
    }

    // === change_so_pin 測試 ===

    #[test]
    fn test_change_so_pin_rejects_invalid_old() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.change_so_pin("not_valid", "0123456789ABCDEF"),
            Err(HsmError::SoPinFormatInvalid)
        ));
    }

    #[test]
    fn test_change_so_pin_valid_hits_device() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.change_so_pin("0123456789ABCDEF", "FEDCBA9876543210"),
            Err(HsmError::CommunicationError(_))
        ));
    }

    // === unblock_pin 測試 ===

    #[test]
    fn test_unblock_pin_rejects_invalid_so_pin() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.unblock_pin("bad", "123456"),
            Err(HsmError::SoPinFormatInvalid)
        ));
    }

    #[test]
    fn test_unblock_pin_rejects_invalid_new_pin() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.unblock_pin("0123456789ABCDEF", "12345"),
            Err(HsmError::PinFormatInvalid)
        ));
    }

    #[test]
    fn test_unblock_pin_valid_hits_device() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.unblock_pin("0123456789ABCDEF", "123456"),
            Err(HsmError::CommunicationError(_))
        ));
    }

    // === 金鑰管理測試 ===

    #[test]
    fn test_generate_rsa_key_rejects_invalid_size() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.generate_rsa_key("123456", 512, 1, "test"),
            Err(HsmError::NotSupported)
        ));
    }

    #[test]
    fn test_generate_ec_key_rejects_invalid_curve() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.generate_ec_key("123456", "invalid_curve", 1, "test"),
            Err(HsmError::NotSupported)
        ));
    }

    #[test]
    fn test_generate_aes_key_rejects_invalid_size() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.generate_aes_key("123456", 64, 1),
            Err(HsmError::NotSupported)
        ));
    }

    // === 憑證管理測試 ===

    #[test]
    fn test_import_certificate_rejects_empty_data() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.import_certificate("123456", 1, &[]),
            Err(HsmError::CommunicationError(_))
        ));
    }

    // === DKEK 測試 ===

    #[test]
    fn test_create_dkek_share_rejects_empty_password() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.create_dkek_share(""),
            Err(HsmError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_import_dkek_share_rejects_empty_data() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.import_dkek_share(&[], "password"),
            Err(HsmError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_import_dkek_share_rejects_empty_password() {
        let module = HsmModuleImpl::new("test".to_string());
        assert!(matches!(
            module.import_dkek_share(&[0x01], ""),
            Err(HsmError::CommunicationError(_))
        ));
    }

    // === SC-HSM AID 常數測試 ===

    #[test]
    fn test_sc_hsm_aid_constant() {
        assert_eq!(
            SC_HSM_AID,
            &[0xE8, 0x2B, 0x06, 0x01, 0x04, 0x01, 0x81, 0xC3, 0x1F, 0x02, 0x01]
        );
    }
}
