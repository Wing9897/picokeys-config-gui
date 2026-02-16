use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// === FIDO 裝置資訊 ===

/// FIDO 裝置詳細資訊（來自 authenticatorGetInfo）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FidoDeviceInfo {
    pub versions: Vec<String>,
    pub extensions: Vec<String>,
    pub aaguid: String,
    pub firmware_version: String,
    pub serial_number: Option<String>,
    pub pin_set: bool,
    pub pin_retries: u8,
    pub options: HashMap<String, bool>,
}

// === FIDO 憑證 ===

/// FIDO 可發現憑證
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FidoCredential {
    pub credential_id: Vec<u8>,
    pub rp_id: String,
    pub rp_name: Option<String>,
    pub user_name: Option<String>,
    pub user_display_name: Option<String>,
    pub creation_time: Option<u64>,
}

// === OATH 相關 ===

/// OATH 憑證類型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OathType {
    Totp,
    Hotp,
}

/// OATH 憑證資訊
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OathCredential {
    pub id: String,
    pub issuer: Option<String>,
    pub account: String,
    pub oath_type: OathType,
    pub period: Option<u32>,
}

/// OATH 憑證新增參數
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OathCredentialParams {
    pub secret: Vec<u8>,
    pub issuer: String,
    pub account: String,
    pub oath_type: OathType,
    pub digits: u8,
    pub period: Option<u32>,
    pub counter: Option<u64>,
}

// === CTAP 協定 ===

/// ClientPin 子指令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClientPinSubCommand {
    GetRetries,
    GetKeyAgreement,
    SetPin,
    ChangePin,
    GetPinToken,
}

/// 憑證管理子指令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CredMgmtSubCommand {
    GetCredsMetadata,
    EnumerateRPsBegin,
    EnumerateRPsNext,
    EnumerateCredentialsBegin,
    EnumerateCredentialsNext,
    DeleteCredential,
}

/// 認證器組態子指令
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthConfigSubCommand {
    EnableEnterpriseAttestation,
    ToggleAlwaysUv,
    SetMinPinLength,
}

/// CTAP 指令列舉
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CtapCommand {
    MakeCredential,
    GetAssertion,
    GetInfo,
    ClientPin(ClientPinSubCommand),
    CredentialManagement(CredMgmtSubCommand),
    AuthenticatorConfig(AuthConfigSubCommand),
    Reset,
    Selection,
}

/// ClientPin 回應
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientPinResponse {
    pub key_agreement: Option<Vec<u8>>,
    pub pin_token: Option<Vec<u8>>,
    pub retries: Option<u8>,
}

/// 憑證管理回應
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredMgmtResponse {
    pub credentials: Vec<FidoCredential>,
    pub total_credentials: Option<u32>,
}

/// CTAP 回應列舉
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CtapResponse {
    GetInfo(FidoDeviceInfo),
    ClientPin(ClientPinResponse),
    CredentialManagement(CredMgmtResponse),
    Error(u8),
    Success,
}
