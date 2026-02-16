pub mod commands;
pub mod device_manager;
pub mod error;
pub mod fido;
pub mod hsm;
pub mod types;

use std::sync::Arc;

use crate::commands::device::{check_scard_service, list_all_readers, open_device, scan_devices};
use crate::commands::fido::{
    fido_add_oath, fido_calculate_oath, fido_change_pin, fido_delete_credential,
    fido_delete_oath, fido_get_backup_words, fido_get_info, fido_list_credentials,
    fido_list_oath, fido_reset_device, fido_restore_from_words, fido_set_led_config,
    fido_set_min_pin_length, fido_set_pin, fido_toggle_enterprise_attestation,
};
use crate::commands::hsm::{
    hsm_change_pin, hsm_change_so_pin, hsm_create_dkek_share, hsm_debug_device_raw,
    hsm_delete_key, hsm_disable_secure_lock, hsm_enable_secure_lock,
    hsm_export_certificate, hsm_generate_aes_key, hsm_generate_ec_key,
    hsm_generate_rsa_key, hsm_get_device_info, hsm_get_options, hsm_import_certificate,
    hsm_import_dkek_share, hsm_initialize, hsm_list_certificates, hsm_list_keys,
    hsm_set_datetime, hsm_set_led_config, hsm_set_option, hsm_unblock_pin,
    hsm_unwrap_key, hsm_verify_pin, hsm_wrap_key,
};
use crate::device_manager::{start_device_polling, DeviceManagerImpl};
use crate::fido::FidoModuleImpl;
use crate::hsm::HsmModuleImpl;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let device_manager = Arc::new(DeviceManagerImpl::new());
    let fido_module = Arc::new(FidoModuleImpl::new(String::new()));
    let hsm_module = Arc::new(HsmModuleImpl::new(String::new()));

    // Clone for the polling background task
    let dm_for_polling = Arc::clone(&device_manager);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(device_manager)
        .manage(fido_module)
        .manage(hsm_module)
        .invoke_handler(tauri::generate_handler![
            // Device management
            scan_devices,
            open_device,
            list_all_readers,
            check_scard_service,
            // FIDO commands
            fido_get_info,
            fido_set_pin,
            fido_change_pin,
            fido_list_credentials,
            fido_delete_credential,
            fido_list_oath,
            fido_calculate_oath,
            fido_add_oath,
            fido_delete_oath,
            fido_get_backup_words,
            fido_restore_from_words,
            fido_reset_device,
            fido_set_min_pin_length,
            fido_toggle_enterprise_attestation,
            fido_set_led_config,
            // HSM commands
            hsm_initialize,
            hsm_verify_pin,
            hsm_change_pin,
            hsm_change_so_pin,
            hsm_unblock_pin,
            hsm_list_keys,
            hsm_generate_rsa_key,
            hsm_generate_ec_key,
            hsm_generate_aes_key,
            hsm_delete_key,
            hsm_list_certificates,
            hsm_import_certificate,
            hsm_export_certificate,
            hsm_create_dkek_share,
            hsm_import_dkek_share,
            hsm_wrap_key,
            hsm_unwrap_key,
            hsm_get_options,
            hsm_set_option,
            hsm_set_datetime,
            hsm_get_device_info,
            hsm_enable_secure_lock,
            hsm_disable_secure_lock,
            hsm_set_led_config,
            hsm_debug_device_raw,
        ])
        .setup(move |app| {
            // Start background device polling for hot-plug detection
            start_device_polling(app.handle().clone(), dm_for_polling);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
