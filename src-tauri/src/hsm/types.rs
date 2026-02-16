use serde::{Deserialize, Serialize};

// === HSM 裝置資訊 ===

/// HSM 裝置詳細資訊
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsmDeviceInfo {
    pub firmware_version: String,
    pub serial_number: String,
    pub free_memory: u64,
    pub used_memory: u64,
    pub total_memory: u64,
    pub file_count: u32,
}

// === HSM 金鑰相關 ===

/// HSM 金鑰類型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HsmKeyType {
    Rsa,
    Ec { curve: String },
    Aes,
}

/// HSM 金鑰資訊
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsmKeyInfo {
    pub key_ref: u8,
    pub id: u8,
    pub label: String,
    pub key_type: HsmKeyType,
    pub key_size: u16,
    pub usage: Vec<String>,
}

/// 金鑰物件類型（用於刪除操作）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyObjectType {
    PrivateKey,
    PublicKey,
    SecretKey,
    Certificate,
}

// === HSM 憑證相關 ===

/// HSM X.509 憑證資訊
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsmCertInfo {
    pub id: u8,
    pub subject: String,
    pub issuer: String,
    pub not_before: String,
    pub not_after: String,
    pub key_id: Option<u8>,
}

// === DKEK 備份相關 ===

/// DKEK 份額狀態
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DkekStatus {
    pub total_shares: u8,
    pub imported_shares: u8,
    pub remaining_shares: u8,
    pub key_check_value: Option<String>,
}

// === HSM 裝置選項 ===

/// HSM 裝置選項狀態
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsmOptions {
    pub press_to_confirm: bool,
    pub key_usage_counter: bool,
}

/// HSM 選項類型（用於設定操作）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HsmOptionType {
    PressToConfirm,
    KeyUsageCounter,
}

// === APDU 協定 ===

/// APDU 指令結構
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApduCommand {
    pub cla: u8,
    pub ins: u8,
    pub p1: u8,
    pub p2: u8,
    pub data: Option<Vec<u8>>,
    pub le: Option<u16>,
}

/// APDU 回應結構
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ApduResponse {
    pub data: Vec<u8>,
    pub sw1: u8,
    pub sw2: u8,
}
