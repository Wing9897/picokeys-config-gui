import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useHsmStore } from '../../store/hsmStore';
import { useI18n } from '../../i18n';
import LoadingIndicator from '../../components/LoadingIndicator';

const styles = {
  container: {
    maxWidth: 680,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f0f0f0',
    fontSize: 14,
  },
  label: {
    color: '#666',
  },
  value: {
    color: '#222',
    fontWeight: 500,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  barOuter: {
    height: 16,
    borderRadius: 8,
    background: '#e0e0e0',
    overflow: 'hidden',
    flex: 1,
    marginLeft: 12,
  },
  barInner: (pct: number) => ({
    height: '100%',
    borderRadius: 8,
    background: pct > 85 ? '#e53935' : pct > 60 ? '#fb8c00' : '#43a047',
    width: `${pct}%`,
    transition: 'width 0.3s ease',
  }),
  barRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f0f0f0',
    fontSize: 14,
  },
  barLabel: {
    color: '#666',
    minWidth: 100,
  },
  barPct: {
    minWidth: 48,
    textAlign: 'right' as const,
    fontSize: 13,
    fontWeight: 500,
    color: '#222',
    marginLeft: 8,
  },
  error: {
    color: '#c62828',
    fontSize: 14,
    padding: 16,
  },
  guideBox: {
    background: '#f5f5f5',
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 20,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
    marginBottom: 10,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
    fontSize: 13,
    color: '#555',
  },
  stepBadge: (done: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    background: done ? '#43a047' : '#e0e0e0',
    color: done ? '#fff' : '#888',
  }),
  statusBadge: (ok: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    background: ok ? '#e8f5e9' : '#fff3e0',
    color: ok ? '#2e7d32' : '#e65100',
  }),
  pinTestBtn: {
    padding: '6px 14px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    marginLeft: 8,
  },
  pinInput: {
    padding: '5px 10px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 4,
    width: 140,
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

type DeviceStatus = 'unknown' | 'connected' | 'initialized' | 'pin_verified';

export default function HsmInfo() {
  const t = useI18n();
  const { info, loading, error, loadInfo } = useHsmStore();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('unknown');
  const [pinInput, setPinInput] = useState('');
  const [pinResult, setPinResult] = useState<string | null>(null);
  const [pinChecking, setPinChecking] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<string[] | null>(null);

  useEffect(() => {
    loadInfo().then(() => {
      setDeviceStatus('connected');
    });
  }, [loadInfo]);

  useEffect(() => {
    if (info && info.firmwareVersion && info.firmwareVersion !== 'unknown') {
      setDeviceStatus('initialized');
    }
  }, [info]);

  const handlePinTest = async () => {
    if (pinInput.length < 6) {
      setPinResult(t.hsmInfo.pinTooShort);
      return;
    }
    setPinChecking(true);
    setPinResult(null);
    try {
      await invoke('hsm_verify_pin', { pin: pinInput });
      setPinResult(t.hsmInfo.pinSuccess);
      setDeviceStatus('pin_verified');
    } catch (e) {
      const msg = String(e);
      if (msg.includes('PinInvalid') || msg.includes('63C')) {
        setPinResult(t.hsmInfo.pinIncorrect);
      } else if (msg.includes('PinLocked') || msg.includes('6983')) {
        setPinResult(t.hsmInfo.pinLocked);
      } else {
        setPinResult(`❌ ${msg}`);
      }
    } finally {
      setPinChecking(false);
    }
  };

  const handleDiag = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const result = await invoke<string[]>('hsm_debug_device_raw');
      setDiagResult(result);
    } catch (e) {
      setDiagResult([`${t.common.error}: ${String(e)}`]);
    } finally {
      setDiagLoading(false);
    }
  };

  if (loading) return <LoadingIndicator message={t.common.loading} />;
  if (error) return <div style={styles.error}>{t.common.error}：{error}</div>;

  const isInitialized = deviceStatus === 'initialized' || deviceStatus === 'pin_verified';
  const isPinVerified = deviceStatus === 'pin_verified';

  return (
    <div style={styles.container}>
      {/* 裝置狀態總覽 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmInfo.deviceStatus}</div>
        <div style={styles.row}>
          <span style={styles.label}>{t.hsmInfo.connectionStatus}</span>
          <span style={styles.statusBadge(true)}>{t.hsmInfo.connected}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>{t.hsmInfo.initStatus}</span>
          <span style={styles.statusBadge(isInitialized)}>
            {isInitialized ? t.hsmInfo.initialized : t.hsmInfo.unknownStatus}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>{t.hsmInfo.pinStatus}</span>
          <span style={styles.statusBadge(isPinVerified)}>
            {isPinVerified ? t.hsmInfo.pinVerified : t.hsmInfo.pinNotVerified}
          </span>
        </div>
      </div>

      {/* 快速 PIN 驗證 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmInfo.quickPinVerify}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <input
            type="password"
            placeholder={t.hsmInfo.enterPin}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePinTest()}
            style={styles.pinInput}
            aria-label="User PIN"
          />
          <button
            onClick={handlePinTest}
            disabled={pinChecking}
            style={styles.pinTestBtn}
          >
            {pinChecking ? t.hsmInfo.verifying : t.hsmInfo.verify}
          </button>
          {pinResult && (
            <span style={{ fontSize: 13, color: pinResult.startsWith('✅') ? '#2e7d32' : '#c62828' }}>
              {pinResult}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          {t.hsmInfo.pinVerifyHint}
        </div>
      </div>

      {/* 使用指南 */}
      <div style={styles.guideBox}>
        <div style={styles.guideTitle}>{t.hsmInfo.guideTitle}</div>
        <div style={styles.stepRow}>
          <span style={styles.stepBadge(true)}>1</span>
          <span>{t.hsmInfo.guideStep1}</span>
        </div>
        <div style={styles.stepRow}>
          <span style={styles.stepBadge(isInitialized)}>2</span>
          <span>
            {isInitialized ? t.hsmInfo.guideStep2Init : t.hsmInfo.guideStep2NotInit}
          </span>
        </div>
        <div style={styles.stepRow}>
          <span style={styles.stepBadge(isPinVerified)}>3</span>
          <span>
            {isPinVerified ? t.hsmInfo.guideStep3Verified : t.hsmInfo.guideStep3NotVerified}
          </span>
        </div>
        <div style={styles.stepRow}>
          <span style={styles.stepBadge(false)}>4</span>
          <span>{t.hsmInfo.guideStep4}</span>
        </div>
        <div style={styles.stepRow}>
          <span style={styles.stepBadge(false)}>5</span>
          <span>{t.hsmInfo.guideStep5}</span>
        </div>
      </div>

      {/* 基本資訊 */}
      {info && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.hsmInfo.basicInfo}</div>
            <div style={styles.row}>
              <span style={styles.label}>{t.hsmInfo.firmwareVersion}</span>
              <span style={styles.value}>{info.firmwareVersion || 'unknown'}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>{t.hsmInfo.serialNumber}</span>
              <span style={{ ...styles.value, ...styles.mono }}>
                {info.serialNumber || t.hsmInfo.serialPlaceholder}
              </span>
            </div>
          </div>

          {/* 記憶體使用量 */}
          {info.totalMemory > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>{t.hsmInfo.memoryUsage}</div>
              <div style={styles.barRow}>
                <span style={styles.barLabel}>{t.hsmInfo.used}</span>
                <div style={styles.barOuter}>
                  <div style={styles.barInner(
                    Math.round((info.usedMemory / info.totalMemory) * 100)
                  )} />
                </div>
                <span style={styles.barPct}>
                  {Math.round((info.usedMemory / info.totalMemory) * 100)}%
                </span>
              </div>
              <div style={styles.row}>
                <span style={styles.label}>{t.hsmInfo.usedTotal}</span>
                <span style={styles.value}>
                  {formatBytes(info.usedMemory)} / {formatBytes(info.totalMemory)}
                </span>
              </div>
              <div style={styles.row}>
                <span style={styles.label}>{t.hsmInfo.freeSpace}</span>
                <span style={styles.value}>{formatBytes(info.freeMemory)}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.label}>{t.hsmInfo.fileCount}</span>
                <span style={styles.value}>{info.fileCount}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* 診斷工具 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmInfo.diagTools}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <button
            onClick={handleDiag}
            disabled={diagLoading}
            style={styles.pinTestBtn}
          >
            {diagLoading ? t.hsmInfo.diagReading : t.hsmInfo.diagRawData}
          </button>
          <span style={{ fontSize: 12, color: '#999' }}>
            {t.hsmInfo.diagHint}
          </span>
        </div>
        {diagResult && (
          <div style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            borderRadius: 6,
            padding: '12px 16px',
            marginTop: 8,
            fontSize: 12,
            fontFamily: 'monospace',
            lineHeight: 1.6,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {diagResult.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
