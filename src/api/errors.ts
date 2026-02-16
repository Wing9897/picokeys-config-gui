import { invoke } from '@tauri-apps/api/core';

/**
 * 統一錯誤處理：將 Tauri invoke 錯誤轉換為使用者可讀訊息
 */

/** 已知錯誤類型對應的使用者可讀訊息 */
const ERROR_MESSAGES: Record<string, string> = {
  // 裝置連線
  DeviceNotFound: '找不到裝置，請確認裝置已連接',
  DeviceDisconnected: '裝置連線中斷，請重新連接裝置',
  ConnectionTimeout: '裝置操作逾時，請重試',
  DeviceBusy: '裝置忙碌中，請稍後再試',

  // FIDO 錯誤
  PinInvalid: 'PIN 碼錯誤',
  PinLocked: 'PIN 已鎖定，需要重設裝置',
  PinTooShort: 'PIN 長度不足（最少 4 位元組）',
  PinTooLong: 'PIN 長度超過上限（最多 63 位元組）',
  CredentialNotFound: '找不到指定的憑證',
  NotSupported: '裝置不支援此功能',

  // HSM 錯誤
  AuthenticationFailed: '驗證失敗，請確認 PIN 碼正確',
  SoPinInvalid: 'SO-PIN 錯誤',
  SoPinLocked: 'SO-PIN 已鎖定，裝置需要重新初始化',
  NotInitialized: '裝置尚未初始化',
  KeyNotFound: '找不到指定的金鑰',
  CertificateNotFound: '找不到指定的憑證',
  InsufficientMemory: '裝置記憶體不足',
  DkekNotInitialized: '尚未初始化 DKEK，請先匯入 DKEK 份額',
};

/** 將 invoke 錯誤轉換為使用者可讀訊息 */
export function toUserMessage(error: unknown): string {
  const raw = String(error);

  // 嘗試匹配已知錯誤類型
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (raw.includes(key)) {
      return message;
    }
  }

  // 回傳原始錯誤訊息
  return raw || '發生未知錯誤';
}

/** 封裝 invoke 呼叫，統一錯誤處理 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(toUserMessage(error));
  }
}
