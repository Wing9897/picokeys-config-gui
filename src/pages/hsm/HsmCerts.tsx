import { useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useHsmStore } from '../../store/hsmStore';
import { useI18n } from '../../i18n';
import {
  hsmListCertificates,
  hsmImportCertificate,
  hsmExportCertificate,
} from '../../api/hsm';
import LoadingIndicator from '../../components/LoadingIndicator';
import Notification from '../../components/Notification';
import type { HsmCertInfo } from '../../types';

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
  exportBtn: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
    background: '#388e3c',
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
  form: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  error: { color: '#c62828', fontSize: 13, marginTop: -4 },
};

export default function HsmCerts() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);
  const certificates = useHsmStore((s) => s.certificates);

  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loadError, setLoadError] = useState('');

  // Import form state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importId, setImportId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});

  const refreshCerts = async () => {
    if (!devicePath) return;
    setLoading(true);
    try {
      const list = await hsmListCertificates(devicePath, pin);
      useHsmStore.setState({ certificates: list });
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
      const list = await hsmListCertificates(devicePath, pin);
      useHsmStore.setState({ certificates: list });
      setUnlocked(true);
      setLoadError('');
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (cert: HsmCertInfo) => {
    if (!devicePath) return;
    setExporting(cert.id);
    try {
      const data = await hsmExportCertificate(devicePath, cert.id);
      const bytes = new Uint8Array(data);
      const blob = new Blob([bytes], { type: 'application/x-x509-ca-cert' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cert_${cert.id}.der`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotification({ message: t.hsmCerts.exportSuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.hsmCerts.exportFailed}：${e}`, type: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async () => {
    const errs: Record<string, string> = {};
    const idNum = parseInt(importId, 10);
    if (!importId || isNaN(idNum) || idNum < 0 || idNum > 255) errs.importId = t.hsmCerts.idError;
    if (!importFile) errs.importFile = t.hsmCerts.selectFile;
    setImportErrors(errs);
    if (Object.keys(errs).length) return;
    if (!devicePath) return;

    setImporting(true);
    try {
      const arrayBuffer = await importFile!.arrayBuffer();
      const certData = Array.from(new Uint8Array(arrayBuffer));
      await hsmImportCertificate(devicePath, pin, idNum, certData);
      setNotification({ message: t.hsmCerts.importSuccess, type: 'success' });
      setImportFile(null);
      setImportId('');
      setImportErrors({});
      // Reset file input
      const fileInput = document.getElementById('cert-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      await refreshCerts();
    } catch (e) {
      setNotification({ message: `${t.hsmCerts.importFailed}：${e}`, type: 'error' });
    } finally {
      setImporting(false);
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

      {/* PIN unlock */}
      {!unlocked && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.hsmCerts.enterPinToView}</div>
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

      {/* Certificate list */}
      {unlocked && (
        <>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.hsmCerts.certList}</div>
            {loading ? (
              <LoadingIndicator message={t.hsmCerts.loadingCerts} />
            ) : certificates.length === 0 ? (
              <div style={styles.empty}>{t.hsmCerts.noCerts}</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.common.id}</th>
                    <th style={styles.th}>{t.hsmCerts.subject}</th>
                    <th style={styles.th}>{t.hsmCerts.issuer}</th>
                    <th style={styles.th}>{t.hsmCerts.validFrom}</th>
                    <th style={styles.th}>{t.hsmCerts.validTo}</th>
                    <th style={styles.th}>{t.hsmCerts.keyId}</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr key={cert.id}>
                      <td style={styles.td}>{cert.id}</td>
                      <td style={styles.td}>{cert.subject || '—'}</td>
                      <td style={styles.td}>{cert.issuer || '—'}</td>
                      <td style={styles.td}>{cert.notBefore || '—'}</td>
                      <td style={styles.td}>{cert.notAfter || '—'}</td>
                      <td style={styles.td}>{cert.keyId != null ? cert.keyId : '—'}</td>
                      <td style={styles.td}>
                        <button
                          style={{ ...styles.exportBtn, ...(exporting === cert.id ? styles.btnDisabled : {}) }}
                          onClick={() => handleExport(cert)}
                          disabled={exporting === cert.id}
                        >
                          {exporting === cert.id ? t.hsmCerts.exporting : t.hsmCerts.exportBtn}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Import certificate */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>{t.hsmCerts.importCert}</div>
            <div style={styles.form}>
              <div>
                <div style={styles.fieldLabel}>{t.hsmCerts.certFile}</div>
                <input
                  id="cert-file-input"
                  type="file"
                  accept=".der,.pem,.crt,.cer"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  disabled={importing}
                />
                {importErrors.importFile && <div style={styles.error}>{importErrors.importFile}</div>}
              </div>
              <div>
                <div style={styles.fieldLabel}>{t.hsmCerts.certId}</div>
                <input
                  style={styles.inputFull}
                  type="number"
                  min={0}
                  max={255}
                  value={importId}
                  onChange={(e) => setImportId(e.target.value)}
                  placeholder="0-255"
                  disabled={importing}
                />
                {importErrors.importId && <div style={styles.error}>{importErrors.importId}</div>}
              </div>
              <button
                style={{ ...styles.btn, alignSelf: 'flex-start' as const, ...(importing ? styles.btnDisabled : {}) }}
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? t.hsmCerts.importing : t.hsmCerts.importBtn}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
