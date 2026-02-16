import { useState, useEffect } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useI18n } from '../../i18n';
import {
  hsmGetOptions,
  hsmSetOption,
  hsmSetDatetime,
  hsmEnableSecureLock,
  hsmDisableSecureLock,
  hsmSetLedConfig,
} from '../../api/hsm';
import Notification from '../../components/Notification';
import type { LedConfig, HsmOptions } from '../../types';

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
  btnDanger: {
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
  checkbox: { marginRight: 6 },
};

export default function HsmConfig() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Options loaded from device
  const [options, setOptions] = useState<HsmOptions | null>(null);

  // LED Config
  const [ledGpio, setLedGpio] = useState('');
  const [ledBrightness, setLedBrightness] = useState(128);
  const [ledDimmable, setLedDimmable] = useState(false);
  const [ledColor, setLedColor] = useState('');

  useEffect(() => {
    if (!devicePath) return;
    let cancelled = false;
    hsmGetOptions(devicePath)
      .then((opts) => { if (!cancelled) setOptions(opts); })
      .catch(() => { /* ignore load error */ });
    return () => { cancelled = true; };
  }, [devicePath]);

  const handleToggleOption = async (option: 'PressToConfirm' | 'KeyUsageCounter', current: boolean) => {
    if (!devicePath) return;
    setSubmitting(true);
    try {
      await hsmSetOption(devicePath, option, !current);
      setOptions((prev) => prev ? {
        ...prev,
        pressToConfirm: option === 'PressToConfirm' ? !current : prev.pressToConfirm,
        keyUsageCounter: option === 'KeyUsageCounter' ? !current : prev.keyUsageCounter,
      } : prev);
      const label = option === 'PressToConfirm' ? t.hsmConfig.pressToConfirm : t.hsmConfig.keyUsageCounter;
      const action = !current ? t.common.enabled : t.common.disabled;
      setNotification({ message: `${label} ${action}`, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.hsmConfig.secureLockFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncDatetime = async () => {
    if (!devicePath) return;
    setSubmitting(true);
    try {
      await hsmSetDatetime(devicePath);
      setNotification({ message: t.hsmConfig.syncSuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.hsmConfig.syncFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSecureLock = async (enable: boolean) => {
    if (!devicePath) return;
    setSubmitting(true);
    try {
      if (enable) {
        await hsmEnableSecureLock(devicePath);
      } else {
        await hsmDisableSecureLock(devicePath);
      }
      const action = enable ? t.common.enabled : t.common.disabled;
      setNotification({ message: t.hsmConfig.secureLockSuccess.replace('{action}', action), type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.hsmConfig.secureLockFailed}：${e}`, type: 'error' });
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
      await hsmSetLedConfig(devicePath, config);
      setNotification({ message: t.hsmConfig.ledSaveSuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.hsmConfig.ledSaveFailed}：${e}`, type: 'error' });
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

      <div style={styles.sectionTitle}>{t.hsmConfig.optionSettings}</div>

      {/* Section 1: Press to Confirm */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmConfig.pressToConfirm}</div>
        <label style={{ fontSize: 14, color: '#333', cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={options?.pressToConfirm ?? false}
            onChange={() => handleToggleOption('PressToConfirm', options?.pressToConfirm ?? false)}
            disabled={submitting || !options}
          />
          {t.hsmConfig.enablePressToConfirm}
        </label>
      </div>

      {/* Section 2: Key Usage Counter */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmConfig.keyUsageCounter}</div>
        <label style={{ fontSize: 14, color: '#333', cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={options?.keyUsageCounter ?? false}
            onChange={() => handleToggleOption('KeyUsageCounter', options?.keyUsageCounter ?? false)}
            disabled={submitting || !options}
          />
          {t.hsmConfig.enableKeyUsageCounter}
        </label>
      </div>

      {/* Section 3: RTC Sync */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmConfig.rtcSync}</div>
        <button
          style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
          onClick={handleSyncDatetime}
          disabled={submitting}
        >
          {submitting ? t.hsmConfig.syncing : t.hsmConfig.syncBtn}
        </button>
      </div>

      {/* Section 4: Secure Lock */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmConfig.secureLock}</div>
        <div style={styles.row}>
          <button
            style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
            onClick={() => handleSecureLock(true)}
            disabled={submitting}
          >
            {t.hsmConfig.enableSecureLock}
          </button>
          <button
            style={{ ...styles.btnDanger, ...(submitting ? styles.btnDisabled : {}) }}
            onClick={() => handleSecureLock(false)}
            disabled={submitting}
          >
            {t.hsmConfig.disableSecureLock}
          </button>
        </div>
      </div>

      {/* Section 5: LED Config */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmConfig.ledConfig}</div>
        <div style={styles.form}>
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <div style={styles.fieldLabel}>{t.hsmConfig.gpio}</div>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={ledGpio}
                onChange={(e) => setLedGpio(e.target.value)}
                placeholder={t.hsmConfig.gpioPlaceholder}
                disabled={submitting}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.fieldLabel}>{t.hsmConfig.brightness}</div>
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
              {t.hsmConfig.dimmable}
            </label>
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmConfig.color}</div>
            <input
              style={{ ...styles.input, maxWidth: 200 }}
              value={ledColor}
              onChange={(e) => setLedColor(e.target.value)}
              placeholder={t.hsmConfig.colorPlaceholder}
              disabled={submitting}
            />
          </div>
          <button
            style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
            onClick={handleSaveLed}
            disabled={submitting}
          >
            {submitting ? t.hsmConfig.saving : t.hsmConfig.saveLed}
          </button>
        </div>
      </div>
    </div>
  );
}
