import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useDeviceStore } from './store/deviceStore';
import { useI18n, useLocale, locales } from './i18n';
import DeviceSelector from './components/DeviceSelector';
import FidoInfo from './pages/fido/FidoInfo';
import FidoPin from './pages/fido/FidoPin';
import FidoCredentials from './pages/fido/FidoCredentials';
import FidoOath from './pages/fido/FidoOath';
import FidoConfig from './pages/fido/FidoConfig';
import FidoBackup from './pages/fido/FidoBackup';
import HsmInfo from './pages/hsm/HsmInfo';
import HsmInit from './pages/hsm/HsmInit';
import HsmPin from './pages/hsm/HsmPin';
import HsmKeys from './pages/hsm/HsmKeys';
import HsmCerts from './pages/hsm/HsmCerts';
import HsmBackup from './pages/hsm/HsmBackup';
import HsmConfig from './pages/hsm/HsmConfig';
import type { DeviceInfo } from './types';

const fidoTabDefs: { id: string; labelKey: string; icon: string; component: React.ComponentType }[] = [
  { id: 'info', labelKey: 'deviceInfo', icon: 'ℹ️', component: FidoInfo },
  { id: 'pin', labelKey: 'pinMgmt', icon: '🔑', component: FidoPin },
  { id: 'credentials', labelKey: 'credentials', icon: '📋', component: FidoCredentials },
  { id: 'oath', labelKey: 'oath', icon: '🔢', component: FidoOath },
  { id: 'config', labelKey: 'config', icon: '⚙️', component: FidoConfig },
  { id: 'backup', labelKey: 'backup', icon: '💾', component: FidoBackup },
];

const hsmTabDefs: { id: string; labelKey: string; icon: string; component: React.ComponentType }[] = [
  { id: 'info', labelKey: 'deviceInfo', icon: 'ℹ️', component: HsmInfo },
  { id: 'init', labelKey: 'init', icon: '🏗️', component: HsmInit },
  { id: 'pin', labelKey: 'pinMgmt', icon: '🔑', component: HsmPin },
  { id: 'keys', labelKey: 'keys', icon: '🗝️', component: HsmKeys },
  { id: 'certs', labelKey: 'certs', icon: '📜', component: HsmCerts },
  { id: 'backup', labelKey: 'backup', icon: '💾', component: HsmBackup },
  { id: 'config', labelKey: 'config', icon: '⚙️', component: HsmConfig },
];

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '2px solid #e0e0e0',
    background: '#fff',
    padding: '0 24px',
    flexShrink: 0,
  },
  tab: {
    padding: '12px 18px',
    fontSize: 13,
    fontWeight: 500,
    color: '#666',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    transition: 'color 0.15s, border-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap' as const,
  },
  tabActive: {
    color: '#1976d2',
    borderBottomColor: '#1976d2',
    fontWeight: 600,
  },
  tabHsm: {
    color: '#388e3c',
    borderBottomColor: '#388e3c',
  },
  content: {
    flex: 1,
    padding: 28,
    overflow: 'auto',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 24px',
    background: '#fafafa',
    borderBottom: '1px solid #e0e0e0',
    flexShrink: 0,
  },
  panelBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 10px',
    borderRadius: 4,
    fontWeight: 700,
    fontSize: 11,
    color: '#fff',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#333',
  },
  welcome: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    textAlign: 'center' as const,
    gap: 12,
  },
  welcomeIcon: { fontSize: 48, marginBottom: 8 },
  welcomeTitle: { fontSize: 20, fontWeight: 600, color: '#333' },
  welcomeHint: { fontSize: 14, color: '#999' },
  langSelector: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  langSelect: {
    padding: '4px 8px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
  },
};

function LanguageSelector() {
  const t = useI18n();
  const [locale, setLocale] = useLocale();

  return (
    <div style={styles.langSelector}>
      <span style={{ fontSize: 12, color: '#666' }}>{t.lang.label}:</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        style={styles.langSelect}
      >
        {locales.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TabbedPanel({ tabDefs, activeColor }: { tabDefs: typeof fidoTabDefs; activeColor: 'fido' | 'hsm' }) {
  const t = useI18n();
  const [activeTab, setActiveTab] = useState(tabDefs[0].id);
  const current = tabDefs.find((tab) => tab.id === activeTab) ?? tabDefs[0];
  const ActiveComponent = current.component;
  const isFido = activeColor === 'fido';

  return (
    <>
      <div style={styles.tabBar} role="tablist">
        {tabDefs.map((tab) => {
          const isActive = tab.id === activeTab;
          const label = t.tabs[tab.labelKey as keyof typeof t.tabs] || tab.labelKey;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              style={{
                ...styles.tab,
                ...(isActive
                  ? { ...styles.tabActive, ...(isFido ? {} : styles.tabHsm) }
                  : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              {label}
            </button>
          );
        })}
      </div>
      <div style={styles.content} role="tabpanel">
        <ActiveComponent />
      </div>
    </>
  );
}

function DevicePanel({ device }: { device: DeviceInfo }) {
  const t = useI18n();
  const isFido = device.deviceType === 'PicoFido';
  return (
    <div style={styles.main}>
      <div style={styles.panelHeader}>
        <div
          style={{
            ...styles.panelBadge,
            background: isFido ? '#1976d2' : '#388e3c',
          }}
        >
          {isFido ? 'FIDO' : 'HSM'}
        </div>
        <div style={styles.panelTitle}>
          {isFido ? 'Pico-FIDO' : 'Pico-HSM'} {t.app.management}
        </div>
        {device.serial && (
          <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
            SN: {device.serial}
          </span>
        )}
        <LanguageSelector />
      </div>
      <TabbedPanel
        tabDefs={isFido ? fidoTabDefs : hsmTabDefs}
        activeColor={isFido ? 'fido' : 'hsm'}
      />
    </div>
  );
}

function WelcomeScreen() {
  const t = useI18n();

  return (
    <div style={{ ...styles.main, padding: 40, overflow: 'auto' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <LanguageSelector />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={styles.welcomeIcon}>🔐</div>
          <div style={styles.welcomeTitle}>{t.app.title}</div>
          <div style={styles.welcomeHint}>{t.app.subtitle}</div>
        </div>

        {/* 快速開始 */}
        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 12 }}>{t.app.quickStart}</div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 2 }}>
            {t.app.quickStartSteps.map((step, i) => (
              <div key={i}>{step}</div>
            ))}
          </div>
        </div>

        {/* 裝置說明 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1, background: '#e3f2fd', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1565c0', marginBottom: 8 }}>
              {t.app.picoFidoTitle}
            </div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              {t.app.picoFidoDesc}
            </div>
          </div>
          <div style={{ flex: 1, background: '#e8f5e9', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32', marginBottom: 8 }}>
              {t.app.picoHsmTitle}
            </div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              {t.app.picoHsmDesc}
            </div>
          </div>
        </div>

        {/* HSM 注意事項 */}
        <div style={{ background: '#fff3e0', borderRadius: 8, padding: '16px 20px', borderLeft: '4px solid #ff9800' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e65100', marginBottom: 6 }}>
            {t.app.hsmPrereqTitle}
          </div>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
            {t.app.hsmPrereqDesc}
          </div>
          <div style={{ background: '#fff8e1', padding: '6px 10px', borderRadius: 4, marginTop: 8, fontFamily: 'monospace', fontSize: 11, userSelect: 'all', color: '#333' }}>
            {t.app.hsmPrereqCmd}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { selectedDevice, scanDevices, setDevices } = useDeviceStore();

  useEffect(() => {
    scanDevices();
    const unlisten = listen<DeviceInfo[]>('device-changed', (event) => {
      setDevices(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [scanDevices, setDevices]);

  return (
    <div style={styles.layout}>
      <DeviceSelector />
      {selectedDevice ? (
        <DevicePanel device={selectedDevice} />
      ) : (
        <WelcomeScreen />
      )}
    </div>
  );
}
