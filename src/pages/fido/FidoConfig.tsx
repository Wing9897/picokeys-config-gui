import { useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useI18n } from '../../i18n';
import { fidoSetMinPinLength, fidoToggleEnterpriseAttestation, fidoSetLedConfig } from '../../api/fido';
import Notification from '../../components/Notification';
import type { LedConfig } from '../../types';

const styles = {
  container: { maxWidth: 560 },
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
  row: { display: 'flex', gap: 12, alignItems: 'center' as const },
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
  checkbox: { marginRight: 6 },
};

export default function FidoConfig() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Min PIN Length
  const [minPinLength, setMinPinLength] = useState(4);

  // Enterprise Attestation
  const [enterpriseEnabled, setEnterpriseEnabled] = useState(false);

  // LED Config
  const [ledGpio, setLedGpio] = useState('');
  const [ledBrightness, setLedBrightness] = useState(128);
  const [ledDimmable, setLedDimmable] = useState(false);
  const [ledColor, setLedColor] = useState('');

  const handleSaveMinPin = async () => {
    if (!devicePath || !pin) return;
    setSubmitting(true);
    try {
      await fidoSetMinPinLength(devicePath, pin, minPinLength);
      setNotification({ message: t.fidoConfig.minPinSuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.fidoConfig.settingFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnterprise = async () => {
    if (!devicePath || !pin) return;
    const next = !enterpriseEnabled;
    setSubmitting(true);
    try {
      await fidoToggleEnterpriseAttestation(devicePath, pin, next);
      setEnterpriseEnabled(next);
      setNotification({ message: next ? t.fidoConfig.enterpriseEnabled : t.fidoConfig.enterpriseDisabled, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.fidoConfig.settingFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveLed = async () => {
    if (!devicePath) return;
    const config: LedConfig = {};
    if (ledGpio) config.gpio = Number(ledGpio);
    if (ledBrightness !== undefined) config.brightness = ledBrightness;
    config.dimmable = ledDimmable;
    if (ledColor) config.color = ledColor;
    setSubmitting(true);
    try {
      await fidoSetLedConfig(devicePath, config);
      setNotification({ message: t.fidoConfig.ledSaveSuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.fidoConfig.ledSaveFailed}：${e}`, type: 'error' });
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

      {/* PIN input */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoConfig.configTitle}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.fidoConfig.pinRequired}</div>
            <input
              style={{ ...styles.input, maxWidth: 260 }}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t.fidoConfig.enterDevicePin}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      {/* Min PIN Length */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoConfig.minPinLength}</div>
        <div style={styles.row}>
          <input
            style={{ ...styles.input, width: 80 }}
            type="number"
            min={4}
            max={63}
            value={minPinLength}
            onChange={(e) => setMinPinLength(Number(e.target.value))}
            disabled={submitting}
          />
          <button
            style={{ ...styles.btn, ...(submitting || !pin ? styles.btnDisabled : {}) }}
            onClick={handleSaveMinPin}
            disabled={submitting || !pin}
          >
            {submitting ? t.fidoConfig.saving : t.fidoConfig.saveBtn}
          </button>
        </div>
      </div>

      {/* Enterprise Attestation */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoConfig.enterpriseAttestation}</div>
        <div style={styles.row}>
          <label style={{ fontSize: 14, color: '#333', cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={enterpriseEnabled}
              onChange={handleToggleEnterprise}
              disabled={submitting || !pin}
            />
            {t.fidoConfig.enableEnterprise}
          </label>
        </div>
      </div>

      {/* LED Config */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoConfig.ledConfig}</div>
        <div style={styles.form}>
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <div style={styles.fieldLabel}>{t.fidoConfig.gpio}</div>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={ledGpio}
                onChange={(e) => setLedGpio(e.target.value)}
                placeholder={t.fidoConfig.gpioPlaceholder}
                disabled={submitting}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.fieldLabel}>{t.fidoConfig.brightness}</div>
              <input
                style={styles.input}
                type="range"
                min={0}
                max={255}
                value={ledBrightness}
                onChange={(e) => setLedBrightness(Number(e.target.value))}
                disabled={submitting}
              />
              <div style={{ fontSize: 12, color: '#888', textAlign: 'center' as const }}>{ledBrightness}</div>
            </div>
          </div>
          <div style={styles.row}>
            <label style={{ fontSize: 14, color: '#333', cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={ledDimmable}
                onChange={(e) => setLedDimmable(e.target.checked)}
                disabled={submitting}
              />
              {t.fidoConfig.dimmable}
            </label>
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.fidoConfig.color}</div>
            <input
              style={{ ...styles.input, maxWidth: 200 }}
              value={ledColor}
              onChange={(e) => setLedColor(e.target.value)}
              placeholder={t.fidoConfig.colorPlaceholder}
              disabled={submitting}
            />
          </div>
          <button
            style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
            onClick={handleSaveLed}
            disabled={submitting}
          >
            {submitting ? t.fidoConfig.saving : t.fidoConfig.saveLed}
          </button>
        </div>
      </div>
    </div>
  );
}
