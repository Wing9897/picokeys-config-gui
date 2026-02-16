import { useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useHsmStore } from '../../store/hsmStore';
import { useI18n } from '../../i18n';
import {
  hsmCreateDkekShare,
  hsmImportDkekShare,
  hsmWrapKey,
  hsmUnwrapKey,
} from '../../api/hsm';
import Notification from '../../components/Notification';
import type { DkekStatus } from '../../types';

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
  form: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  fieldLabel: { fontSize: 13, color: '#555', marginBottom: 2 },
  input: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    outline: 'none',
    width: 260,
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
  warning: {
    padding: 16,
    background: '#fff3e0',
    border: '1px solid #ffe0b2',
    borderRadius: 8,
    color: '#e65100',
    fontSize: 14,
    marginBottom: 16,
  },
  statusBox: {
    padding: 12,
    background: '#e3f2fd',
    border: '1px solid #bbdefb',
    borderRadius: 8,
    fontSize: 13,
    color: '#1565c0',
    marginTop: 8,
  },
};

function downloadBlob(data: number[], filename: string, mime: string) {
  const blob = new Blob([new Uint8Array(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DkekStatusInfo({ status, t }: { status: DkekStatus; t: ReturnType<typeof useI18n> }) {
  return (
    <div style={styles.statusBox}>
      {t.hsmBackup.dkekStatus.replace('{imported}', String(status.importedShares)).replace('{total}', String(status.totalShares))}
      {status.remainingShares > 0 && t.hsmBackup.remaining.replace('{n}', String(status.remainingShares))}
      {status.keyCheckValue && <span> — KCV: {status.keyCheckValue}</span>}
    </div>
  );
}

export default function HsmBackup() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);
  const dkekStatus = useHsmStore((s) => s.dkekStatus);
  const setDkekStatus = useHsmStore((s) => s.setDkekStatus);

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Create DKEK share
  const [createPassword, setCreatePassword] = useState('');

  // Import DKEK share
  const [importPassword, setImportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  // Wrap key (export)
  const [wrapPin, setWrapPin] = useState('');
  const [wrapKeyRef, setWrapKeyRef] = useState('');

  // Unwrap key (restore)
  const [unwrapPin, setUnwrapPin] = useState('');
  const [unwrapKeyRef, setUnwrapKeyRef] = useState('');
  const [unwrapFile, setUnwrapFile] = useState<File | null>(null);

  const dkekInitialized = dkekStatus != null && dkekStatus.totalShares > 0;

  const handleCreateShare = async () => {
    if (!devicePath || !createPassword) return;
    setSubmitting(true);
    try {
      const data = await hsmCreateDkekShare(devicePath, createPassword);
      downloadBlob(data, 'dkek_share.bin', 'application/octet-stream');
      setNotification({ message: t.hsmBackup.createSuccess, type: 'success' });
      setCreatePassword('');
    } catch (e) {
      setNotification({ message: `${t.hsmBackup.createFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportShare = async () => {
    if (!devicePath || !importFile || !importPassword) return;
    setSubmitting(true);
    try {
      const buf = await importFile.arrayBuffer();
      const shareData = Array.from(new Uint8Array(buf));
      const status = await hsmImportDkekShare(devicePath, shareData, importPassword);
      setDkekStatus(status);
      setNotification({ message: t.hsmBackup.importShareSuccess, type: 'success' });
      setImportFile(null);
      setImportPassword('');
      const fileInput = document.getElementById('dkek-import-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (e) {
      setNotification({ message: `${t.hsmBackup.importShareFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWrapKey = async () => {
    if (!devicePath || !wrapPin || !wrapKeyRef) return;
    const keyRef = parseInt(wrapKeyRef, 10);
    if (isNaN(keyRef)) return;
    setSubmitting(true);
    try {
      const data = await hsmWrapKey(devicePath, wrapPin, keyRef);
      downloadBlob(data, `key_${keyRef}_wrapped.bin`, 'application/octet-stream');
      setNotification({ message: t.hsmBackup.exportKeySuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.hsmBackup.exportKeyFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnwrapKey = async () => {
    if (!devicePath || !unwrapPin || !unwrapKeyRef || !unwrapFile) return;
    const keyRef = parseInt(unwrapKeyRef, 10);
    if (isNaN(keyRef)) return;
    setSubmitting(true);
    try {
      const buf = await unwrapFile.arrayBuffer();
      const wrapped = Array.from(new Uint8Array(buf));
      await hsmUnwrapKey(devicePath, unwrapPin, keyRef, wrapped);
      setNotification({ message: t.hsmBackup.restoreSuccess, type: 'success' });
      setUnwrapFile(null);
      const fileInput = document.getElementById('unwrap-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (e) {
      setNotification({ message: `${t.hsmBackup.restoreFailed}：${e}`, type: 'error' });
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

      <div style={styles.sectionTitle}>{t.hsmBackup.title}</div>

      {!dkekInitialized && (
        <div style={styles.warning}>
          {t.hsmBackup.notInitWarning}
        </div>
      )}

      {/* Section 1: Create DKEK Share */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmBackup.createShare}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.protectPassword}</div>
            <input
              style={styles.input}
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder={t.hsmBackup.setPassword}
              disabled={submitting}
            />
          </div>
          <button
            style={{ ...styles.btn, ...(submitting || !createPassword ? styles.btnDisabled : {}) }}
            onClick={handleCreateShare}
            disabled={submitting || !createPassword}
          >
            {submitting ? t.hsmBackup.creating : t.hsmBackup.createBtn}
          </button>
        </div>
      </div>

      {/* Section 2: Import DKEK Share */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmBackup.importShare}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.shareFile}</div>
            <input
              id="dkek-import-file"
              type="file"
              accept=".bin"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.password}</div>
            <input
              style={styles.input}
              type="password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              placeholder={t.hsmBackup.sharePassword}
              disabled={submitting}
            />
          </div>
          <button
            style={{ ...styles.btn, ...(submitting || !importFile || !importPassword ? styles.btnDisabled : {}) }}
            onClick={handleImportShare}
            disabled={submitting || !importFile || !importPassword}
          >
            {submitting ? t.hsmBackup.importingShare : t.hsmBackup.importBtn}
          </button>
        </div>
        {dkekStatus && <DkekStatusInfo status={dkekStatus} t={t} />}
      </div>

      {/* Section 3: Export Key (Wrap) */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmBackup.exportKey}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.devicePin}</div>
            <input
              style={styles.input}
              type="password"
              value={wrapPin}
              onChange={(e) => setWrapPin(e.target.value)}
              placeholder={t.hsmKeys.enterDevicePin}
              disabled={submitting}
            />
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.keyRef}</div>
            <input
              style={styles.input}
              type="number"
              min={0}
              max={255}
              value={wrapKeyRef}
              onChange={(e) => setWrapKeyRef(e.target.value)}
              placeholder="0-255"
              disabled={submitting}
            />
          </div>
          <button
            style={{ ...styles.btn, ...(submitting || !wrapPin || !wrapKeyRef ? styles.btnDisabled : {}) }}
            onClick={handleWrapKey}
            disabled={submitting || !wrapPin || !wrapKeyRef}
          >
            {submitting ? t.hsmBackup.exportingKey : t.hsmBackup.exportKeyBtn}
          </button>
        </div>
      </div>

      {/* Section 4: Restore Key (Unwrap) */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.hsmBackup.restoreKey}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.devicePin}</div>
            <input
              style={styles.input}
              type="password"
              value={unwrapPin}
              onChange={(e) => setUnwrapPin(e.target.value)}
              placeholder={t.hsmKeys.enterDevicePin}
              disabled={submitting}
            />
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.keyRef}</div>
            <input
              style={styles.input}
              type="number"
              min={0}
              max={255}
              value={unwrapKeyRef}
              onChange={(e) => setUnwrapKeyRef(e.target.value)}
              placeholder="0-255"
              disabled={submitting}
            />
          </div>
          <div>
            <div style={styles.fieldLabel}>{t.hsmBackup.backupFile}</div>
            <input
              id="unwrap-file"
              type="file"
              accept=".bin"
              onChange={(e) => setUnwrapFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>
          <button
            style={{ ...styles.btn, ...(submitting || !unwrapPin || !unwrapKeyRef || !unwrapFile ? styles.btnDisabled : {}) }}
            onClick={handleUnwrapKey}
            disabled={submitting || !unwrapPin || !unwrapKeyRef || !unwrapFile}
          >
            {submitting ? t.hsmBackup.restoring : t.hsmBackup.restoreBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
