import { useState, useEffect } from 'react';
import { useFidoStore } from '../../store/fidoStore';
import { useDeviceStore } from '../../store/deviceStore';
import { useI18n } from '../../i18n';
import { fidoAddOath, fidoCalculateOath, fidoDeleteOath } from '../../api/fido';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingIndicator from '../../components/LoadingIndicator';
import Notification from '../../components/Notification';
import type { OathType, OathCredentialParams } from '../../types';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(input: string): number[] {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const val = BASE32_CHARS.indexOf(ch);
    if (val === -1) continue;
    buffer = (buffer << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

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
  calcBtn: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
    background: '#388e3c',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    marginRight: 6,
  },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  fieldLabel: { fontSize: 13, color: '#555', marginBottom: 2 },
  input: {
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
    boxSizing: 'border-box' as const,
    background: '#fff',
  },
  row: { display: 'flex', gap: 12 },
  error: { color: '#c62828', fontSize: 13, marginTop: -4 },
  otpDisplay: {
    display: 'inline-block',
    padding: '4px 12px',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 600,
    background: '#e8f5e9',
    borderRadius: 6,
    color: '#2e7d32',
    letterSpacing: 2,
  },
};

export default function FidoOath() {
  const t = useI18n();
  const oathCredentials = useFidoStore((s) => s.oathCredentials);
  const loading = useFidoStore((s) => s.loading);
  const storeError = useFidoStore((s) => s.error);
  const loadOathCredentials = useFidoStore((s) => s.loadOathCredentials);
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);
  const [otpResults, setOtpResults] = useState<Record<string, string>>({});

  // Add form state
  const [issuer, setIssuer] = useState('');
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');
  const [oathType, setOathType] = useState<OathType>('Totp');
  const [digits, setDigits] = useState<6 | 8>(6);
  const [period, setPeriod] = useState(30);
  const [counter, setCounter] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadOathCredentials();
  }, [loadOathCredentials]);

  const handleCalculate = async (credentialId: string) => {
    if (!devicePath) return;
    setSubmitting(true);
    try {
      const otp = await fidoCalculateOath(devicePath, credentialId);
      setOtpResults((prev) => ({ ...prev, [credentialId]: otp }));
    } catch (e) {
      setNotification({ message: `${t.fidoOath.calcFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmTarget || !devicePath) return;
    const { id } = confirmTarget;
    setConfirmTarget(null);
    setSubmitting(true);
    try {
      await fidoDeleteOath(devicePath, id);
      setNotification({ message: t.fidoOath.oathDeleted, type: 'success' });
      setOtpResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadOathCredentials();
    } catch (e) {
      setNotification({ message: `${t.fidoOath.deleteOathFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async () => {
    const errs: Record<string, string> = {};
    if (!account.trim()) errs.account = t.fidoOath.enterAccount;
    if (!secret.trim()) errs.secret = t.fidoOath.enterSecret;
    const decoded = decodeBase32(secret);
    if (secret.trim() && decoded.length === 0) errs.secret = t.fidoOath.invalidBase32;
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    if (!devicePath) return;

    setFieldErrors({});
    setSubmitting(true);
    try {
      const params: OathCredentialParams = {
        secret: decoded,
        issuer: issuer.trim(),
        account: account.trim(),
        oathType,
        digits,
        period: oathType === 'Totp' ? period : undefined,
        counter: oathType === 'Hotp' ? counter : undefined,
      };
      await fidoAddOath(devicePath, params);
      setNotification({ message: t.fidoOath.addSuccess, type: 'success' });
      setIssuer('');
      setAccount('');
      setSecret('');
      setOathType('Totp');
      setDigits(6);
      setPeriod(30);
      setCounter(0);
      setShowAddForm(false);
      await loadOathCredentials();
    } catch (e) {
      setNotification({ message: `${t.fidoOath.addFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && oathCredentials.length === 0) return <LoadingIndicator message={t.fidoOath.loadingOath} />;

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
        title={t.fidoOath.deleteOath}
        message={t.fidoOath.deleteOathConfirm.replace('{label}', confirmTarget?.label ?? '')}
        confirmLabel={t.common.delete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmTarget(null)}
        destructive
      />

      {/* Credential list */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={styles.sectionTitle}>{t.fidoOath.oathCreds}</div>
          <button
            style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={submitting}
          >
            {showAddForm ? t.fidoOath.cancelBtn : t.fidoOath.addBtn}
          </button>
        </div>

        {storeError && <div style={{ color: '#c62828', fontSize: 13, marginBottom: 8 }}>{storeError}</div>}

        {oathCredentials.length === 0 ? (
          <div style={styles.empty}>{t.fidoOath.noOathCreds}</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.fidoOath.issuerCol}</th>
                <th style={styles.th}>{t.fidoOath.accountCol}</th>
                <th style={styles.th}>{t.fidoOath.typeCol}</th>
                <th style={styles.th}>{t.fidoOath.periodCol}</th>
                <th style={styles.th}>{t.fidoOath.otpCol}</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {oathCredentials.map((cred) => (
                <tr key={cred.id}>
                  <td style={styles.td}>{cred.issuer ?? '—'}</td>
                  <td style={styles.td}>{cred.account}</td>
                  <td style={styles.td}>{cred.oathType === 'Totp' ? 'TOTP' : 'HOTP'}</td>
                  <td style={styles.td}>{cred.oathType === 'Totp' ? `${cred.period ?? 30}s` : '—'}</td>
                  <td style={styles.td}>
                    {otpResults[cred.id] ? (
                      <span style={styles.otpDisplay}>{otpResults[cred.id]}</span>
                    ) : (
                      <button
                        style={{ ...styles.calcBtn, ...(submitting ? styles.btnDisabled : {}) }}
                        onClick={() => handleCalculate(cred.id)}
                        disabled={submitting}
                      >
                        {t.fidoOath.calcOtp}
                      </button>
                    )}
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{ ...styles.deleteBtn, ...(submitting ? styles.btnDisabled : {}) }}
                      onClick={() =>
                        setConfirmTarget({
                          id: cred.id,
                          label: (cred.issuer ? cred.issuer + ':' : '') + cred.account,
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

      {/* Add form */}
      {showAddForm && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoOath.addOathTitle}</div>
          <div style={styles.form}>
            <div>
              <div style={styles.fieldLabel}>{t.fidoOath.issuerOptional}</div>
              <input
                style={styles.input}
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="Google"
                disabled={submitting}
              />
            </div>
            <div>
              <div style={styles.fieldLabel}>{t.fidoOath.account}</div>
              <input
                style={styles.input}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="user@example.com"
                disabled={submitting}
              />
              {fieldErrors.account && <div style={styles.error}>{fieldErrors.account}</div>}
            </div>
            <div>
              <div style={styles.fieldLabel}>{t.fidoOath.secretBase32}</div>
              <input
                style={styles.input}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="JBSWY3DPEHPK3PXP"
                disabled={submitting}
              />
              {fieldErrors.secret && <div style={styles.error}>{fieldErrors.secret}</div>}
            </div>
            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>{t.fidoOath.type}</div>
                <select
                  style={styles.select as React.CSSProperties}
                  value={oathType}
                  onChange={(e) => setOathType(e.target.value as OathType)}
                  disabled={submitting}
                >
                  <option value="Totp">TOTP</option>
                  <option value="Hotp">HOTP</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>{t.fidoOath.digits}</div>
                <select
                  style={styles.select as React.CSSProperties}
                  value={digits}
                  onChange={(e) => setDigits(Number(e.target.value) as 6 | 8)}
                  disabled={submitting}
                >
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                </select>
              </div>
              {oathType === 'Totp' && (
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>{t.fidoOath.periodSec}</div>
                  <select
                    style={styles.select as React.CSSProperties}
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    disabled={submitting}
                  >
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                  </select>
                </div>
              )}
              {oathType === 'Hotp' && (
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>{t.fidoOath.counterInit}</div>
                  <input
                    style={styles.input}
                    type="number"
                    min={0}
                    value={counter}
                    onChange={(e) => setCounter(Number(e.target.value))}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
            <button
              style={{ ...styles.btn, alignSelf: 'flex-start' as const, ...(submitting ? styles.btnDisabled : {}) }}
              onClick={handleAdd}
              disabled={submitting}
            >
              {submitting ? t.fidoOath.adding : t.fidoOath.addOathBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
