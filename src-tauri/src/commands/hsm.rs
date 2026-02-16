use std::sync::Arc;

use crate::hsm::types::{DkekStatus, HsmCertInfo, HsmDeviceInfo, HsmKeyInfo, HsmOptionType, HsmOptions, KeyObjectType};
use crate::hsm::{HsmModule, HsmModuleImpl};
use crate::types::LedConfig;

// === 初始化 ===

#[tauri::command]
pub fn hsm_initialize(
    pin: String,
    so_pin: String,
    dkek_shares: u8,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.initialize(&pin, &so_pin, dkek_shares)
        .map_err(|e| e.to_string())
}

// === PIN 管理 ===

#[tauri::command]
pub fn hsm_verify_pin(
    pin: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.verify_pin(&pin).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_change_pin(
    old_pin: String,
    new_pin: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.change_pin(&old_pin, &new_pin)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_change_so_pin(
    old_so_pin: String,
    new_so_pin: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.change_so_pin(&old_so_pin, &new_so_pin)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_unblock_pin(
    so_pin: String,
    new_pin: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.unblock_pin(&so_pin, &new_pin)
        .map_err(|e| e.to_string())
}

// === 金鑰管理 ===

#[tauri::command]
pub fn hsm_list_keys(
    pin: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<Vec<HsmKeyInfo>, String> {
    hsm.list_keys(&pin).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_generate_rsa_key(
    pin: String,
    bits: u16,
    id: u8,
    label: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<HsmKeyInfo, String> {
    hsm.generate_rsa_key(&pin, bits, id, &label)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_generate_ec_key(
    pin: String,
    curve: String,
    id: u8,
    label: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<HsmKeyInfo, String> {
    hsm.generate_ec_key(&pin, &curve, id, &label)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_generate_aes_key(
    pin: String,
    bits: u16,
    id: u8,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<HsmKeyInfo, String> {
    hsm.generate_aes_key(&pin, bits, id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_delete_key(
    pin: String,
    id: u8,
    key_type: KeyObjectType,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.delete_key(&pin, id, key_type)
        .map_err(|e| e.to_string())
}

// === 憑證管理 ===

#[tauri::command]
pub fn hsm_list_certificates(
    pin: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<Vec<HsmCertInfo>, String> {
    hsm.list_certificates(&pin).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_import_certificate(
    pin: String,
    id: u8,
    cert_data: Vec<u8>,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.import_certificate(&pin, id, &cert_data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_export_certificate(
    id: u8,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<Vec<u8>, String> {
    hsm.export_certificate(id).map_err(|e| e.to_string())
}

// === DKEK 備份還原 ===

#[tauri::command]
pub fn hsm_create_dkek_share(
    password: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<Vec<u8>, String> {
    hsm.create_dkek_share(&password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_import_dkek_share(
    share_data: Vec<u8>,
    password: String,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<DkekStatus, String> {
    hsm.import_dkek_share(&share_data, &password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_wrap_key(
    pin: String,
    key_ref: u8,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<Vec<u8>, String> {
    hsm.wrap_key(&pin, key_ref).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_unwrap_key(
    pin: String,
    key_ref: u8,
    wrapped: Vec<u8>,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.unwrap_key(&pin, key_ref, &wrapped)
        .map_err(|e| e.to_string())
}

// === 裝置選項與組態 ===

#[tauri::command]
pub fn hsm_get_options(
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<HsmOptions, String> {
    hsm.get_options().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_set_option(
    option: HsmOptionType,
    enabled: bool,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.set_option(option, enabled).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_set_datetime(
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.set_datetime().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_get_device_info(
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<HsmDeviceInfo, String> {
    hsm.get_device_info().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_enable_secure_lock(
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.enable_secure_lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_disable_secure_lock(
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.disable_secure_lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hsm_set_led_config(
    config: LedConfig,
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<(), String> {
    hsm.set_led_config(&config).map_err(|e| e.to_string())
}

// === 診斷 ===

#[tauri::command]
pub fn hsm_debug_device_raw(
    hsm: tauri::State<'_, Arc<HsmModuleImpl>>,
) -> Result<Vec<String>, String> {
    hsm.debug_device_raw().map_err(|e| e.to_string())
}
