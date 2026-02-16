import { useState, useEffect, useCallback } from 'react';
import { useFidoStore } from '../../store/fidoStore';
import { useDeviceStore } from '../../store/deviceStore';
import { fidoSetPin, fidoChangePin, fidoGetPinRetries } from '../../api/fido';
import { useI18n } from '../../i18n';
import LoadingIndicator from '../../components/LoadingIndicator';
import Notification from '../../components/Notification';

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
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f0f0f0',
    fontSize: 14,
  },
  label: { color: '#666' },
  value: { color: '#222', fontWeight: 500 },
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
    background: '#1976d2',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: { color: '#c62828', fontSize: 13, marginTop: -4 },
  locked: {
    padding: 16,
    background: '#ffebee',
    borderLeft: '4px solid #f44336',
    borderRadius: 6,
    fontSize: 14,
    color: '#c62828',
  },
  retriesBadge: (n: number) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    background: n === 0 ? '#ffebee' : n <= 3 ? '#fff3e0' : '#e8f5e9',
    color: n === 0 ? '#c62828' : n <= 3 ? '#e65100' : '#2e7d32',
  }),
};

export default function FidoPin() {
  const t = useI18n();
  const info = useFidoStore((s) => s.info);
  const loading = useFidoStore((s) => s.loading);
  const loadInfo = useFidoStore((s) => s.loadInfo);
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);

  const [pinRetries, setPinRetries] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set PIN fields
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Change PIN fields
  const [oldPin, setOldPin] = useState('');
  const [chgNewPin, setChgNewPin] = useState('');
  const [chgConfirmPin, setChgConfirmPin] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const pinSet = info?.pinSet ?? false;
  const locked = pinRetries === 0;

  /** Validate PIN is 4-63 bytes */
  const validatePinLength = (pin: string): string | null => {
    const len = new TextEncoder().encode(pin).length;
    if (len < 4) return t.fidoPin.pinTooShort;
    if (len > 63) return t.fidoPin.pinTooLong;
    return null;
  };

  const refreshRetries = useCallback(async () => {
    if (!devicePath) return;
    try {
      const r = await fidoGetPinRetries(devicePath);
      setPinRetries(r);
    } catch {
      if (info) setPinRetries(info.pinRetries);
    }
  }, [devicePath, info]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (info) setPinRetries(info.pinRetries);
  }, [info]);

  useEffect(() => {
    refreshRetries();
  }, [refreshRetries]);

  const clearForm = () => {
    setNewPin('');
    setConfirmPin('');
    setOldPin('');
    setChgNewPin('');
    setChgConfirmPin('');
    setFieldErrors({});
  };

  const handleSetPin = async () => {
    const errs: Record<string, string> = {};
    const pinErr = validatePinLength(newPin);
    if (pinErr) errs.newPin = pinErr;
    if (newPin !== confirmPin) errs.confirmPin = t.fidoPin.pinMismatch;
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    if (!devicePath) return;

    setFieldErrors({});
    setSubmitting(true);
    try {
      await fidoSetPin(devicePath, newPin);
      setNotification({ message: t.fidoPin.setPinSuccess, type: 'success' });
      clearForm();
      await loadInfo();
      await refreshRetries();
    } catch (e) {
      setNotification({ message: `${t.fidoPin.setPinFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePin = async () => {
    const errs: Record<string, string> = {};
    const pinErr = validatePinLength(chgNewPin);
    if (pinErr) errs.chgNewPin = pinErr;
    if (!oldPin) errs.oldPin = t.fidoPin.enterOldPin;
    if (chgNewPin !== chgConfirmPin) errs.chgConfirmPin = t.fidoPin.pinMismatch;
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    if (!devicePath) return;

    setFieldErrors({});
    setSubmitting(true);
    try {
      await fidoChangePin(devicePath, oldPin, chgNewPin);
      setNotification({ message: t.fidoPin.changePinSuccess, type: 'success' });
      clearForm();
      await refreshRetries();
    } catch (e) {
      setNotification({ message: `${t.fidoPin.changePinFailed}：${e}`, type: 'error' });
      await refreshRetries();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingIndicator message={t.fidoPin.loadingPin} />;

  return (
    <div style={styles.container}>
      <Notification
        message={notification?.message ?? ''}
        type={notification?.type ?? 'success'}
        visible={!!notification}
        onClose={() => setNotification(null)}
      />

      {/* Retries */}
      {pinRetries !== null && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoPin.pinStatus}</div>
          <div style={styles.row}>
            <span style={styles.label}>{t.fidoPin.pinSet}</span>
            <span style={styles.value}>{pinSet ? t.common.yes : t.common.no}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>{t.fidoPin.retriesLeft}</span>
            <span style={styles.retriesBadge(pinRetries)}>{pinRetries}</span>
          </div>
        </div>
      )}

      {/* Locked */}
      {locked && (
        <div style={styles.locked}>
          {t.fidoPin.pinLockedMsg}
        </div>
      )}

      {/* Set PIN form (pinSet === false) */}
      {!pinSet && !locked && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoPin.setPin}</div>
          <div style={styles.form}>
            <div>
              <div style={styles.fieldLabel}>{t.fidoPin.newPin}</div>
              <input
                style={styles.input}
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="4-63 bytes"
                disabled={submitting}
              />
              {fieldErrors.newPin && <div style={styles.error}>{fieldErrors.newPin}</div>}
            </div>
            <div>
              <div style={styles.fieldLabel}>{t.fidoPin.confirmPin}</div>
              <input
                style={styles.input}
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder={t.fidoPin.reenterPin}
                disabled={submitting}
              />
              {fieldErrors.confirmPin && <div style={styles.error}>{fieldErrors.confirmPin}</div>}
            </div>
            <button
              style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
              onClick={handleSetPin}
              disabled={submitting}
            >
              {submitting ? t.fidoPin.setting : t.fidoPin.setPinBtn}
            </button>
          </div>
        </div>
      )}

      {/* Change PIN form (pinSet === true) */}
      {pinSet && !locked && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoPin.changePin}</div>
          <div style={styles.form}>
            <div>
              <div style={styles.fieldLabel}>{t.fidoPin.oldPin}</div>
              <input
                style={styles.input}
                type="password"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                disabled={submitting}
              />
              {fieldErrors.oldPin && <div style={styles.error}>{fieldErrors.oldPin}</div>}
            </div>
            <div>
              <div style={styles.fieldLabel}>{t.fidoPin.newPin}</div>
              <input
                style={styles.input}
                type="password"
                value={chgNewPin}
                onChange={(e) => setChgNewPin(e.target.value)}
                placeholder="4-63 bytes"
                disabled={submitting}
              />
              {fieldErrors.chgNewPin && <div style={styles.error}>{fieldErrors.chgNewPin}</div>}
            </div>
            <div>
              <div style={styles.fieldLabel}>{t.fidoPin.confirmPin}</div>
              <input
                style={styles.input}
                type="password"
                value={chgConfirmPin}
                onChange={(e) => setChgConfirmPin(e.target.value)}
                placeholder={t.fidoPin.reenterPin}
                disabled={submitting}
              />
              {fieldErrors.chgConfirmPin && <div style={styles.error}>{fieldErrors.chgConfirmPin}</div>}
            </div>
            <button
              style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
              onClick={handleChangePin}
              disabled={submitting}
            >
              {submitting ? t.fidoPin.changing : t.fidoPin.changePinBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
