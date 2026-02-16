use crate::error::{ApduError, HsmError};
use crate::hsm::types::{ApduCommand, ApduResponse};

/// APDU 編解碼器 trait
pub trait ApduCodec {
    /// 將 ApduCommand 編碼為位元組序列（支援標準與擴充 APDU）
    fn encode_apdu(&self, cmd: &ApduCommand) -> Vec<u8>;
    /// 從原始位元組解析出 ApduResponse（data + SW1/SW2）
    fn decode_apdu_response(&self, raw: &[u8]) -> Result<ApduResponse, ApduError>;
    /// 將 SW1/SW2 狀態碼對應為 HsmError，成功時回傳 None
    fn status_to_error(&self, sw1: u8, sw2: u8) -> Option<HsmError>;
}

/// ApduCodec 的預設實作
pub struct ApduCodecImpl;

impl ApduCodecImpl {
    pub fn new() -> Self {
        Self
    }

    /// 判斷是否需要使用擴充 APDU 編碼
    fn needs_extended(cmd: &ApduCommand) -> bool {
        let data_len = cmd.data.as_ref().map_or(0, |d| d.len());
        let le = cmd.le.unwrap_or(0);
        data_len > 255 || le > 256
    }
}

impl Default for ApduCodecImpl {
    fn default() -> Self {
        Self::new()
    }
}

impl ApduCodec for ApduCodecImpl {
    fn encode_apdu(&self, cmd: &ApduCommand) -> Vec<u8> {
        let has_data = cmd.data.as_ref().is_some_and(|d| !d.is_empty());
        let has_le = cmd.le.is_some();

        if Self::needs_extended(cmd) {
            return self.encode_extended(cmd, has_data, has_le);
        }

        let mut buf = vec![cmd.cla, cmd.ins, cmd.p1, cmd.p2];

        match (has_data, has_le) {
            // Case 1: No data, no Le
            (false, false) => {}
            // Case 2: No data, with Le
            (false, true) => {
                let le = cmd.le.unwrap();
                buf.push(if le >= 256 { 0x00 } else { le as u8 });
            }
            // Case 3: With data, no Le
            (true, false) => {
                let data = cmd.data.as_ref().unwrap();
                buf.push(data.len() as u8);
                buf.extend_from_slice(data);
            }
            // Case 4: With data, with Le
            (true, true) => {
                let data = cmd.data.as_ref().unwrap();
                let le = cmd.le.unwrap();
                buf.push(data.len() as u8);
                buf.extend_from_slice(data);
                buf.push(if le >= 256 { 0x00 } else { le as u8 });
            }
        }

        buf
    }

    fn decode_apdu_response(&self, raw: &[u8]) -> Result<ApduResponse, ApduError> {
        if raw.len() < 2 {
            return Err(ApduError::IncompleteResponse(raw.len()));
        }

        let len = raw.len();
        Ok(ApduResponse {
            data: raw[..len - 2].to_vec(),
            sw1: raw[len - 2],
            sw2: raw[len - 1],
        })
    }

    fn status_to_error(&self, sw1: u8, sw2: u8) -> Option<HsmError> {
        match (sw1, sw2) {
            // 成功
            (0x90, 0x00) => None,
            // 還有資料可讀取（61 XX = 剩餘 XX bytes，需用 GET RESPONSE 取回）
            (0x61, _) => None,
            // PIN 驗證失敗，低四位元為剩餘重試次數
            (0x63, sw2) if sw2 & 0xF0 == 0xC0 => {
                Some(HsmError::PinInvalid(sw2 & 0x0F))
            }
            // PIN 已鎖定（認證方法被封鎖）
            (0x69, 0x83) => Some(HsmError::PinLocked),
            // 安全條件不滿足（SO-PIN 驗證失敗或未驗證）
            (0x69, 0x82) => Some(HsmError::SoPinInvalid),
            // 檔案或應用程式未找到
            (0x6A, 0x82) => Some(HsmError::KeyNotFound(0)),
            // 參考資料未找到
            (0x6A, 0x88) => Some(HsmError::KeyNotFound(0)),
            // 其他錯誤
            _ => Some(HsmError::StatusError(sw1, sw2)),
        }
    }
}

impl ApduCodecImpl {
    /// 擴充 APDU 編碼（data > 255 bytes 或 Le > 256）
    fn encode_extended(&self, cmd: &ApduCommand, has_data: bool, has_le: bool) -> Vec<u8> {
        let mut buf = vec![cmd.cla, cmd.ins, cmd.p1, cmd.p2];

        match (has_data, has_le) {
            // Extended Case 2: No data, with Le
            (false, true) => {
                let le = cmd.le.unwrap();
                buf.push(0x00); // 擴充標記
                // Le=0 在擴充 APDU 中代表最大長度 (65536)
                buf.push((le >> 8) as u8);
                buf.push((le & 0xFF) as u8);
            }
            // Extended Case 3: With data, no Le
            (true, false) => {
                let data = cmd.data.as_ref().unwrap();
                let lc = data.len() as u16;
                buf.push(0x00); // 擴充標記
                buf.push((lc >> 8) as u8);
                buf.push((lc & 0xFF) as u8);
                buf.extend_from_slice(data);
            }
            // Extended Case 4: With data, with Le
            (true, true) => {
                let data = cmd.data.as_ref().unwrap();
                let lc = data.len() as u16;
                let le = cmd.le.unwrap();
                buf.push(0x00); // 擴充標記
                buf.push((lc >> 8) as u8);
                buf.push((lc & 0xFF) as u8);
                buf.extend_from_slice(data);
                // Le=0 在擴充 APDU 中代表最大長度 (65536)
                buf.push((le >> 8) as u8);
                buf.push((le & 0xFF) as u8);
            }
            // Extended Case 1 不存在（無 data 無 Le 不需要擴充）
            (false, false) => {}
        }

        buf
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn codec() -> ApduCodecImpl {
        ApduCodecImpl::new()
    }

    // === encode_apdu 測試 ===

    #[test]
    fn test_encode_case1_no_data_no_le() {
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xA4,
            p1: 0x04,
            p2: 0x00,
            data: None,
            le: None,
        };
        assert_eq!(codec().encode_apdu(&cmd), vec![0x00, 0xA4, 0x04, 0x00]);
    }

    #[test]
    fn test_encode_case2_no_data_with_le() {
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xB0,
            p1: 0x00,
            p2: 0x00,
            data: None,
            le: Some(16),
        };
        assert_eq!(
            codec().encode_apdu(&cmd),
            vec![0x00, 0xB0, 0x00, 0x00, 0x10]
        );
    }

    #[test]
    fn test_encode_case2_le_256() {
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xB0,
            p1: 0x00,
            p2: 0x00,
            data: None,
            le: Some(256),
        };
        // Le=256 → 0x00 in standard APDU
        assert_eq!(
            codec().encode_apdu(&cmd),
            vec![0x00, 0xB0, 0x00, 0x00, 0x00]
        );
    }

    #[test]
    fn test_encode_case3_with_data_no_le() {
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xA4,
            p1: 0x04,
            p2: 0x00,
            data: Some(vec![0xA0, 0x00, 0x00, 0x03, 0x08]),
            le: None,
        };
        assert_eq!(
            codec().encode_apdu(&cmd),
            vec![0x00, 0xA4, 0x04, 0x00, 0x05, 0xA0, 0x00, 0x00, 0x03, 0x08]
        );
    }

    #[test]
    fn test_encode_case4_with_data_and_le() {
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xA4,
            p1: 0x04,
            p2: 0x00,
            data: Some(vec![0xA0, 0x00]),
            le: Some(10),
        };
        assert_eq!(
            codec().encode_apdu(&cmd),
            vec![0x00, 0xA4, 0x04, 0x00, 0x02, 0xA0, 0x00, 0x0A]
        );
    }

    #[test]
    fn test_encode_empty_data_treated_as_no_data() {
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xA4,
            p1: 0x00,
            p2: 0x00,
            data: Some(vec![]),
            le: None,
        };
        // Empty data vec should behave like Case 1
        assert_eq!(codec().encode_apdu(&cmd), vec![0x00, 0xA4, 0x00, 0x00]);
    }

    #[test]
    fn test_encode_extended_large_data() {
        let data = vec![0xAB; 300];
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xD6,
            p1: 0x00,
            p2: 0x00,
            data: Some(data.clone()),
            le: None,
        };
        let encoded = codec().encode_apdu(&cmd);
        // Header(4) + 0x00 + Lc(2) + data(300)
        assert_eq!(encoded.len(), 4 + 1 + 2 + 300);
        assert_eq!(encoded[4], 0x00); // 擴充標記
        assert_eq!(encoded[5], 0x01); // Lc high byte (300 = 0x012C)
        assert_eq!(encoded[6], 0x2C); // Lc low byte
        assert_eq!(&encoded[7..], &data[..]);
    }

    #[test]
    fn test_encode_extended_large_le() {
        let cmd = ApduCommand {
            cla: 0x00,
            ins: 0xB0,
            p1: 0x00,
            p2: 0x00,
            data: None,
            le: Some(500),
        };
        let encoded = codec().encode_apdu(&cmd);
        // Header(4) + 0x00 + Le(2)
        assert_eq!(encoded.len(), 7);
        assert_eq!(encoded[4], 0x00); // 擴充標記
        assert_eq!(encoded[5], 0x01); // Le high (500 = 0x01F4)
        assert_eq!(encoded[6], 0xF4); // Le low
    }

    // === decode_apdu_response 測試 ===

    #[test]
    fn test_decode_success_no_data() {
        let raw = vec![0x90, 0x00];
        let resp = codec().decode_apdu_response(&raw).unwrap();
        assert_eq!(resp.data, Vec::<u8>::new());
        assert_eq!(resp.sw1, 0x90);
        assert_eq!(resp.sw2, 0x00);
    }

    #[test]
    fn test_decode_success_with_data() {
        let raw = vec![0x01, 0x02, 0x03, 0x90, 0x00];
        let resp = codec().decode_apdu_response(&raw).unwrap();
        assert_eq!(resp.data, vec![0x01, 0x02, 0x03]);
        assert_eq!(resp.sw1, 0x90);
        assert_eq!(resp.sw2, 0x00);
    }

    #[test]
    fn test_decode_error_status() {
        let raw = vec![0x69, 0x82];
        let resp = codec().decode_apdu_response(&raw).unwrap();
        assert_eq!(resp.data, Vec::<u8>::new());
        assert_eq!(resp.sw1, 0x69);
        assert_eq!(resp.sw2, 0x82);
    }

    #[test]
    fn test_decode_empty_response_error() {
        let raw: Vec<u8> = vec![];
        let err = codec().decode_apdu_response(&raw).unwrap_err();
        assert!(matches!(err, ApduError::IncompleteResponse(0)));
    }

    #[test]
    fn test_decode_single_byte_error() {
        let raw = vec![0x90];
        let err = codec().decode_apdu_response(&raw).unwrap_err();
        assert!(matches!(err, ApduError::IncompleteResponse(1)));
    }

    // === status_to_error 測試 ===

    #[test]
    fn test_status_success() {
        assert!(codec().status_to_error(0x90, 0x00).is_none());
    }

    #[test]
    fn test_status_more_data_available() {
        // 61 XX = 還有 XX bytes 可讀取，不是錯誤
        assert!(codec().status_to_error(0x61, 0x24).is_none());
        assert!(codec().status_to_error(0x61, 0x00).is_none());
        assert!(codec().status_to_error(0x61, 0xFF).is_none());
    }

    #[test]
    fn test_status_pin_invalid_with_retries() {
        let err = codec().status_to_error(0x63, 0xC3).unwrap();
        assert!(matches!(err, HsmError::PinInvalid(3)));
    }

    #[test]
    fn test_status_pin_locked() {
        let err = codec().status_to_error(0x69, 0x83).unwrap();
        assert!(matches!(err, HsmError::PinLocked));
    }

    #[test]
    fn test_status_security_condition() {
        let err = codec().status_to_error(0x69, 0x82).unwrap();
        assert!(matches!(err, HsmError::SoPinInvalid));
    }

    #[test]
    fn test_status_file_not_found() {
        let err = codec().status_to_error(0x6A, 0x82).unwrap();
        assert!(matches!(err, HsmError::KeyNotFound(_)));
    }

    #[test]
    fn test_status_referenced_data_not_found() {
        let err = codec().status_to_error(0x6A, 0x88).unwrap();
        assert!(matches!(err, HsmError::KeyNotFound(_)));
    }

    #[test]
    fn test_status_unknown_error() {
        let err = codec().status_to_error(0x6F, 0x00).unwrap();
        assert!(matches!(err, HsmError::StatusError(0x6F, 0x00)));
    }
}
