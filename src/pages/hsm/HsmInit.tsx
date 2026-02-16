import { useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { hsmInitialize } from '../../api/hsm';
import { useI18n } from '../../i18n';
import Notification from '../../components/Notification';
import ConfirmDialog from '../../components/ConfirmDialog';

const styles = {
  container: { maxWidth: 480 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
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
  btn: {
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: '#d32f2f',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: { color: '#c62828', fontSize: 13, marginTop: -4 },
  hint: { fontSize: 12, color: '#999', marginTop: 2 },
  dkekNotice: {
    padding: 12,
    background: '#e3f2fd',
    borderLeft: '4px solid #1976d2',
    borderRadius: 6,
    fontSize: 13,
    color: '#1565c0',
    lineHeight: 1.5,
  },
};

const HEX_RE = /^[0-9a-fA-F]{16}$/;

export default function HsmInit() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);

  const [pin, setPin] = useState('');
  const [soPin, setSoPin] = useState('');
  const [dkekShares, setDkekShares] = useState('0');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDkekNotice, setShowDkekNotice] = useState(false);
  const [completedShares, setCompletedShares] = useState(0);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (pin.length < 6 || pin.length > 16) errs.pin = t.hsmInit.pinError;
    if (!HEX_RE.test(soPin)) errs.soPin = t.hsmInit.soPinError;
    const shares = Number(dkekShares);
    if (!Number.isInteger(shares) || shares < 0 || shares > 255) errs.dkekShares = t.hsmInit.dkekError;
    return errs;
  }

  const handleSubmit = () => {
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    if (!devicePath) return;
    setSubmitting(true);
    try {
      await hsmInitialize(devicePath, pin, soPin, Number(dkekShares));
      const shares = Number(dkekShares);
      setNotification({ message: t.hsmInit.initSuccess, type: 'success' });
      setCompletedShares(shares);
      setShowDkekNotice(shares > 0);
      setPin('');
      setSoPin('');
      setDkekShares('0');
      setFieldErrors({});
    } catch (e) {
      setNotification({ message: `${t.hsmInit.initFailed}：${e}`, type: 'error' });
      setShowDkekNotice(false);
    } finally {
      setSubmitting(false);
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
        open={confirmOpen}
        title={t.hsmInit.confirmTitle}
        message={t.hsmInit.confirmMsg}
        confirmLabel={t.hsmInit.confirmBtn}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        destructive
      />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmInit.title}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.hsmInit.pinLabel}</div>
            <input
              style={styles.input}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t.hsmInit.pinPlaceholder}
              disabled={submitting}
            />
            {fieldErrors.pin && <div style={styles.error}>{fieldErrors.pin}</div>}
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmInit.soPinLabel}</div>
            <input
              style={styles.input}
              type="password"
              value={soPin}
              onChange={(e) => setSoPin(e.target.value)}
              placeholder={t.hsmInit.soPinPlaceholder}
              disabled={submitting}
            />
            <div style={styles.hint}>{t.hsmInit.soPinHint}</div>
            {fieldErrors.soPin && <div style={styles.error}>{fieldErrors.soPin}</div>}
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmInit.dkekShares}</div>
            <input
              style={{ ...styles.input, maxWidth: 120 }}
              type="number"
              min={0}
              max={255}
              value={dkekShares}
              onChange={(e) => setDkekShares(e.target.value)}
              disabled={submitting}
            />
            <div style={styles.hint}>{t.hsmInit.dkekSharesHint}</div>
            {fieldErrors.dkekShares && <div style={styles.error}>{fieldErrors.dkekShares}</div>}
          </div>
          <button
            style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? t.hsmInit.initializing : t.hsmInit.initBtn}
          </button>
        </div>
      </div>

      {showDkekNotice && (
        <div style={styles.dkekNotice}>
          {t.hsmInit.dkekNotice.replace('{n}', String(completedShares))}
        </div>
      )}
    </div>
  );
}
