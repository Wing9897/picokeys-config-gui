import { safeInvoke } from './errors';
import type { DeviceInfo } from '../types';

/** 掃描所有已連接的 Pico 裝置 */
export function scanDevices(): Promise<DeviceInfo[]> {
  return safeInvoke<DeviceInfo[]>('scan_devices');
}

/** 開啟指定裝置的連線 */
export function openDevice(path: string): Promise<void> {
  return safeInvoke<void>('open_device', { path });
}

/** 診斷用：列出所有 PC/SC 讀卡機及其 ATR */
export function listAllReaders(): Promise<string[]> {
  return safeInvoke<string[]>('list_all_readers');
}

/** 檢查 Smart Card 服務狀態 */
export function checkScardService(): Promise<string> {
  return safeInvoke<string>('check_scard_service');
}
