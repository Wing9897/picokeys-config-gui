import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { FidoDeviceInfo, FidoCredential, OathCredential } from '../types';

interface FidoState {
  info: FidoDeviceInfo | null;
  credentials: FidoCredential[];
  oathCredentials: OathCredential[];
  loading: boolean;
  error: string | null;

  loadInfo: () => Promise<void>;
  loadCredentials: (pin: string) => Promise<void>;
  deleteCredential: (pin: string, credentialId: number[]) => Promise<void>;
  loadOathCredentials: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useFidoStore = create<FidoState>((set) => ({
  info: null,
  credentials: [],
  oathCredentials: [],
  loading: false,
  error: null,

  loadInfo: async () => {
    set({ loading: true, error: null });
    try {
      const info = await invoke<FidoDeviceInfo>('fido_get_info');
      set({ info, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadCredentials: async (pin) => {
    set({ loading: true, error: null });
    try {
      const credentials = await invoke<FidoCredential[]>(
        'fido_list_credentials',
        { pin },
      );
      set({ credentials, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  deleteCredential: async (pin, credentialId) => {
    set({ loading: true, error: null });
    try {
      await invoke('fido_delete_credential', { pin, credentialId });
      // Refresh list after deletion
      const credentials = await invoke<FidoCredential[]>(
        'fido_list_credentials',
        { pin },
      );
      set({ credentials, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadOathCredentials: async () => {
    set({ loading: true, error: null });
    try {
      const oathCredentials =
        await invoke<OathCredential[]>('fido_list_oath');
      set({ oathCredentials, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      info: null,
      credentials: [],
      oathCredentials: [],
      loading: false,
      error: null,
    }),
}));
