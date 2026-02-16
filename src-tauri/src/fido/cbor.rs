use crate::error::{CborError, FidoError};
use crate::fido::types::{CtapCommand, CtapResponse};

/// CTAP 指令的 CBOR 編解碼器 trait
pub trait CborCodec {
    /// 將 CtapCommand 序列化為 CTAP 協定位元組（指令碼 + CBOR 參數）
    fn encode_ctap_command(&self, cmd: &CtapCommand) -> Result<Vec<u8>, CborError>;
    /// 將 CTAP 回應位元組反序列化為 CtapResponse（狀態碼 + CBOR 資料）
    fn decode_ctap_response(&self, data: &[u8]) -> Result<CtapResponse, CborError>;
}

/// CborCodec 的預設實作
pub struct CborCodecImpl;

impl CborCodecImpl {
    pub fn new() -> Self {
        Self
    }
}

impl Default for CborCodecImpl {
    fn default() -> Self {
        Self::new()
    }
}

impl CborCodec for CborCodecImpl {
    fn encode_ctap_command(&self, cmd: &CtapCommand) -> Result<Vec<u8>, CborError> {
        let (cmd_byte, params) = match cmd {
            CtapCommand::GetInfo => (0x04u8, None),
            CtapCommand::MakeCredential => (0x01, None),
            CtapCommand::GetAssertion => (0x02, None),
            CtapCommand::Reset => (0x07, None),
            CtapCommand::Selection => (0x0B, None),
            CtapCommand::ClientPin(sub) => {
                let cbor = serde_cbor::to_vec(sub)
                    .map_err(|e| CborError::EncodingError(e.to_string()))?;
                (0x06, Some(cbor))
            }
            CtapCommand::CredentialManagement(sub) => {
                let cbor = serde_cbor::to_vec(sub)
                    .map_err(|e| CborError::EncodingError(e.to_string()))?;
                (0x0A, Some(cbor))
            }
            CtapCommand::AuthenticatorConfig(sub) => {
                let cbor = serde_cbor::to_vec(sub)
                    .map_err(|e| CborError::EncodingError(e.to_string()))?;
                (0x0D, Some(cbor))
            }
        };

        let mut buf = vec![cmd_byte];
        if let Some(params) = params {
            buf.extend_from_slice(&params);
        }
        Ok(buf)
    }

    fn decode_ctap_response(&self, data: &[u8]) -> Result<CtapResponse, CborError> {
        if data.is_empty() {
            return Err(CborError::DecodingError(
                "回應資料為空".to_string(),
            ));
        }

        let status = data[0];

        if status != 0x00 {
            return Err(CborError::DecodingError(format!(
                "CTAP 錯誤碼: 0x{:02X}",
                status
            )));
        }

        // 狀態碼 0x00 = 成功
        if data.len() == 1 {
            // 無 payload，回傳 Success
            return Ok(CtapResponse::Success);
        }

        // 有 CBOR payload，嘗試解碼為 GetInfo 回應
        let payload = &data[1..];
        // 目前預設嘗試解碼為通用 CBOR value，回傳 Success
        // 具體的回應解碼需要呼叫端提供上下文
        let _value: serde_cbor::Value = serde_cbor::from_slice(payload)
            .map_err(|e| CborError::DecodingError(e.to_string()))?;

        Ok(CtapResponse::Success)
    }
}

/// 將 CTAP 錯誤碼轉換為 FidoError
pub fn ctap_error_to_fido_error(code: u8) -> FidoError {
    match code {
        0x31 => FidoError::PinInvalid(0),
        0x32 => FidoError::PinLocked,
        0x33 => FidoError::PinLengthInvalid,
        0x36 => FidoError::PinInvalid(0), // PIN auth invalid
        _ => FidoError::CtapError(code),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fido::types::{
        AuthConfigSubCommand, ClientPinSubCommand, CredMgmtSubCommand,
    };

    fn codec() -> CborCodecImpl {
        CborCodecImpl::new()
    }

    // === encode_ctap_command 測試 ===

    #[test]
    fn test_encode_get_info() {
        let result = codec().encode_ctap_command(&CtapCommand::GetInfo).unwrap();
        assert_eq!(result, vec![0x04]);
    }

    #[test]
    fn test_encode_make_credential() {
        let result = codec()
            .encode_ctap_command(&CtapCommand::MakeCredential)
            .unwrap();
        assert_eq!(result, vec![0x01]);
    }

    #[test]
    fn test_encode_get_assertion() {
        let result = codec()
            .encode_ctap_command(&CtapCommand::GetAssertion)
            .unwrap();
        assert_eq!(result, vec![0x02]);
    }

    #[test]
    fn test_encode_reset() {
        let result = codec().encode_ctap_command(&CtapCommand::Reset).unwrap();
        assert_eq!(result, vec![0x07]);
    }

    #[test]
    fn test_encode_selection() {
        let result = codec()
            .encode_ctap_command(&CtapCommand::Selection)
            .unwrap();
        assert_eq!(result, vec![0x0B]);
    }

    #[test]
    fn test_encode_client_pin_has_correct_prefix() {
        let cmd = CtapCommand::ClientPin(ClientPinSubCommand::GetRetries);
        let result = codec().encode_ctap_command(&cmd).unwrap();
        assert_eq!(result[0], 0x06);
        assert!(result.len() > 1);
    }

    #[test]
    fn test_encode_credential_management_has_correct_prefix() {
        let cmd = CtapCommand::CredentialManagement(CredMgmtSubCommand::GetCredsMetadata);
        let result = codec().encode_ctap_command(&cmd).unwrap();
        assert_eq!(result[0], 0x0A);
        assert!(result.len() > 1);
    }

    #[test]
    fn test_encode_authenticator_config_has_correct_prefix() {
        let cmd =
            CtapCommand::AuthenticatorConfig(AuthConfigSubCommand::EnableEnterpriseAttestation);
        let result = codec().encode_ctap_command(&cmd).unwrap();
        assert_eq!(result[0], 0x0D);
        assert!(result.len() > 1);
    }

    // === decode_ctap_response 測試 ===

    #[test]
    fn test_decode_empty_response_error() {
        let result = codec().decode_ctap_response(&[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_success_no_payload() {
        let result = codec().decode_ctap_response(&[0x00]).unwrap();
        assert!(matches!(result, CtapResponse::Success));
    }

    #[test]
    fn test_decode_error_status_code() {
        let result = codec().decode_ctap_response(&[0x31]);
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_success_with_cbor_payload() {
        // 0x00 (success) + CBOR-encoded empty map {}
        let data = vec![0x00, 0xA0];
        let result = codec().decode_ctap_response(&data).unwrap();
        assert!(matches!(result, CtapResponse::Success));
    }

    #[test]
    fn test_decode_invalid_cbor_payload() {
        // 0x00 (success) + invalid CBOR bytes
        let data = vec![0x00, 0xFF, 0xFF];
        let result = codec().decode_ctap_response(&data);
        assert!(result.is_err());
    }

    // === ctap_error_to_fido_error 測試 ===

    #[test]
    fn test_ctap_error_pin_invalid() {
        let err = ctap_error_to_fido_error(0x31);
        assert!(matches!(err, FidoError::PinInvalid(0)));
    }

    #[test]
    fn test_ctap_error_pin_locked() {
        let err = ctap_error_to_fido_error(0x32);
        assert!(matches!(err, FidoError::PinLocked));
    }

    #[test]
    fn test_ctap_error_pin_length_invalid() {
        let err = ctap_error_to_fido_error(0x33);
        assert!(matches!(err, FidoError::PinLengthInvalid));
    }

    #[test]
    fn test_ctap_error_pin_auth_invalid() {
        let err = ctap_error_to_fido_error(0x36);
        assert!(matches!(err, FidoError::PinInvalid(0)));
    }

    #[test]
    fn test_ctap_error_unknown_code() {
        let err = ctap_error_to_fido_error(0x99);
        assert!(matches!(err, FidoError::CtapError(0x99)));
    }
}
