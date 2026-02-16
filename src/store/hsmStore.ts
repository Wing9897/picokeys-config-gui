import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  HsmDeviceInfo,
  HsmKeyInfo,
  HsmCertInfo,
  DkekStatus,
} from '../types';

interface HsmState {
  info: HsmDeviceInfo | null;
  keys: HsmKeyInfo[];
  certificates: HsmCertInfo[];
  dkekStatus: DkekStatus | null;
  loading: boolean;
  error: string | null;

  loadInfo: () => Promise<void>;
  loadKeys: (pin: string) => Promise<void>;
  loadCertificates: (pin: string) => Promise<void>;
  setDkekStatus: (status: DkekStatus | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useHsmStore = create<HsmState>((set) => ({
  info: null,
  keys: [],
  certificates: [],
  dkekStatus: null,
  loading: false,
  error: null,

  loadInfo: async () => {
    set({ loading: true, error: null });
    try {
      const info = await invoke<HsmDeviceInfo>('hsm_get_device_info');
      set({ info, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadKeys: async (pin) => {
    set({ loading: true, error: null });
    try {
      const keys = await invoke<HsmKeyInfo[]>('hsm_list_keys', { pin });
      set({ keys, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadCertificates: async (pin) => {
    set({ loading: true, error: null });
    try {
      const certificates = await invoke<HsmCertInfo[]>(
        'hsm_list_certificates',
        { pin },
      );
      set({ certificates, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setDkekStatus: (status) => set({ dkekStatus: status }),

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      info: null,
      keys: [],
      certificates: [],
      dkekStatus: null,
      loading: false,
      error: null,
    }),
}));
