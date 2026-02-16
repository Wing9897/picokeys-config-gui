import { useState, useEffect } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { listAllReaders, checkScardService } from '../api/device';
import { useI18n } from '../i18n';
import type { DeviceInfo } from '../types';

const styles = {
  container: {
    width: 260,
    minHeight: '100vh',
    borderRight: '1px solid #e0e0e0',
    background: '#fafafa',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: 0,
  },
  header: {
    padding: '16px 16px 12px',
    fontWeight: 600,
    fontSize: 14,
    color: '#333',
    borderBottom: '1px solid #e0e0e0',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    border: '1px solid transparent',
    marginBottom: 4,
    transition: 'background 0.15s',
  },
  itemSelected: {
    background: '#e3f2fd',
    border: '1px solid #90caf9',
  },
  itemHover: {
    background: '#f5f5f5',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 11,
    color: '#fff',
    flexShrink: 0,
  },
  fidoBadge: { background: '#1976d2' },
  hsmBadge: { background: '#388e3c' },
  info: {
    flex: 1,
    minWidth: 0,
  },
  serial: {
    fontSize: 13,
    fontWeight: 500,
    color: '#222',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  firmware: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  empty: {
    padding: 24,
    textAlign: 'center' as const,
    color: '#999',
    fontSize: 13,
    lineHeight: 1.6,
  },
};

function DeviceItem({
  device,
  selected,
  onSelect,
}: {
  device: DeviceInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const isFido = device.deviceType === 'PicoFido';
  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={selected}
      style={{
        ...styles.item,
        ...(selected ? styles.itemSelected : {}),
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
    >
      <div
        style={{
          ...styles.badge,
          ...(isFido ? styles.fidoBadge : styles.hsmBadge),
        }}
      >
        {isFido ? 'FIDO' : 'HSM'}
      </div>
      <div style={styles.info}>
        <div style={styles.serial}>{device.serial || '(unknown)'}</div>
        <div style={styles.firmware}>
          {isFido ? 'Pico-FIDO' : 'Pico-HSM'} · v{device.firmwareVersion}
        </div>
      </div>
    </div>
  );
}

export default function DeviceSelector() {
  const t = useI18n();
  const { devices, selectedDevice, selectDevice, error } = useDeviceStore();
  const [readerInfo, setReaderInfo] = useState<string[] | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [scardStatus, setScardStatus] = useState<string | null>(null);

  useEffect(() => {
    checkScardService().then(setScardStatus).catch(() => setScardStatus(null));
  }, []);

  const handleDiag = async () => {
    setDiagLoading(true);
    try {
      const readers = await listAllReaders();
      setReaderInfo(readers);
    } catch (e) {
      setReaderInfo([`Error: ${e}`]);
    } finally {
      setDiagLoading(false);
    }
  };

  const scardWarning = scardStatus && scardStatus !== 'running' && scardStatus !== 'not_windows';

  return (
    <nav style={styles.container} aria-label={t.device.title}>
      <div style={styles.header}>{t.device.title}</div>
      <div style={styles.list} role="listbox">
        {scardWarning && (
          <div style={{ padding: '10px 12px', fontSize: 12, color: '#e65100', background: '#fff3e0', borderRadius: 6, margin: '0 0 8px', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              ⚠️ Smart Card {scardStatus === 'disabled' ? t.device.scardDisabled : t.device.scardStopped}
            </div>
            <div>{t.device.scardWarning}</div>
            <div style={{ background: '#fff8e1', padding: '6px 8px', borderRadius: 4, marginTop: 6, fontFamily: 'monospace', fontSize: 11, userSelect: 'all' }}>
              {t.device.scardCmd}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#bf360c' }}>
              {t.device.scardManual}
            </div>
          </div>
        )}
        {error && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: '#d32f2f', background: '#fce4ec', borderRadius: 4, margin: '0 0 8px' }}>
            {error}
          </div>
        )}
        {devices.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔌</div>
            {t.device.connectPrompt}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={handleDiag}
                disabled={diagLoading}
                style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, background: '#fff' }}
              >
                {diagLoading ? t.device.detecting : t.device.diagReader}
              </button>
            </div>
            {readerInfo && (
              <div style={{ marginTop: 8, textAlign: 'left', fontSize: 11, color: '#555', background: '#f0f0f0', padding: 8, borderRadius: 4, wordBreak: 'break-all' }}>
                {readerInfo.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          devices.map((d) => (
            <DeviceItem
              key={d.path}
              device={d}
              selected={selectedDevice?.path === d.path}
              onSelect={() => selectDevice(d)}
            />
          ))
        )}
      </div>
    </nav>
  );
}
