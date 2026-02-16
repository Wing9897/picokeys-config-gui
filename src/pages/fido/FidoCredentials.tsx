import { useState, useEffect } from 'react';
import { useFidoStore } from '../../store/fidoStore';
import { useDeviceStore } from '../../store/deviceStore';
import { useI18n } from '../../i18n';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingIndicator from '../../components/LoadingIndicator';
import Notification from '../../components/Notification';

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
  unsupported: {
    padding: 16,
    background: '#fff3e0',
    borderLeft: '4px solid #ff9800',
    borderRadius: 6,
    fontSize: 14,
    color: '#e65100',
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
};

function formatDate(ts?: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts * 1000).toLocaleDateString();
  } catch {
    return '—';
  }
}

export default function FidoCredentials() {
  const t = useI18n();
  const info = useFidoStore((s) => s.info);
  const credentials = useFidoStore((s) => s.credentials);
  const loading = useFidoStore((s) => s.loading);
  const error = useFidoStore((s) => s.error);
  const loadInfo = useFidoStore((s) => s.loadInfo);
  const loadCredentials = useFidoStore((s) => s.loadCredentials);
  const deleteCredential = useFidoStore((s) => s.deleteCredential);
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);

  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ credentialId: number[]; label: string } | null>(null);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const supportsCredMgmt = info?.options?.['credMgmt'] === true || info?.options?.['credentialMgmtPreview'] === true;

  if (loading && !unlocked) return <LoadingIndicator message={t.fidoCreds.loadingInfo} />;

  if (info && !supportsCredMgmt) {
    return (
      <div style={styles.container}>
        <div style={styles.unsupported}>
          {t.fidoCreds.notSupported}
        </div>
      </div>
    );
  }

  const handleUnlock = async () => {
    if (!pin || !devicePath) return;
    setSubmitting(true);
    await loadCredentials(pin);
    setSubmitting(false);
    const storeError = useFidoStore.getState().error;
    if (!storeError) {
      setUnlocked(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmTarget || !devicePath) return;
    setConfirmTarget(null);
    setSubmitting(true);
    await deleteCredential(pin, confirmTarget.credentialId);
    setSubmitting(false);
    const storeError = useFidoStore.getState().error;
    if (storeError) {
      setNotification({ message: `${t.fidoCreds.deleteCredFailed}：${storeError}`, type: 'error' });
    } else {
      setNotification({ message: t.fidoCreds.credDeleted, type: 'success' });
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
        title={t.fidoCreds.deleteCred}
        message={t.fidoCreds.deleteCredConfirm.replace('{label}', confirmTarget?.label ?? '')}
        confirmLabel={t.common.delete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmTarget(null)}
        destructive
      />

      {/* PIN unlock */}
      {!unlocked && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoCreds.enterPinToView}</div>
          <div style={styles.pinRow}>
            <div>
              <div style={styles.fieldLabel}>{t.common.pin}</div>
              <input
                style={styles.input}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t.fidoCreds.enterDevicePin}
                disabled={submitting}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              />
            </div>
            <button
              style={{ ...styles.btn, ...(submitting || !pin ? styles.btnDisabled : {}) }}
              onClick={handleUnlock}
              disabled={submitting || !pin}
            >
              {submitting ? t.common.loading : t.common.unlock}
            </button>
          </div>
          {error && <div style={{ color: '#c62828', fontSize: 13 }}>{error}</div>}
        </div>
      )}

      {/* Credential list */}
      {unlocked && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoCreds.discoverableCreds}</div>
          {loading ? (
            <LoadingIndicator message={t.fidoCreds.loadingCreds} />
          ) : credentials.length === 0 ? (
            <div style={styles.empty}>{t.fidoCreds.noCreds}</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{t.fidoCreds.rpId}</th>
                  <th style={styles.th}>{t.fidoCreds.rpName}</th>
                  <th style={styles.th}>{t.fidoCreds.userName}</th>
                  <th style={styles.th}>{t.fidoCreds.createdAt}</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => (
                  <tr key={cred.rpId + '-' + cred.credentialId.join(',')}>
                    <td style={styles.td}>{cred.rpId}</td>
                    <td style={styles.td}>{cred.rpName ?? '—'}</td>
                    <td style={styles.td}>{cred.userName ?? '—'}</td>
                    <td style={styles.td}>{formatDate(cred.creationTime)}</td>
                    <td style={styles.td}>
                      <button
                        style={{ ...styles.deleteBtn, ...(submitting ? styles.btnDisabled : {}) }}
                        onClick={() =>
                          setConfirmTarget({
                            credentialId: cred.credentialId,
                            label: cred.rpId + (cred.userName ? ` (${cred.userName})` : ''),
                          })
                        }
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
      )}
    </div>
  );
}
