import { safeInvoke } from './errors';
import type {
  FidoDeviceInfo,
  FidoCredential,
  OathCredential,
  OathCredentialParams,
  LedConfig,
} from '../types';

// --- 裝置資訊 ---

export function fidoGetInfo(path: string): Promise<FidoDeviceInfo> {
  return safeInvoke<FidoDeviceInfo>('fido_get_info', { path });
}

// --- PIN 管理 ---

export function fidoSetPin(path: string, newPin: string): Promise<void> {
  return safeInvoke<void>('fido_set_pin', { path, newPin });
}

export function fidoChangePin(path: string, oldPin: string, newPin: string): Promise<void> {
  return safeInvoke<void>('fido_change_pin', { path, oldPin, newPin });
}

export function fidoGetPinRetries(path: string): Promise<number> {
  return safeInvoke<number>('fido_get_pin_retries', { path });
}

// --- 憑證管理 ---

export function fidoListCredentials(path: string, pin: string): Promise<FidoCredential[]> {
  return safeInvoke<FidoCredential[]>('fido_list_credentials', { path, pin });
}

export function fidoDeleteCredential(path: string, pin: string, credentialId: number[]): Promise<void> {
  return safeInvoke<void>('fido_delete_credential', { path, pin, credentialId });
}

// --- 組態設定 ---

export function fidoSetMinPinLength(path: string, pin: string, length: number): Promise<void> {
  return safeInvoke<void>('fido_set_min_pin_length', { path, pin, length });
}

export function fidoToggleEnterpriseAttestation(path: string, pin: string, enable: boolean): Promise<void> {
  return safeInvoke<void>('fido_toggle_enterprise_attestation', { path, pin, enable });
}

export function fidoSetLedConfig(path: string, config: LedConfig): Promise<void> {
  return safeInvoke<void>('fido_set_led_config', { path, config });
}

// --- OATH 管理 ---

export function fidoListOath(path: string): Promise<OathCredential[]> {
  return safeInvoke<OathCredential[]>('fido_list_oath', { path });
}

export function fidoAddOath(path: string, credential: OathCredentialParams): Promise<void> {
  return safeInvoke<void>('fido_add_oath', { path, credential });
}

export function fidoCalculateOath(path: string, credentialId: string): Promise<string> {
  return safeInvoke<string>('fido_calculate_oath', { path, credentialId });
}

export function fidoDeleteOath(path: string, credentialId: string): Promise<void> {
  return safeInvoke<void>('fido_delete_oath', { path, credentialId });
}

// --- 備份與重設 ---

export function fidoGetBackupWords(path: string, pin: string): Promise<string[]> {
  return safeInvoke<string[]>('fido_get_backup_words', { path, pin });
}

export function fidoRestoreFromWords(path: string, pin: string, words: string[]): Promise<void> {
  return safeInvoke<void>('fido_restore_from_words', { path, pin, words });
}

export function fidoReset(path: string): Promise<void> {
  return safeInvoke<void>('fido_reset', { path });
}
