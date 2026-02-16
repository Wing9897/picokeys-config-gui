use std::sync::Arc;

use crate::device_manager::{check_scard_service_status, debug_list_hid_devices, debug_list_readers, DeviceManager, DeviceManagerImpl};
use crate::fido::FidoModuleImpl;
use crate::hsm::HsmModuleImpl;
use crate::types::DeviceInfo;

#[tauri::command]
pub fn scan_devices(
    device_manager: tauri::State<'_, Arc<DeviceManagerImpl>>,
) -> Result<Vec<DeviceInfo>, String> {
    device_manager.scan_devices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_device(
    path: String,
    device_manager: tauri::State<'_, Arc<DeviceManagerImpl>>,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    device_manager.open_device(&path).map_err(|e| e.to_string())?;

    // 根據裝置類型設定對應模組的路徑
    let devices = device_manager.scan_devices().map_err(|e| e.to_string())?;
    if let Some(dev) = devices.iter().find(|d| d.path == path) {
        match dev.device_type {
            crate::types::DeviceType::PicoFido => fido.set_device_path(&path),
            crate::types::DeviceType::PicoHsm => hsm.set_device_path(&path),
        }
    }

    Ok(())
}

/// 診斷用：列出所有 PC/SC 讀卡機及其 ATR（十六進位）+ HID 裝置
#[tauri::command]
pub fn list_all_readers() -> Result<Vec<String>, String> {
    let mut results = Vec::new();

    // HID 裝置
    results.push("=== HID Devices ===".to_string());
    match debug_list_hid_devices() {
        Ok(hid) => results.extend(hid),
        Err(e) => results.push(format!("HID error: {e}")),
    }

    // PC/SC 讀卡機
    results.push("=== PC/SC Readers ===".to_string());
    match debug_list_readers() {
        Ok(pcsc) => results.extend(pcsc),
        Err(e) => results.push(format!("PC/SC error: {e}")),
    }

    Ok(results)
}

/// 檢查 Smart Card 服務狀態
#[tauri::command]
pub fn check_scard_service() -> String {
    check_scard_service_status()
}
