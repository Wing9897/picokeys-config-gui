use serde::Serialize;

/// 裝置管理錯誤
#[derive(Debug, thiserror::Error, Serialize)]
pub enum DeviceError {
    #[error("裝置未找到: {0}")]
    NotFound(String),

    #[error("USB 通訊中斷")]
    ConnectionLost,

    #[error("裝置操作逾時")]
    Timeout,

    #[error("裝置開啟失敗: {0}")]
    OpenFailed(String),

    #[error("裝置已被佔用")]
    DeviceBusy,

    #[error("不支援的裝置類型")]
    UnsupportedDevice,
}

/// FIDO (CTAP) 模組錯誤
#[derive(Debug, thiserror::Error, Serialize)]
pub enum FidoError {
    #[error("CTAP 錯誤碼: 0x{0:02X}")]
    CtapError(u8),

    #[error("PIN 驗證失敗，剩餘重試次數: {0}")]
    PinInvalid(u8),

    #[error("PIN 已鎖定，裝置需要重設")]
    PinLocked,

    #[error("PIN 長度不符合規範 (需 4-63 位元組)")]
    PinLengthInvalid,

    #[error("裝置不支援此功能")]
    NotSupported,

    #[error("裝置通訊錯誤: {0}")]
    CommunicationError(String),

    #[error("操作逾時")]
    Timeout,

    #[error("CBOR 編解碼錯誤: {0}")]
    CborError(String),
}

/// HSM (APDU) 模組錯誤
#[derive(Debug, thiserror::Error, Serialize)]
pub enum HsmError {
    #[error("APDU 狀態碼錯誤: SW=0x{0:02X}{1:02X}")]
    StatusError(u8, u8),

    #[error("PIN 驗證失敗，剩餘重試次數: {0}")]
    PinInvalid(u8),

    #[error("PIN 已鎖定")]
    PinLocked,

    #[error("SO-PIN 驗證失敗")]
    SoPinInvalid,

    #[error("SO-PIN 已鎖定，裝置需要重新初始化")]
    SoPinLocked,

    #[error("PIN 格式不符合規範 (需 6-16 字元)")]
    PinFormatInvalid,

    #[error("SO-PIN 格式不符合規範 (需 16 個十六進位字元)")]
    SoPinFormatInvalid,

    #[error("金鑰未找到: ID={0}")]
    KeyNotFound(u8),

    #[error("憑證未找到: ID={0}")]
    CertificateNotFound(u8),

    #[error("DKEK 尚未初始化")]
    DkekNotInitialized,

    #[error("裝置未初始化")]
    DeviceNotInitialized,

    #[error("裝置通訊錯誤: {0}")]
    CommunicationError(String),

    #[error("操作逾時")]
    Timeout,

    #[error("不支援的操作")]
    NotSupported,
}

/// CBOR 編解碼錯誤
#[derive(Debug, thiserror::Error, Serialize)]
pub enum CborError {
    #[error("CBOR 編碼失敗: {0}")]
    EncodingError(String),

    #[error("CBOR 解碼失敗: {0}")]
    DecodingError(String),

    #[error("非預期的 CBOR 資料格式")]
    UnexpectedFormat,
}

/// APDU 編解碼錯誤
#[derive(Debug, thiserror::Error, Serialize)]
pub enum ApduError {
    #[error("APDU 回應資料不完整 (長度: {0})")]
    IncompleteResponse(usize),

    #[error("APDU 編碼失敗: {0}")]
    EncodingError(String),

    #[error("非預期的狀態碼: SW=0x{0:02X}{1:02X}")]
    UnexpectedStatus(u8, u8),
}
