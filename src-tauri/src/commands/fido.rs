use std::sync::Arc;

use crate::fido::types::OathCredentialParams;
use crate::fido::{FidoModule, FidoModuleImpl};
use crate::types::LedConfig;

#[tauri::command]
pub fn fido_get_info(
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<crate::fido::types::FidoDeviceInfo, String> {
    fido.get_info().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_set_pin(
    new_pin: String,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.set_pin(&new_pin).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_change_pin(
    old_pin: String,
    new_pin: String,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.change_pin(&old_pin, &new_pin)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_list_credentials(
    pin: String,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<Vec<crate::fido::types::FidoCredential>, String> {
    fido.list_credentials(&pin).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_delete_credential(
    pin: String,
    credential_id: Vec<u8>,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.delete_credential(&pin, &credential_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_list_oath(
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<Vec<crate::fido::types::OathCredential>, String> {
    fido.list_oath_credentials().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_calculate_oath(
    credential_id: String,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<String, String> {
    fido.calculate_oath(&credential_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_add_oath(
    credential: OathCredentialParams,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.add_oath_credential(&credential)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_delete_oath(
    credential_id: String,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.delete_oath_credential(&credential_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_get_backup_words(
    pin: String,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<Vec<String>, String> {
    fido.get_backup_words(&pin).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_restore_from_words(
    pin: String,
    words: Vec<String>,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.restore_from_words(&pin, &words)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_reset_device(
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.reset_device().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_set_min_pin_length(
    pin: String,
    length: u8,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.set_min_pin_length(&pin, length)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_toggle_enterprise_attestation(
    pin: String,
    enable: bool,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.toggle_enterprise_attestation(&pin, enable)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fido_set_led_config(
    config: LedConfig,
    fido: tauri::State<'_, Arc<FidoModuleImpl>>,
) -> Result<(), String> {
    fido.set_led_config(&config).map_err(|e| e.to_string())
}
