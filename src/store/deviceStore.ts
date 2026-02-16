import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { DeviceInfo } from '../types';

interface DeviceState {
  devices: DeviceInfo[];
  selectedDevice: DeviceInfo | null;
  loading: boolean;
  error: string | null;

  scanDevices: () => Promise<void>;
  selectDevice: (device: DeviceInfo | null) => Promise<void>;
  setDevices: (devices: DeviceInfo[]) => void;
  clearError: () => void;
  reset: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedDevice: null,
  loading: false,
  error: null,

  scanDevices: async () => {
    set({ loading: true, error: null });
    try {
      const devices = await invoke<DeviceInfo[]>('scan_devices');
      const current = get().selectedDevice;
      // If selected device was removed, deselect it
      const stillConnected = current
        ? devices.some((d) => d.path === current.path)
        : false;
      set({
        devices,
        loading: false,
        selectedDevice: stillConnected ? current : null,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  selectDevice: async (device) => {
    if (!device) {
      set({ selectedDevice: null });
      return;
    }
    // 點擊已選中的裝置時直接跳過
    const current = get().selectedDevice;
    if (current && current.path === device.path) {
      return;
    }
    set({ loading: true, error: null });
    try {
      await invoke('open_device', { path: device.path });
      set({ selectedDevice: device, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setDevices: (devices) => {
    const current = get().selectedDevice;
    const stillConnected = current
      ? devices.some((d) => d.path === current.path)
      : false;
    set({
      devices,
      selectedDevice: stillConnected ? current : null,
    });
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({ devices: [], selectedDevice: null, loading: false, error: null }),
}));
