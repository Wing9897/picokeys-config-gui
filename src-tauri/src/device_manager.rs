use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::Emitter;

use crate::error::DeviceError;
use crate::types::{DeviceInfo, DeviceType};

// Pico-FIDO HID 裝置識別
// 預設 VID/PID (Raspberry Pi Foundation)
const PICO_FIDO_VID: u16 = 0x2E8A;
const PICO_FIDO_PID: u16 = 0x10FE;
// Nitrokey FIDO2 VID/PID (使用 VIDPID=NitroFIDO2 編譯時)
const NITROKEY_FIDO_VID: u16 = 0x20A0;
const NITROKEY_FIDO_PID: u16 = 0x42B2;

// SmartCard-HSM 歷史位元組中的應用識別字串 "THSM"
const HSM_ATR_MARKER: &[u8] = &[0x54, 0x48, 0x53, 0x4D]; // "THSM"

/// DeviceManager trait — 裝置偵測、開啟與關閉
pub trait DeviceManager {
    /// 掃描所有已連接的 Pico 裝置
    fn scan_devices(&self) -> Result<Vec<DeviceInfo>, DeviceError>;
    /// 開啟指定裝置的連線
    fn open_device(&self, path: &str) -> Result<(), DeviceError>;
    /// 關閉裝置連線
    fn close_device(&self, path: &str) -> Result<(), DeviceError>;
}

/// DeviceManager 實作
pub struct DeviceManagerImpl {
    opened_devices: Mutex<HashSet<String>>,
}

impl DeviceManagerImpl {
    pub fn new() -> Self {
        Self {
            opened_devices: Mutex::new(HashSet::new()),
        }
    }

    /// 透過 hidapi 掃描 HID 裝置，篩選 Pico-FIDO
    fn scan_hid_devices(&self) -> Result<Vec<DeviceInfo>, DeviceError> {
        let api = hidapi::HidApi::new().map_err(|e| {
            DeviceError::OpenFailed(format!("HID API 初始化失敗: {e}"))
        })?;

        let devices = api
            .device_list()
            .filter(|dev| {
                let vid = dev.vendor_id();
                let pid = dev.product_id();
                (vid == PICO_FIDO_VID && pid == PICO_FIDO_PID)
                    || (vid == NITROKEY_FIDO_VID && pid == NITROKEY_FIDO_PID)
            })
            .map(|dev| {
                let path = dev.path().to_string_lossy().into_owned();
                let serial = dev
                    .serial_number()
                    .unwrap_or("")
                    .to_string();
                let firmware_version = read_hid_firmware_version(&api, dev);

                DeviceInfo {
                    device_type: DeviceType::PicoFido,
                    serial,
                    firmware_version,
                    path,
                }
            })
            .collect();

        Ok(devices)
    }

    /// 透過 pcsc 掃描 CCID 裝置，篩選 Pico-HSM
    fn scan_ccid_devices(&self) -> Result<Vec<DeviceInfo>, DeviceError> {
        let ctx = pcsc::Context::establish(pcsc::Scope::User).map_err(|e| {
            DeviceError::OpenFailed(format!("PC/SC context 建立失敗: {e}"))
        })?;

        let readers_buf_len = ctx.list_readers_len().map_err(|e| {
            DeviceError::OpenFailed(format!("無法取得讀卡機列表長度: {e}"))
        })?;

        let mut readers_buf = vec![0u8; readers_buf_len];
        let readers = match ctx.list_readers(&mut readers_buf) {
            Ok(r) => r,
            Err(pcsc::Error::NoReadersAvailable) => return Ok(Vec::new()),
            Err(e) => {
                return Err(DeviceError::OpenFailed(format!(
                    "無法列出讀卡機: {e}"
                )));
            }
        };

        let mut devices = Vec::new();

        for reader in readers {
            let card = match ctx.connect(reader, pcsc::ShareMode::Shared, pcsc::Protocols::ANY) {
                Ok(c) => c,
                Err(_) => continue, // 無法連線的讀卡機跳過
            };

            // 取得 ATR
            let mut atr_buf = [0u8; pcsc::MAX_ATR_SIZE];
            let atr_len = match card_atr(&card, &mut atr_buf) {
                Some(len) => len,
                None => continue,
            };
            let atr = &atr_buf[..atr_len];

            // 比對 SmartCard-HSM ATR：搜尋歷史位元組中的 "THSM" 標識
            if !atr_contains_marker(atr, HSM_ATR_MARKER) {
                continue;
            }

            let path = reader.to_string_lossy().into_owned();
            let (firmware_version, serial) = read_hsm_info_from_atr(atr);

            devices.push(DeviceInfo {
                device_type: DeviceType::PicoHsm,
                serial,
                firmware_version,
                path,
            });
        }

        Ok(devices)
    }
}

impl DeviceManager for DeviceManagerImpl {
    fn scan_devices(&self) -> Result<Vec<DeviceInfo>, DeviceError> {
        let mut all_devices = Vec::new();

        // 掃描 HID (Pico-FIDO)
        match self.scan_hid_devices() {
            Ok(devs) => all_devices.extend(devs),
            Err(_) => { /* HID 不可用時靜默跳過 */ }
        }

        // 掃描 CCID (Pico-HSM)
        match self.scan_ccid_devices() {
            Ok(devs) => all_devices.extend(devs),
            Err(_) => { /* PC/SC 不可用時靜默跳過 */ }
        }

        Ok(all_devices)
    }

    fn open_device(&self, path: &str) -> Result<(), DeviceError> {
        let mut opened = self
            .opened_devices
            .lock()
            .map_err(|_| DeviceError::OpenFailed("內部鎖定錯誤".into()))?;

        // 已開啟的裝置直接成功回傳（允許重複選擇）
        if opened.contains(path) {
            return Ok(());
        }

        // 驗證裝置路徑存在（嘗試掃描確認）
        let all = self.scan_devices()?;
        if !all.iter().any(|d| d.path == path) {
            return Err(DeviceError::NotFound(path.to_string()));
        }

        opened.insert(path.to_string());
        Ok(())
    }

    fn close_device(&self, path: &str) -> Result<(), DeviceError> {
        let mut opened = self
            .opened_devices
            .lock()
            .map_err(|_| DeviceError::OpenFailed("內部鎖定錯誤".into()))?;

        if !opened.remove(path) {
            return Err(DeviceError::NotFound(path.to_string()));
        }

        Ok(())
    }
}

/// 嘗試從 HID 裝置讀取韌體版本（透過 CTAP GetInfo）。
/// 若無法取得則回傳 "unknown"。
fn read_hid_firmware_version(api: &hidapi::HidApi, dev: &hidapi::DeviceInfo) -> String {
    // 嘗試開啟裝置並送出 CTAP authenticatorGetInfo (0x04)
    let device = match api.open_path(dev.path()) {
        Ok(d) => d,
        Err(_) => return "unknown".to_string(),
    };

    // CTAP HID init + GetInfo 需要完整 CTAPHID 封包，
    // 此處簡化：使用 product_string 或 release_number 作為版本資訊
    let version = dev.release_number();
    if version > 0 {
        let major = (version >> 8) & 0xFF;
        let minor = version & 0xFF;
        // 確保 device 被使用以避免 unused 警告
        drop(device);
        format!("{major}.{minor}")
    } else {
        drop(device);
        "unknown".to_string()
    }
}

/// 檢查 ATR 是否包含指定的標記位元組序列
fn atr_contains_marker(atr: &[u8], marker: &[u8]) -> bool {
    atr.windows(marker.len()).any(|w| w == marker)
}

/// 從智慧卡取得 ATR，回傳 ATR 長度
fn card_atr(card: &pcsc::Card, buf: &mut [u8; pcsc::MAX_ATR_SIZE]) -> Option<usize> {
    let mut reader_names_buf = [0u8; 256];
    let status = card
        .status2(&mut reader_names_buf, buf)
        .ok()?;
    Some(status.atr().len())
}

/// 從 ATR 解析 Pico-HSM 韌體版本與序號。
/// SmartCard-HSM ATR 格式中，歷史位元組包含版本資訊。
fn read_hsm_info_from_atr(atr: &[u8]) -> (String, String) {
    // SmartCard-HSM ATR 典型格式:
    // 3B FE 18 00 00 81 31 FE 45 80 31 81 54 48 53 4D 31 73 80 21 40 81 07 FA
    // 歷史位元組從 index 7 開始
    let firmware_version = if atr.len() >= 23 {
        // 版本位元組通常在 ATR 尾部附近
        let major = atr.get(20).copied().unwrap_or(0);
        let minor = atr.get(21).copied().unwrap_or(0);
        if major > 0 {
            format!("{major}.{minor}")
        } else {
            "unknown".to_string()
        }
    } else {
        "unknown".to_string()
    };

    // 序號需要透過 APDU 指令取得，ATR 中不包含
    // 此處先回傳空字串，後續可透過 SELECT + GET DATA 取得
    let serial = String::new();

    (firmware_version, serial)
}

/// 診斷用：列出所有 HID 裝置（VID:PID 與名稱）
pub fn debug_list_hid_devices() -> Result<Vec<String>, DeviceError> {
    let api = hidapi::HidApi::new().map_err(|e| {
        DeviceError::OpenFailed(format!("HID API 初始化失敗: {e}"))
    })?;

    let mut results: Vec<String> = Vec::new();
    for dev in api.device_list() {
        let vid = dev.vendor_id();
        let pid = dev.product_id();
        let product = dev.product_string().unwrap_or("(unknown)");
        let serial = dev.serial_number().unwrap_or("(none)");
        let is_pico = (vid == PICO_FIDO_VID && pid == PICO_FIDO_PID)
            || (vid == NITROKEY_FIDO_VID && pid == NITROKEY_FIDO_PID);
        results.push(format!(
            "{vid:04X}:{pid:04X} {product} SN={serial} PICO_FIDO={is_pico}"
        ));
    }

    if results.is_empty() {
        results.push("(no HID devices found)".to_string());
    }

    Ok(results)
}

/// 診斷用：列出所有 PC/SC 讀卡機及其 ATR（十六進位字串）
pub fn debug_list_readers() -> Result<Vec<String>, DeviceError> {
    let ctx = pcsc::Context::establish(pcsc::Scope::User).map_err(|e| {
        DeviceError::OpenFailed(format!("PC/SC context 建立失敗: {e}"))
    })?;

    let readers_buf_len = ctx.list_readers_len().map_err(|e| {
        DeviceError::OpenFailed(format!("無法取得讀卡機列表長度: {e}"))
    })?;

    let mut readers_buf = vec![0u8; readers_buf_len];
    let readers = match ctx.list_readers(&mut readers_buf) {
        Ok(r) => r,
        Err(pcsc::Error::NoReadersAvailable) => return Ok(vec!["(no readers available)".to_string()]),
        Err(e) => {
            return Err(DeviceError::OpenFailed(format!(
                "無法列出讀卡機: {e}"
            )));
        }
    };

    let mut results = Vec::new();

    for reader in readers {
        let name = reader.to_string_lossy().into_owned();
        let card = match ctx.connect(reader, pcsc::ShareMode::Shared, pcsc::Protocols::ANY) {
            Ok(c) => c,
            Err(e) => {
                results.push(format!("{name} -> connect error: {e}"));
                continue;
            }
        };

        let mut atr_buf = [0u8; pcsc::MAX_ATR_SIZE];
        match card_atr(&card, &mut atr_buf) {
            Some(len) => {
                let atr = &atr_buf[..len];
                let hex: Vec<String> = atr.iter().map(|b| format!("{b:02X}")).collect();
                let has_thsm = atr_contains_marker(atr, HSM_ATR_MARKER);
                results.push(format!(
                    "{name} -> ATR[{}]: {} | THSM={has_thsm}",
                    len,
                    hex.join(" ")
                ));
            }
            None => {
                results.push(format!("{name} -> ATR: (unable to read)"));
            }
        }
    }

    if results.is_empty() {
        results.push("(no readers found)".to_string());
    }

    Ok(results)
}

/// 檢查 Windows Smart Card 服務狀態。
/// 回傳: "running", "stopped", "disabled", "not_found", 或 "not_windows"
pub fn check_scard_service_status() -> String {
    #[cfg(target_os = "windows")]
    {
        // 使用 sc query 查詢服務狀態
        let output = std::process::Command::new("sc")
            .args(["query", "SCardSvr"])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if stdout.contains("RUNNING") {
                    return "running".to_string();
                }
                if stdout.contains("STOPPED") {
                    // 進一步檢查是否被 disabled
                    let qc = std::process::Command::new("sc")
                        .args(["qc", "SCardSvr"])
                        .output();
                    if let Ok(qc_out) = qc {
                        let qc_str = String::from_utf8_lossy(&qc_out.stdout);
                        if qc_str.contains("DISABLED") {
                            return "disabled".to_string();
                        }
                    }
                    return "stopped".to_string();
                }
                "stopped".to_string()
            }
            Err(_) => "not_found".to_string(),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        // macOS/Linux 不需要此服務，PC/SC 由 pcscd 管理
        "not_windows".to_string()
    }
}

/// 比較兩個裝置列表是否有變更（以 path 為比較基準）
fn devices_changed(previous: &[DeviceInfo], current: &[DeviceInfo]) -> bool {
    if previous.len() != current.len() {
        return true;
    }
    let prev_paths: HashSet<&str> = previous.iter().map(|d| d.path.as_str()).collect();
    let curr_paths: HashSet<&str> = current.iter().map(|d| d.path.as_str()).collect();
    prev_paths != curr_paths
}

/// 啟動背景裝置輪詢，偵測裝置插入與拔除。
/// 每 2 秒掃描一次，若裝置列表有變更則透過 Tauri 事件 `"device-changed"` 通知前端。
pub fn start_device_polling(app: tauri::AppHandle, device_manager: Arc<DeviceManagerImpl>) {
    std::thread::spawn(move || {
        let mut previous_devices: Vec<DeviceInfo> = Vec::new();
        loop {
            std::thread::sleep(Duration::from_secs(2));
            if let Ok(current) = device_manager.scan_devices() {
                if devices_changed(&previous_devices, &current) {
                    let _ = app.emit("device-changed", &current);
                    previous_devices = current;
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_manager_new() {
        let dm = DeviceManagerImpl::new();
        let opened = dm.opened_devices.lock().unwrap();
        assert!(opened.is_empty());
    }

    #[test]
    fn test_hsm_atr_marker_constant() {
        assert_eq!(HSM_ATR_MARKER, &[0x54, 0x48, 0x53, 0x4D]); // "THSM"
    }

    #[test]
    fn test_read_hsm_info_from_atr_valid() {
        let atr: Vec<u8> = vec![
            0x3B, 0xFE, 0x18, 0x00, 0x00, 0x81, 0x31, 0xFE, 0x45, 0x80,
            0x31, 0x81, 0x54, 0x48, 0x53, 0x4D, 0x31, 0x73, 0x80, 0x21,
            0x03, 0x05, 0x07, 0xFA,
        ];
        let (version, serial) = read_hsm_info_from_atr(&atr);
        assert_eq!(version, "3.5");
        assert!(serial.is_empty()); // 序號需透過 APDU 取得
    }

    #[test]
    fn test_read_hsm_info_from_atr_short() {
        let atr: Vec<u8> = vec![0x3B, 0xFE, 0x18];
        let (version, _serial) = read_hsm_info_from_atr(&atr);
        assert_eq!(version, "unknown");
    }

    #[test]
    fn test_pico_fido_constants() {
        // 預設 Raspberry Pi Foundation VID/PID
        assert_eq!(PICO_FIDO_VID, 0x2E8A);
        assert_eq!(PICO_FIDO_PID, 0x10FE);
        // Nitrokey FIDO2 VID/PID
        assert_eq!(NITROKEY_FIDO_VID, 0x20A0);
        assert_eq!(NITROKEY_FIDO_PID, 0x42B2);
    }

    fn make_device(path: &str, device_type: DeviceType) -> DeviceInfo {
        DeviceInfo {
            device_type,
            serial: String::new(),
            firmware_version: "1.0".to_string(),
            path: path.to_string(),
        }
    }

    #[test]
    fn test_devices_changed_empty_to_empty() {
        assert!(!devices_changed(&[], &[]));
    }

    #[test]
    fn test_devices_changed_added() {
        let current = vec![make_device("/dev/hid0", DeviceType::PicoFido)];
        assert!(devices_changed(&[], &current));
    }

    #[test]
    fn test_devices_changed_removed() {
        let previous = vec![make_device("/dev/hid0", DeviceType::PicoFido)];
        assert!(devices_changed(&previous, &[]));
    }

    #[test]
    fn test_devices_changed_same() {
        let a = vec![
            make_device("/dev/hid0", DeviceType::PicoFido),
            make_device("/dev/reader0", DeviceType::PicoHsm),
        ];
        let b = vec![
            make_device("/dev/hid0", DeviceType::PicoFido),
            make_device("/dev/reader0", DeviceType::PicoHsm),
        ];
        assert!(!devices_changed(&a, &b));
    }

    #[test]
    fn test_devices_changed_different_paths() {
        let a = vec![make_device("/dev/hid0", DeviceType::PicoFido)];
        let b = vec![make_device("/dev/hid1", DeviceType::PicoFido)];
        assert!(devices_changed(&a, &b));
    }

    #[test]
    fn test_devices_changed_order_independent() {
        let a = vec![
            make_device("/dev/hid0", DeviceType::PicoFido),
            make_device("/dev/reader0", DeviceType::PicoHsm),
        ];
        let b = vec![
            make_device("/dev/reader0", DeviceType::PicoHsm),
            make_device("/dev/hid0", DeviceType::PicoFido),
        ];
        assert!(!devices_changed(&a, &b));
    }
}
