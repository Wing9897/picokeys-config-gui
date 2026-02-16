use serde::{Deserialize, Serialize};

/// 裝置類型列舉
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeviceType {
    PicoFido,
    PicoHsm,
}

/// 裝置基本資訊（共用於 FIDO 與 HSM）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub device_type: DeviceType,
    pub serial: String,
    pub firmware_version: String,
    pub path: String,
}

/// LED 組態設定（共用於 FIDO 與 HSM）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedConfig {
    pub gpio: Option<u8>,
    pub brightness: Option<u8>,
    pub dimmable: Option<bool>,
    pub color: Option<String>,
}
