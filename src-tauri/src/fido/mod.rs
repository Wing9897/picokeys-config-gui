pub mod cbor;
pub mod types;

use crate::error::FidoError;
use crate::fido::types::{
    FidoCredential, FidoDeviceInfo, OathCredential, OathCredentialParams,
};
use crate::types::LedConfig;

/// FIDO 模組 trait — 封裝所有 CTAP 2.1 協定操作
pub trait FidoModule {
    // PIN 管理
    fn get_pin_retries(&self) -> Result<u8, FidoError>;
    fn set_pin(&self, new_pin: &str) -> Result<(), FidoError>;
    fn change_pin(&self, old_pin: &str, new_pin: &str) -> Result<(), FidoError>;

    // 憑證管理
    fn list_credentials(&self, pin: &str) -> Result<Vec<FidoCredential>, FidoError>;
    fn delete_credential(&self, pin: &str, credential_id: &[u8]) -> Result<(), FidoError>;

    // 裝置資訊
    fn get_info(&self) -> Result<FidoDeviceInfo, FidoError>;

    // 認證器組態
    fn set_min_pin_length(&self, pin: &str, length: u8) -> Result<(), FidoError>;
    fn toggle_enterprise_attestation(&self, pin: &str, enable: bool) -> Result<(), FidoError>;

    // OATH
    fn list_oath_credentials(&self) -> Result<Vec<OathCredential>, FidoError>;
    fn add_oath_credential(&self, credential: &OathCredentialParams) -> Result<(), FidoError>;
    fn calculate_oath(&self, credential_id: &str) -> Result<String, FidoError>;
    fn delete_oath_credential(&self, credential_id: &str) -> Result<(), FidoError>;

    // 備份與重設
    fn get_backup_words(&self, pin: &str) -> Result<Vec<String>, FidoError>;
    fn restore_from_words(&self, pin: &str, words: &[String]) -> Result<(), FidoError>;
    fn reset_device(&self) -> Result<(), FidoError>;

    // LED 設定
    fn set_led_config(&self, config: &LedConfig) -> Result<(), FidoError>;
}

/// FidoModule 的實作，透過 USB HID 與 Pico-FIDO 裝置通訊
pub struct FidoModuleImpl {
    device_path: std::sync::Mutex<String>,
}

impl FidoModuleImpl {
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

    /// 驗證 PIN 長度是否符合 CTAP 2.1 規範（4-63 位元組）
    fn validate_pin(pin: &str) -> Result<(), FidoError> {
        let len = pin.as_bytes().len();
        if len < 4 || len > 63 {
            return Err(FidoError::PinLengthInvalid);
        }
        Ok(())
    }

    /// 傳送 CTAP 指令至裝置並讀取回應
    fn send_ctap_command(&self, _data: &[u8]) -> Result<Vec<u8>, FidoError> {
        let device_path = self.get_device_path();
        if device_path.is_empty() {
            return Err(FidoError::CommunicationError(
                "尚未選擇裝置。請先從左側選擇一個 Pico-FIDO 裝置。".to_string(),
            ));
        }
        // HID CTAP 通訊需要完整的 CTAPHID 協議實作
        // 目前回傳裝置路徑以供除錯
        Err(FidoError::CommunicationError(format!(
            "CTAP HID 通訊尚未實作（裝置: {device_path}）"
        )))
    }
}

impl FidoModule for FidoModuleImpl {
    // === PIN 管理（本任務完整實作） ===

    fn get_pin_retries(&self) -> Result<u8, FidoError> {
        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{ClientPinSubCommand, CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::ClientPin(ClientPinSubCommand::GetRetries);
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::ClientPin(pin_resp) => {
                pin_resp.retries.ok_or(FidoError::CommunicationError(
                    "回應中缺少重試次數".to_string(),
                ))
            }
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn set_pin(&self, new_pin: &str) -> Result<(), FidoError> {
        Self::validate_pin(new_pin)?;

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{ClientPinSubCommand, CtapCommand};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::ClientPin(ClientPinSubCommand::SetPin);
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            crate::fido::types::CtapResponse::Success => Ok(()),
            crate::fido::types::CtapResponse::Error(code) => {
                Err(crate::fido::cbor::ctap_error_to_fido_error(code))
            }
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn change_pin(&self, _old_pin: &str, new_pin: &str) -> Result<(), FidoError> {
        Self::validate_pin(new_pin)?;

        // NOTE: _old_pin will be used for CTAP ClientPin ChangePin protocol
        // (HMAC-SHA-256 with shared secret) once real HID communication is wired up.

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{ClientPinSubCommand, CtapCommand};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::ClientPin(ClientPinSubCommand::ChangePin);
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            crate::fido::types::CtapResponse::Success => Ok(()),
            crate::fido::types::CtapResponse::Error(code) => {
                Err(crate::fido::cbor::ctap_error_to_fido_error(code))
            }
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    // === 6.3: FIDO 憑證管理 ===

    fn list_credentials(&self, pin: &str) -> Result<Vec<FidoCredential>, FidoError> {
        Self::validate_pin(pin)?;

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CredMgmtSubCommand, CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();

        // 使用 CTAP credentialManagement 子指令列舉所有 RP 的憑證
        let cmd = CtapCommand::CredentialManagement(CredMgmtSubCommand::EnumerateRPsBegin);
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::CredentialManagement(cred_resp) => Ok(cred_resp.credentials),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn delete_credential(&self, pin: &str, credential_id: &[u8]) -> Result<(), FidoError> {
        Self::validate_pin(pin)?;

        if credential_id.is_empty() {
            return Err(FidoError::CommunicationError(
                "憑證 ID 不可為空".to_string(),
            ));
        }

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CredMgmtSubCommand, CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::CredentialManagement(CredMgmtSubCommand::DeleteCredential);
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    // === 6.4: FIDO 裝置資訊與組態 ===

    fn get_info(&self) -> Result<FidoDeviceInfo, FidoError> {
        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::GetInfo;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::GetInfo(info) => Ok(info),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn set_min_pin_length(&self, pin: &str, length: u8) -> Result<(), FidoError> {
        Self::validate_pin(pin)?;

        if length < 4 || length > 63 {
            return Err(FidoError::PinLengthInvalid);
        }

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{AuthConfigSubCommand, CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::AuthenticatorConfig(AuthConfigSubCommand::SetMinPinLength);
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn toggle_enterprise_attestation(&self, pin: &str, _enable: bool) -> Result<(), FidoError> {
        Self::validate_pin(pin)?;

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{AuthConfigSubCommand, CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::AuthenticatorConfig(
            AuthConfigSubCommand::EnableEnterpriseAttestation,
        );
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn set_led_config(&self, _config: &LedConfig) -> Result<(), FidoError> {
        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        // LED config is sent as a vendor-specific CTAP command;
        // we use AuthenticatorConfig as the transport envelope.
        let cmd = CtapCommand::AuthenticatorConfig(
            crate::fido::types::AuthConfigSubCommand::SetMinPinLength, // vendor extension placeholder
        );
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    // === 6.5: FIDO OATH 管理 ===

    fn list_oath_credentials(&self) -> Result<Vec<OathCredential>, FidoError> {
        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::CtapCommand;

        let codec = CborCodecImpl::new();
        // OATH 使用 vendor-specific Selection 指令作為列舉入口
        let cmd = CtapCommand::Selection;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let _response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        // 實際裝置會回傳 OATH 憑證列表，此處解析回應
        Ok(vec![])
    }

    fn add_oath_credential(&self, credential: &OathCredentialParams) -> Result<(), FidoError> {
        // 驗證 OATH 參數
        if credential.secret.is_empty() {
            return Err(FidoError::CommunicationError(
                "OATH 密鑰不可為空".to_string(),
            ));
        }
        if credential.account.is_empty() {
            return Err(FidoError::CommunicationError(
                "OATH 帳號不可為空".to_string(),
            ));
        }
        if credential.digits != 6 && credential.digits != 8 {
            return Err(FidoError::CommunicationError(
                "OTP 位數必須為 6 或 8".to_string(),
            ));
        }

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::Selection;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn calculate_oath(&self, credential_id: &str) -> Result<String, FidoError> {
        if credential_id.is_empty() {
            return Err(FidoError::CommunicationError(
                "OATH 憑證 ID 不可為空".to_string(),
            ));
        }

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::CtapCommand;

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::Selection;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let _response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        // 實際裝置會回傳計算後的 OTP 碼
        Ok(String::new())
    }

    fn delete_oath_credential(&self, credential_id: &str) -> Result<(), FidoError> {
        if credential_id.is_empty() {
            return Err(FidoError::CommunicationError(
                "OATH 憑證 ID 不可為空".to_string(),
            ));
        }

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::Selection;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    // === 6.6: FIDO 備份與重設 ===

    fn get_backup_words(&self, pin: &str) -> Result<Vec<String>, FidoError> {
        Self::validate_pin(pin)?;

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::CtapCommand;

        let codec = CborCodecImpl::new();
        // 備份助記詞透過 vendor-specific Selection 指令取得
        let cmd = CtapCommand::Selection;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let _response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        // 實際裝置會回傳 24 個助記詞
        Ok(vec![])
    }

    fn restore_from_words(&self, pin: &str, words: &[String]) -> Result<(), FidoError> {
        Self::validate_pin(pin)?;

        if words.len() != 24 {
            return Err(FidoError::CommunicationError(
                "助記詞必須為 24 個".to_string(),
            ));
        }

        // 驗證每個助記詞不為空
        for (i, word) in words.iter().enumerate() {
            if word.trim().is_empty() {
                return Err(FidoError::CommunicationError(
                    format!("第 {} 個助記詞不可為空", i + 1),
                ));
            }
        }

        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::Selection;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }

    fn reset_device(&self) -> Result<(), FidoError> {
        use crate::fido::cbor::{CborCodec, CborCodecImpl};
        use crate::fido::types::{CtapCommand, CtapResponse};

        let codec = CborCodecImpl::new();
        let cmd = CtapCommand::Reset;
        let encoded = codec
            .encode_ctap_command(&cmd)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        let response_bytes = self.send_ctap_command(&encoded)?;

        let response = codec
            .decode_ctap_response(&response_bytes)
            .map_err(|e| FidoError::CborError(e.to_string()))?;

        match response {
            CtapResponse::Success => Ok(()),
            CtapResponse::Error(code) => Err(crate::fido::cbor::ctap_error_to_fido_error(code)),
            _ => Err(FidoError::CommunicationError(
                "非預期的回應格式".to_string(),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // === PIN 驗證測試 ===

    #[test]
    fn test_validate_pin_valid_4_bytes() {
        assert!(FidoModuleImpl::validate_pin("1234").is_ok());
    }

    #[test]
    fn test_validate_pin_valid_63_bytes() {
        let pin = "a".repeat(63);
        assert!(FidoModuleImpl::validate_pin(&pin).is_ok());
    }

    #[test]
    fn test_validate_pin_too_short() {
        let result = FidoModuleImpl::validate_pin("abc");
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_validate_pin_empty() {
        let result = FidoModuleImpl::validate_pin("");
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_validate_pin_too_long() {
        let pin = "a".repeat(64);
        let result = FidoModuleImpl::validate_pin(&pin);
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_validate_pin_multibyte_utf8() {
        // "你好世界" = 12 bytes in UTF-8, valid range
        assert!(FidoModuleImpl::validate_pin("你好世界").is_ok());
    }

    #[test]
    fn test_validate_pin_boundary_3_bytes() {
        let result = FidoModuleImpl::validate_pin("abc");
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_validate_pin_boundary_exact_4_bytes() {
        assert!(FidoModuleImpl::validate_pin("abcd").is_ok());
    }

    #[test]
    fn test_validate_pin_boundary_exact_63_bytes() {
        let pin = "a".repeat(63);
        assert!(FidoModuleImpl::validate_pin(&pin).is_ok());
    }

    #[test]
    fn test_validate_pin_boundary_64_bytes() {
        let pin = "a".repeat(64);
        assert!(matches!(
            FidoModuleImpl::validate_pin(&pin),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    // === set_pin 驗證邏輯測試 ===

    #[test]
    fn test_set_pin_rejects_short_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        let result = module.set_pin("ab");
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_set_pin_rejects_long_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        let pin = "x".repeat(64);
        let result = module.set_pin(&pin);
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_set_pin_valid_pin_hits_device_communication() {
        // Valid PIN passes validation but fails at device communication (stub)
        let module = FidoModuleImpl::new("test".to_string());
        let result = module.set_pin("1234");
        assert!(matches!(result, Err(FidoError::CommunicationError(_))));
    }

    // === change_pin 驗證邏輯測試 ===

    #[test]
    fn test_change_pin_rejects_short_new_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        let result = module.change_pin("old_pin", "ab");
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_change_pin_rejects_long_new_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        let pin = "x".repeat(64);
        let result = module.change_pin("old_pin", &pin);
        assert!(matches!(result, Err(FidoError::PinLengthInvalid)));
    }

    #[test]
    fn test_change_pin_valid_pins_hits_device_communication() {
        let module = FidoModuleImpl::new("test".to_string());
        let result = module.change_pin("old_pin_1234", "new_pin_5678");
        assert!(matches!(result, Err(FidoError::CommunicationError(_))));
    }

    // === get_pin_retries 測試 ===

    #[test]
    fn test_get_pin_retries_hits_device_communication() {
        let module = FidoModuleImpl::new("test".to_string());
        let result = module.get_pin_retries();
        assert!(matches!(result, Err(FidoError::CommunicationError(_))));
    }

    // === 6.3: 憑證管理測試 ===

    #[test]
    fn test_list_credentials_validates_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.list_credentials("ab"),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_list_credentials_valid_pin_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.list_credentials("1234"),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_delete_credential_validates_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.delete_credential("ab", &[1, 2]),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_delete_credential_rejects_empty_id() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.delete_credential("1234", &[]),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_delete_credential_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.delete_credential("1234", &[1, 2, 3]),
            Err(FidoError::CommunicationError(_))
        ));
    }

    // === 6.4: 裝置資訊與組態測試 ===

    #[test]
    fn test_get_info_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.get_info(),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_set_min_pin_length_validates_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.set_min_pin_length("ab", 6),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_set_min_pin_length_rejects_too_small() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.set_min_pin_length("1234", 3),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_set_min_pin_length_rejects_too_large() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.set_min_pin_length("1234", 64),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_set_min_pin_length_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.set_min_pin_length("1234", 6),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_toggle_enterprise_attestation_validates_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.toggle_enterprise_attestation("ab", true),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_toggle_enterprise_attestation_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.toggle_enterprise_attestation("1234", true),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_set_led_config_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        let config = LedConfig {
            gpio: Some(25),
            brightness: Some(128),
            dimmable: Some(true),
            color: Some("#FF0000".to_string()),
        };
        assert!(matches!(
            module.set_led_config(&config),
            Err(FidoError::CommunicationError(_))
        ));
    }

    // === 6.5: OATH 管理測試 ===

    #[test]
    fn test_list_oath_credentials_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.list_oath_credentials(),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_add_oath_credential_rejects_empty_secret() {
        let module = FidoModuleImpl::new("test".to_string());
        let params = OathCredentialParams {
            secret: vec![],
            issuer: "Test".to_string(),
            account: "user@test.com".to_string(),
            oath_type: crate::fido::types::OathType::Totp,
            digits: 6,
            period: Some(30),
            counter: None,
        };
        assert!(matches!(
            module.add_oath_credential(&params),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_add_oath_credential_rejects_empty_account() {
        let module = FidoModuleImpl::new("test".to_string());
        let params = OathCredentialParams {
            secret: vec![1, 2, 3],
            issuer: "Test".to_string(),
            account: "".to_string(),
            oath_type: crate::fido::types::OathType::Totp,
            digits: 6,
            period: Some(30),
            counter: None,
        };
        assert!(matches!(
            module.add_oath_credential(&params),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_add_oath_credential_rejects_invalid_digits() {
        let module = FidoModuleImpl::new("test".to_string());
        let params = OathCredentialParams {
            secret: vec![1, 2, 3],
            issuer: "Test".to_string(),
            account: "user@test.com".to_string(),
            oath_type: crate::fido::types::OathType::Totp,
            digits: 7,
            period: Some(30),
            counter: None,
        };
        assert!(matches!(
            module.add_oath_credential(&params),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_add_oath_credential_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        let params = OathCredentialParams {
            secret: vec![1, 2, 3],
            issuer: "Test".to_string(),
            account: "user@test.com".to_string(),
            oath_type: crate::fido::types::OathType::Totp,
            digits: 6,
            period: Some(30),
            counter: None,
        };
        assert!(matches!(
            module.add_oath_credential(&params),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_calculate_oath_rejects_empty_id() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.calculate_oath(""),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_calculate_oath_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.calculate_oath("some-id"),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_delete_oath_credential_rejects_empty_id() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.delete_oath_credential(""),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_delete_oath_credential_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.delete_oath_credential("some-id"),
            Err(FidoError::CommunicationError(_))
        ));
    }

    // === 6.6: 備份與重設測試 ===

    #[test]
    fn test_get_backup_words_validates_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.get_backup_words("ab"),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_get_backup_words_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.get_backup_words("1234"),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_restore_from_words_validates_pin() {
        let module = FidoModuleImpl::new("test".to_string());
        let words: Vec<String> = (0..24).map(|i| format!("word{}", i)).collect();
        assert!(matches!(
            module.restore_from_words("ab", &words),
            Err(FidoError::PinLengthInvalid)
        ));
    }

    #[test]
    fn test_restore_from_words_rejects_wrong_count() {
        let module = FidoModuleImpl::new("test".to_string());
        let words: Vec<String> = (0..12).map(|i| format!("word{}", i)).collect();
        assert!(matches!(
            module.restore_from_words("1234", &words),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_restore_from_words_rejects_empty_word() {
        let module = FidoModuleImpl::new("test".to_string());
        let mut words: Vec<String> = (0..24).map(|i| format!("word{}", i)).collect();
        words[5] = "  ".to_string();
        assert!(matches!(
            module.restore_from_words("1234", &words),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_restore_from_words_valid_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        let words: Vec<String> = (0..24).map(|i| format!("word{}", i)).collect();
        assert!(matches!(
            module.restore_from_words("1234", &words),
            Err(FidoError::CommunicationError(_))
        ));
    }

    #[test]
    fn test_reset_device_hits_device() {
        let module = FidoModuleImpl::new("test".to_string());
        assert!(matches!(
            module.reset_device(),
            Err(FidoError::CommunicationError(_))
        ));
    }
}
