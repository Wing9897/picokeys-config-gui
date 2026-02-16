import { useState } from 'react';
import { useDeviceStore } from '../../store/deviceStore';
import { useI18n } from '../../i18n';
import { fidoGetBackupWords, fidoRestoreFromWords, fidoReset } from '../../api/fido';
import Notification from '../../components/Notification';
import ConfirmDialog from '../../components/ConfirmDialog';

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
    background: '#d32f2f',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  wordGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
    marginTop: 8,
  },
  wordCell: {
    padding: '6px 8px',
    fontSize: 13,
    background: '#f5f5f5',
    borderRadius: 6,
    border: '1px solid #e0e0e0',
    textAlign: 'center' as const,
  },
  wordIndex: {
    fontSize: 11,
    color: '#999',
    marginRight: 4,
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    minHeight: 80,
  },
};

export default function FidoBackup() {
  const t = useI18n();
  const devicePath = useDeviceStore((s) => s.selectedDevice?.path);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Reset
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Backup words
  const [backupWords, setBackupWords] = useState<string[] | null>(null);

  // Restore
  const [restoreInput, setRestoreInput] = useState('');

  const handleReset = async () => {
    if (!devicePath) return;
    setResetDialogOpen(false);
    setSubmitting(true);
    try {
      await fidoReset(devicePath);
      setNotification({ message: t.fidoBackup.resetSuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.fidoBackup.resetFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackup = async () => {
    if (!devicePath || !pin) return;
    setSubmitting(true);
    try {
      const words = await fidoGetBackupWords(devicePath, pin);
      setBackupWords(words);
      setNotification({ message: t.fidoBackup.wordsSuccess, type: 'success' });
    } catch (e) {
      setNotification({ message: `${t.fidoBackup.wordsFailed}：${e}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!devicePath || !pin) return;
    const words = restoreInput.trim().split(/\s+/);
    if (words.length !== 24) {
      setNotification({ message: t.fidoBackup.wordsCountError, type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await fidoRestoreFromWords(devicePath, pin, words);
      setNotification({ message: t.fidoBackup.restoreSuccess, type: 'success' });
      setRestoreInput('');
    } catch (e) {
      setNotification({ message: `${t.fidoBackup.restoreFailed}：${e}`, type: 'error' });
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
        open={resetDialogOpen}
        title={t.fidoBackup.resetConfirmTitle}
        message={t.fidoBackup.resetConfirmMsg}
        confirmLabel={t.fidoBackup.resetConfirmBtn}
        onConfirm={handleReset}
        onCancel={() => setResetDialogOpen(false)}
        destructive
      />

      {/* PIN */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoBackup.title}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.fidoBackup.pinRequired}</div>
            <input
              style={{ ...styles.input, maxWidth: 260 }}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t.fidoBackup.enterDevicePin}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      {/* Reset */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoBackup.resetDevice}</div>
        <button
          style={{ ...styles.btn, ...styles.btnDanger, ...(submitting ? styles.btnDisabled : {}) }}
          onClick={() => setResetDialogOpen(true)}
          disabled={submitting}
        >
          {t.fidoBackup.resetBtn}
        </button>
      </div>

      {/* Backup */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoBackup.backupWords}</div>
        <button
          style={{ ...styles.btn, ...(submitting || !pin ? styles.btnDisabled : {}) }}
          onClick={handleBackup}
          disabled={submitting || !pin}
        >
          {submitting ? t.fidoBackup.gettingWords : t.fidoBackup.getWordsBtn}
        </button>
        {backupWords && (
          <div style={styles.wordGrid}>
            {backupWords.map((word, i) => (
              <div key={i} style={styles.wordCell}>
                <span style={styles.wordIndex}>{i + 1}.</span>
                {word}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoBackup.restoreWords}</div>
        <div style={styles.form}>
          <div>
            <div style={styles.fieldLabel}>{t.fidoBackup.enterWords}</div>
            <textarea
              style={styles.textarea}
              value={restoreInput}
              onChange={(e) => setRestoreInput(e.target.value)}
              placeholder="word1 word2 word3 ... word24"
              disabled={submitting}
            />
          </div>
          <button
            style={{ ...styles.btn, ...(submitting || !pin || !restoreInput.trim() ? styles.btnDisabled : {}) }}
            onClick={handleRestore}
            disabled={submitting || !pin || !restoreInput.trim()}
          >
            {submitting ? t.fidoBackup.restoring : t.fidoBackup.restoreBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
