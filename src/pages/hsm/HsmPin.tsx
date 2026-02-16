import { useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { hsmChangePin, hsmChangeSoPin, hsmUnblockPin } from '../../api/hsm';
import { useI18n } from '../../i18n';
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
  hint: { fontSize: 12, color: '#999', marginTop: 2 },
  locked: {
    padding: 16,
    background: '#ffebee',
    borderLeft: '4px solid #f44336',
    borderRadius: 6,
    fontSize: 14,
    color: '#c62828',
    marginBottom: 24,
  },
};

const PIN_RE = /^.{6,16}$/;
const SOPIN_RE = /^[0-9a-fA-F]{16}$/;

export default function HsmPin() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);

  // Change PIN
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Change SO-PIN
  const [oldSoPin, setOldSoPin] = useState('');
  const [newSoPin, setNewSoPin] = useState('');
  const [confirmSoPin, setConfirmSoPin] = useState('');

  // Unblock PIN
  const [ubSoPin, setUbSoPin] = useState('');
  const [ubNewPin, setUbNewPin] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const validatePin = (pin: string): string | null => {
    if (!PIN_RE.test(pin)) return t.hsmInit.pinError;
    return null;
  };

  const validateSoPin = (soPin: string): string | null => {
    if (!SOPIN_RE.test(soPin)) return t.hsmInit.soPinError;
    return null;
  };

  const clearChangePin = () => { setOldPin(''); setNewPin(''); setConfirmPin(''); };
  const clearChangeSoPin = () => { setOldSoPin(''); setNewSoPin(''); setConfirmSoPin(''); };
  const clearUnblock = () => { setUbSoPin(''); setUbNewPin(''); };

  const handleChangePin = async () => {
    const errs: Record<string, string> = {};
    if (!oldPin) errs.oldPin = t.hsmPin.enterOldPin;
    const pinErr = validatePin(newPin);
    if (pinErr) errs.newPin = pinErr;
    if (newPin !== confirmPin) errs.confirmPin = t.hsmPin.pinMismatch;
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    if (!devicePath) return;

    setSubmitting(true);
    try {
      await hsmChangePin(devicePath, oldPin, newPin);
      setNotification({ message: t.hsmPin.changePinSuccess, type: 'success' });
      clearChangePin();
      setFieldErrors({});
    } catch (e) {
      setNotification({ message: `${t.hsmPin.changePinFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeSoPin = async () => {
    const errs: Record<string, string> = {};
    const oldErr = validateSoPin(oldSoPin);
    if (oldErr) errs.oldSoPin = oldErr;
    const newErr = validateSoPin(newSoPin);
    if (newErr) errs.newSoPin = newErr;
    if (newSoPin !== confirmSoPin) errs.confirmSoPin = t.hsmPin.soPinMismatch;
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    if (!devicePath) return;

    setSubmitting(true);
    try {
      await hsmChangeSoPin(devicePath, oldSoPin, newSoPin);
      setNotification({ message: t.hsmPin.changeSoPinSuccess, type: 'success' });
      clearChangeSoPin();
      setFieldErrors({});
    } catch (e) {
      setNotification({ message: `${t.hsmPin.changeSoPinFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblockPin = async () => {
    const errs: Record<string, string> = {};
    const soPinErr = validateSoPin(ubSoPin);
    if (soPinErr) errs.ubSoPin = soPinErr;
    const pinErr = validatePin(ubNewPin);
    if (pinErr) errs.ubNewPin = pinErr;
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    if (!devicePath) return;

    setSubmitting(true);
    try {
      await hsmUnblockPin(devicePath, ubSoPin, ubNewPin);
      setNotification({ message: t.hsmPin.unblockSuccess, type: 'success' });
      clearUnblock();
      setFieldErrors({});
    } catch (e) {
      setNotification({ message: `${t.hsmPin.unblockFailed}：${e}`, type: 'error' });
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

      <div style={styles.locked}>
        {t.hsmPin.lockWarning}
      </div>

      {/* Change PIN */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmPin.changePin}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.hsmPin.oldPin}</div>
            <input style={styles.input} type="password" value={oldPin} onChange={(e) => setOldPin(e.target.value)} disabled={submitting} />
            {fieldErrors.oldPin && <div style={styles.error}>{fieldErrors.oldPin}</div>}
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmPin.newPin}</div>
            <input style={styles.input} type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder={t.hsmInit.pinPlaceholder} disabled={submitting} />
            {fieldErrors.newPin && <div style={styles.error}>{fieldErrors.newPin}</div>}
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmPin.confirmNewPin}</div>
            <input style={styles.input} type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder={t.hsmPin.reenterPin} disabled={submitting} />
            {fieldErrors.confirmPin && <div style={styles.error}>{fieldErrors.confirmPin}</div>}
          </div>
          <button style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }} onClick={handleChangePin} disabled={submitting}>
            {submitting ? t.hsmPin.changing : t.hsmPin.changePinBtn}
          </button>
        </div>
      </div>

      {/* Change SO-PIN */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmPin.changeSoPin}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.hsmPin.oldSoPin}</div>
            <input style={styles.input} type="password" value={oldSoPin} onChange={(e) => setOldSoPin(e.target.value)} placeholder={t.hsmInit.soPinPlaceholder} disabled={submitting} />
            <div style={styles.hint}>{t.hsmInit.soPinHint}</div>
            {fieldErrors.oldSoPin && <div style={styles.error}>{fieldErrors.oldSoPin}</div>}
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmPin.newSoPin}</div>
            <input style={styles.input} type="password" value={newSoPin} onChange={(e) => setNewSoPin(e.target.value)} placeholder={t.hsmInit.soPinPlaceholder} disabled={submitting} />
            {fieldErrors.newSoPin && <div style={styles.error}>{fieldErrors.newSoPin}</div>}
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmPin.confirmNewSoPin}</div>
            <input style={styles.input} type="password" value={confirmSoPin} onChange={(e) => setConfirmSoPin(e.target.value)} placeholder={t.hsmPin.reenterSoPin} disabled={submitting} />
            {fieldErrors.confirmSoPin && <div style={styles.error}>{fieldErrors.confirmSoPin}</div>}
          </div>
          <button style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }} onClick={handleChangeSoPin} disabled={submitting}>
            {submitting ? t.hsmPin.changing : t.hsmPin.changeSoPinBtn}
          </button>
        </div>
      </div>

      {/* Unblock PIN */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmPin.unblockPin}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.common.soPin}</div>
            <input style={styles.input} type="password" value={ubSoPin} onChange={(e) => setUbSoPin(e.target.value)} placeholder={t.hsmInit.soPinPlaceholder} disabled={submitting} />
            {fieldErrors.ubSoPin && <div style={styles.error}>{fieldErrors.ubSoPin}</div>}
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmPin.newPin}</div>
            <input style={styles.input} type="password" value={ubNewPin} onChange={(e) => setUbNewPin(e.target.value)} placeholder={t.hsmInit.pinPlaceholder} disabled={submitting} />
            {fieldErrors.ubNewPin && <div style={styles.error}>{fieldErrors.ubNewPin}</div>}
          </div>
          <button style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }} onClick={handleUnblockPin} disabled={submitting}>
            {submitting ? t.hsmPin.unlocking : t.hsmPin.unblockPinBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
