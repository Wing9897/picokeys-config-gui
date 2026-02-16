import { safeInvoke } from './errors';
import type {
  HsmDeviceInfo,
  HsmKeyInfo,
  HsmCertInfo,
  DkekStatus,
  HsmOptions,
  LedConfig,
} from '../types';

// --- 初始化 ---

export function hsmInitialize(path: string, pin: string, soPin: string, dkekShares: number): Promise<void> {
  return safeInvoke<void>('hsm_initialize', { path, pin, soPin, dkekShares });
}

// --- PIN 管理 ---

export function hsmVerifyPin(path: string, pin: string): Promise<void> {
  return safeInvoke<void>('hsm_verify_pin', { path, pin });
}

export function hsmChangePin(path: string, oldPin: string, newPin: string): Promise<void> {
  return safeInvoke<void>('hsm_change_pin', { path, oldPin, newPin });
}

export function hsmChangeSoPin(path: string, oldSoPin: string, newSoPin: string): Promise<void> {
  return safeInvoke<void>('hsm_change_so_pin', { path, oldSoPin, newSoPin });
}

export function hsmUnblockPin(path: string, soPin: string, newPin: string): Promise<void> {
  return safeInvoke<void>('hsm_unblock_pin', { path, soPin, newPin });
}

// --- 金鑰管理 ---

export function hsmListKeys(path: string, pin: string): Promise<HsmKeyInfo[]> {
  return safeInvoke<HsmKeyInfo[]>('hsm_list_keys', { path, pin });
}

export function hsmGenerateRsaKey(
  path: string, pin: string, bits: number, id: number, label: string,
): Promise<HsmKeyInfo> {
  return safeInvoke<HsmKeyInfo>('hsm_generate_rsa_key', { path, pin, bits, id, label });
}

export function hsmGenerateEcKey(
  path: string, pin: string, curve: string, id: number, label: string,
): Promise<HsmKeyInfo> {
  return safeInvoke<HsmKeyInfo>('hsm_generate_ec_key', { path, pin, curve, id, label });
}

export function hsmGenerateAesKey(
  path: string, pin: string, bits: number, id: number,
): Promise<HsmKeyInfo> {
  return safeInvoke<HsmKeyInfo>('hsm_generate_aes_key', { path, pin, bits, id });
}

export function hsmDeleteKey(path: string, pin: string, id: number, keyType: string): Promise<void> {
  return safeInvoke<void>('hsm_delete_key', { path, pin, id, keyType });
}

// --- 憑證管理 ---

export function hsmListCertificates(path: string, pin: string): Promise<HsmCertInfo[]> {
  return safeInvoke<HsmCertInfo[]>('hsm_list_certificates', { path, pin });
}

export function hsmImportCertificate(
  path: string, pin: string, id: number, certData: number[],
): Promise<void> {
  return safeInvoke<void>('hsm_import_certificate', { path, pin, id, certData });
}

export function hsmExportCertificate(path: string, id: number): Promise<number[]> {
  return safeInvoke<number[]>('hsm_export_certificate', { path, id });
}

// --- DKEK 與備份 ---

export function hsmCreateDkekShare(path: string, password: string): Promise<number[]> {
  return safeInvoke<number[]>('hsm_create_dkek_share', { path, password });
}

export function hsmImportDkekShare(
  path: string, shareData: number[], password: string,
): Promise<DkekStatus> {
  return safeInvoke<DkekStatus>('hsm_import_dkek_share', { path, shareData, password });
}

export function hsmWrapKey(path: string, pin: string, keyRef: number): Promise<number[]> {
  return safeInvoke<number[]>('hsm_wrap_key', { path, pin, keyRef });
}

export function hsmUnwrapKey(
  path: string, pin: string, keyRef: number, wrapped: number[],
): Promise<void> {
  return safeInvoke<void>('hsm_unwrap_key', { path, pin, keyRef, wrapped });
}

// --- 裝置選項與組態 ---

export function hsmGetOptions(path: string): Promise<HsmOptions> {
  return safeInvoke<HsmOptions>('hsm_get_options', { path });
}

export function hsmSetOption(path: string, option: string, enabled: boolean): Promise<void> {
  return safeInvoke<void>('hsm_set_option', { path, option, enabled });
}

export function hsmSetDatetime(path: string): Promise<void> {
  return safeInvoke<void>('hsm_set_datetime', { path });
}

export function hsmGetDeviceInfo(path: string): Promise<HsmDeviceInfo> {
  return safeInvoke<HsmDeviceInfo>('hsm_get_device_info', { path });
}

// --- 安全鎖 ---

export function hsmEnableSecureLock(path: string): Promise<void> {
  return safeInvoke<void>('hsm_enable_secure_lock', { path });
}

export function hsmDisableSecureLock(path: string): Promise<void> {
  return safeInvoke<void>('hsm_disable_secure_lock', { path });
}

// --- LED 設定 ---

export function hsmSetLedConfig(path: string, config: LedConfig): Promise<void> {
  return safeInvoke<void>('hsm_set_led_config', { path, config });
}
