import { useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useHsmStore } from '../../store/hsmStore';
import { useI18n } from '../../i18n';
import {
  hsmListKeys,
  hsmGenerateRsaKey,
  hsmGenerateEcKey,
  hsmGenerateAesKey,
  hsmDeleteKey,
} from '../../api/hsm';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingIndicator from '../../components/LoadingIndicator';
import Notification from '../../components/Notification';
import type { HsmKeyInfo, HsmKeyType } from '../../types';

const styles = {
  container: { maxWidth: 720 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  pinRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  fieldLabel: { fontSize: 13, color: '#555', marginBottom: 2 },
  input: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    outline: 'none',
    width: 220,
    boxSizing: 'border-box' as const,
  },
  inputFull: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    background: '#fff',
  },
  btn: {
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: '#1976d2',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  deleteBtn: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
    background: '#d32f2f',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 14,
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 10px',
    borderBottom: '2px solid #e0e0e0',
    color: '#555',
    fontWeight: 600,
    fontSize: 13,
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  empty: {
    padding: 24,
    textAlign: 'center' as const,
    color: '#999',
    fontSize: 14,
  },
  tabs: {
    display: 'flex',
    gap: 0,
    marginBottom: 16,
  },
  tab: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid #ccc',
    background: '#f5f5f5',
    color: '#555',
  },
  tabActive: {
    background: '#1976d2',
    color: '#fff',
    borderColor: '#1976d2',
  },
  tabFirst: { borderRadius: '6px 0 0 6px' },
  tabLast: { borderRadius: '0 6px 6px 0' },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  error: { color: '#c62828', fontSize: 13, marginTop: -4 },
};

type KeyAlgo = 'RSA' | 'EC' | 'AES';

function formatKeyType(kt: HsmKeyType): string {
  if ('Rsa' in kt) return 'RSA';
  if ('Ec' in kt) return `EC (${kt.Ec.curve})`;
  if ('Aes' in kt) return 'AES';
  return '—';
}

function keyTypeToDeleteArg(kt: HsmKeyType): string {
  if ('Rsa' in kt) return 'Rsa';
  if ('Ec' in kt) return 'Ec';
  if ('Aes' in kt) return 'Aes';
  return 'Rsa';
}

export default function HsmKeys() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);
  const keys = useHsmStore((s) => s.keys);

  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<HsmKeyInfo | null>(null);
  const [loadError, setLoadError] = useState('');

  // Generate form state
  const [algo, setAlgo] = useState<KeyAlgo>('RSA');
  const [rsaBits, setRsaBits] = useState(2048);
  const [ecCurve, setEcCurve] = useState('secp256r1');
  const [aesBits, setAesBits] = useState(256);
  const [genId, setGenId] = useState('');
  const [genLabel, setGenLabel] = useState('');
  const [genErrors, setGenErrors] = useState<Record<string, string>>({});

  const refreshKeys = async () => {
    if (!devicePath) return;
    setLoading(true);
    try {
      const list = await hsmListKeys(devicePath, pin);
      useHsmStore.setState({ keys: list });
      setLoadError('');
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!pin || !devicePath) return;
    setLoading(true);
    try {
      const list = await hsmListKeys(devicePath, pin);
      useHsmStore.setState({ keys: list });
      setUnlocked(true);
      setLoadError('');
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmTarget || !devicePath) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    setSubmitting(true);
    try {
      await hsmDeleteKey(devicePath, pin, target.id, keyTypeToDeleteArg(target.keyType));
      setNotification({ message: t.hsmKeys.keyDeleted, type: 'success' });
      await refreshKeys();
    } catch (e) {
      setNotification({ message: `${t.hsmKeys.deleteKeyFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    const errs: Record<string, string> = {};
    const idNum = parseInt(genId, 10);
    if (!genId || isNaN(idNum) || idNum < 0 || idNum > 255) errs.genId = t.hsmKeys.idError;
    if (algo !== 'AES' && !genLabel.trim()) errs.genLabel = t.hsmKeys.labelError;
    setGenErrors(errs);
    if (Object.keys(errs).length) return;
    if (!devicePath) return;

    setGenerating(true);
    try {
      if (algo === 'RSA') {
        await hsmGenerateRsaKey(devicePath, pin, rsaBits, idNum, genLabel);
      } else if (algo === 'EC') {
        await hsmGenerateEcKey(devicePath, pin, ecCurve, idNum, genLabel);
      } else {
        await hsmGenerateAesKey(devicePath, pin, aesBits, idNum);
      }
      setNotification({ message: t.hsmKeys.keyGenSuccess, type: 'success' });
      setGenId('');
      setGenLabel('');
      setGenErrors({});
      await refreshKeys();
    } catch (e) {
      setNotification({ message: `${t.hsmKeys.keyGenFailed}：${e}`, type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={styles.container}>
      <Notification
        message={notification?.message ?? ''}
        type={notification?.type ?? 'success'}
        visible={!!notification}
        onClose={() => setNotification(null)}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        title={t.hsmKeys.deleteKey}
        message={t.hsmKeys.deleteKeyConfirm.replace('{id}', String(confirmTarget?.id ?? '')).replace('{type}', confirmTarget ? formatKeyType(confirmTarget.keyType) : '')}
        confirmLabel={t.common.delete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmTarget(null)}
        destructive
      />

      {/* PIN unlock */}
      {!unlocked && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.hsmKeys.enterPinToView}</div>
          <div style={styles.pinRow}>
            <div>
              <div style={styles.fieldLabel}>{t.common.pin}</div>
              <input
                style={styles.input}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t.hsmKeys.enterDevicePin}
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              />
            </div>
            <button
              style={{ ...styles.btn, ...(loading || !pin ? styles.btnDisabled : {}) }}
              onClick={handleUnlock}
              disabled={loading || !pin}
            >
              {loading ? t.common.loading : t.common.unlock}
            </button>
          </div>
          {loadError && <div style={styles.error}>{loadError}</div>}
        </div>
      )}

      {/* Key list */}
      {unlocked && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.hsmKeys.keyList}</div>
            {loading ? (
              <LoadingIndicator message={t.hsmKeys.loadingKeys} />
            ) : keys.length === 0 ? (
              <div style={styles.empty}>{t.hsmKeys.noKeys}</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.common.id}</th>
                    <th style={styles.th}>{t.common.label}</th>
                    <th style={styles.th}>{t.common.type}</th>
                    <th style={styles.th}>{t.hsmKeys.length}</th>
                    <th style={styles.th}>{t.hsmKeys.usage}</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={`${key.id}-${key.keyRef}`}>
                      <td style={styles.td}>{key.id}</td>
                      <td style={styles.td}>{key.label || '—'}</td>
                      <td style={styles.td}>{formatKeyType(key.keyType)}</td>
                      <td style={styles.td}>{key.keySize}</td>
                      <td style={styles.td}>{key.usage.join(', ') || '—'}</td>
                      <td style={styles.td}>
                        <button
                          style={{ ...styles.deleteBtn, ...(submitting ? styles.btnDisabled : {}) }}
                          onClick={() => setConfirmTarget(key)}
                          disabled={submitting}
                        >
                          {t.common.delete}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Generate key */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.hsmKeys.generateKey}</div>

            {generating ? (
              <LoadingIndicator
                message={algo === 'RSA' ? t.hsmKeys.rsaGenerating : t.hsmKeys.generating}
              />
            ) : (
              <>
                <div style={styles.tabs}>
                  {(['RSA', 'EC', 'AES'] as KeyAlgo[]).map((a, i) => (
                    <button
                      key={a}
                      style={{
                        ...styles.tab,
                        ...(algo === a ? styles.tabActive : {}),
                        ...(i === 0 ? styles.tabFirst : {}),
                        ...(i === 2 ? styles.tabLast : {}),
                      }}
                      onClick={() => { setAlgo(a); setGenErrors({}); }}
                    >
                      {a}
                    </button>
                  ))}
                </div>

                <div style={styles.form}>
                  {algo === 'RSA' && (
                    <div>
                      <div style={styles.fieldLabel}>{t.hsmKeys.keyBits}</div>
                      <select style={styles.select} value={rsaBits} onChange={(e) => setRsaBits(Number(e.target.value))}>
                        <option value={1024}>1024</option>
                        <option value={2048}>2048</option>
                        <option value={3072}>3072</option>
                        <option value={4096}>4096</option>
                      </select>
                    </div>
                  )}

                  {algo === 'EC' && (
                    <div>
                      <div style={styles.fieldLabel}>{t.hsmKeys.curve}</div>
                      <select style={styles.select} value={ecCurve} onChange={(e) => setEcCurve(e.target.value)}>
                        <option value="secp256r1">secp256r1</option>
                        <option value="secp384r1">secp384r1</option>
                        <option value="secp521r1">secp521r1</option>
                        <option value="brainpoolP256r1">brainpoolP256r1</option>
                      </select>
                    </div>
                  )}

                  {algo === 'AES' && (
                    <div>
                      <div style={styles.fieldLabel}>{t.hsmKeys.keyBits}</div>
                      <select style={styles.select} value={aesBits} onChange={(e) => setAesBits(Number(e.target.value))}>
                        <option value={128}>128</option>
                        <option value={192}>192</option>
                        <option value={256}>256</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <div style={styles.fieldLabel}>{t.hsmKeys.keyId}</div>
                    <input
                      style={styles.inputFull}
                      type="number"
                      min={0}
                      max={255}
                      value={genId}
                      onChange={(e) => setGenId(e.target.value)}
                      placeholder="0-255"
                    />
                    {genErrors.genId && <div style={styles.error}>{genErrors.genId}</div>}
                  </div>

                  {algo !== 'AES' && (
                    <div>
                      <div style={styles.fieldLabel}>{t.hsmKeys.keyLabel}</div>
                      <input
                        style={styles.inputFull}
                        type="text"
                        value={genLabel}
                        onChange={(e) => setGenLabel(e.target.value)}
                        placeholder={t.hsmKeys.keyLabel}
                      />
                      {genErrors.genLabel && <div style={styles.error}>{genErrors.genLabel}</div>}
                    </div>
                  )}

                  <button
                    style={{ ...styles.btn, alignSelf: 'flex-start' as const }}
                    onClick={handleGenerate}
                  >
                    {t.hsmKeys.generateBtn}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
