// ============================================================
// Pico Config GUI — 前端共用型別定義
// 對應 Rust 後端 serde 序列化的 JSON 結構
// ============================================================

// === 裝置管理 ===

/** 裝置基本資訊 */
export interface DeviceInfo {
  deviceType: 'PicoFido' | 'PicoHsm';
  serial: string;
  firmwareVersion: string;
  path: string;
}

// === FIDO 相關 ===

/** FIDO 裝置詳細資訊（來自 authenticatorGetInfo） */
export interface FidoDeviceInfo {
  versions: string[];
  extensions: string[];
  aaguid: string;
  firmwareVersion: string;
  serialNumber?: string;
  pinSet: boolean;
  pinRetries: number;
  options: Record<string, boolean>;
}

/** FIDO 可發現憑證 */
export interface FidoCredential {
  credentialId: number[];
  rpId: string;
  rpName?: string;
  userName?: string;
  userDisplayName?: string;
  creationTime?: number;
}

// === OATH 相關 ===

/** OATH 憑證類型 */
export type OathType = 'Totp' | 'Hotp';

/** OATH 憑證資訊 */
export interface OathCredential {
  id: string;
  issuer?: string;
  account: string;
  oathType: OathType;
  period?: number;
}

/** OATH 憑證新增參數 */
export interface OathCredentialParams {
  secret: number[];
  issuer: string;
  account: string;
  oathType: OathType;
  digits: number;
  period?: number;
  counter?: number;
}

// === HSM 相關 ===

/** HSM 裝置詳細資訊 */
export interface HsmDeviceInfo {
  firmwareVersion: string;
  serialNumber: string;
  freeMemory: number;
  usedMemory: number;
  totalMemory: number;
  fileCount: number;
}

/** HSM 金鑰類型（serde 列舉序列化格式） */
export type HsmKeyType =
  | { Rsa: null }
  | { Ec: { curve: string } }
  | { Aes: null };

/** HSM 金鑰資訊 */
export interface HsmKeyInfo {
  keyRef: number;
  id: number;
  label: string;
  keyType: HsmKeyType;
  keySize: number;
  usage: string[];
}

/** HSM X.509 憑證資訊 */
export interface HsmCertInfo {
  id: number;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  keyId?: number;
}

// === DKEK 備份相關 ===

/** DKEK 份額狀態 */
export interface DkekStatus {
  totalShares: number;
  importedShares: number;
  remainingShares: number;
  keyCheckValue?: string;
}

// === HSM 裝置選項 ===

/** HSM 裝置選項狀態 */
export interface HsmOptions {
  pressToConfirm: boolean;
  keyUsageCounter: boolean;
}

// === LED 組態（共用於 FIDO 與 HSM） ===

/** LED 組態設定 */
export interface LedConfig {
  gpio?: number;
  brightness?: number;
  dimmable?: boolean;
  color?: string;
}
