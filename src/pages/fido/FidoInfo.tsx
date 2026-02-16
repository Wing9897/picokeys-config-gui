import { useEffect } from 'react';
import { useFidoStore } from '../../store/fidoStore';
import { useI18n } from '../../i18n';
import LoadingIndicator from '../../components/LoadingIndicator';

const styles = {
  container: {
    maxWidth: 640,
  },
  section: {
    marginBottom: 24,
  },
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
  label: {
    color: '#666',
  },
  value: {
    color: '#222',
    fontWeight: 500,
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  tag: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    background: '#e3f2fd',
    color: '#1565c0',
  },
  pinBadge: (set: boolean) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    background: set ? '#e8f5e9' : '#fff3e0',
    color: set ? '#2e7d32' : '#e65100',
  }),
  optionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #f0f0f0',
    fontSize: 13,
  },
  optionKey: {
    color: '#555',
    fontFamily: 'monospace',
  },
  optionVal: (v: boolean) => ({
    fontSize: 12,
    fontWeight: 500,
    color: v ? '#2e7d32' : '#999',
  }),
  error: {
    color: '#c62828',
    fontSize: 14,
    padding: 16,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
};

export default function FidoInfo() {
  const t = useI18n();
  const { info, loading, error, loadInfo } = useFidoStore();

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  if (loading) return <LoadingIndicator message={t.fidoInfo.loadingInfo} />;
  if (error) return <div style={styles.error}>{t.common.error}：{error}</div>;
  if (!info) return null;

  const optionEntries = Object.entries(info.options);

  return (
    <div style={styles.container}>
      {/* 基本資訊 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoInfo.basicInfo}</div>
        <div style={styles.row}>
          <span style={styles.label}>{t.fidoInfo.firmwareVersion}</span>
          <span style={styles.value}>{info.firmwareVersion}</span>
        </div>
        {info.serialNumber && (
          <div style={styles.row}>
            <span style={styles.label}>{t.fidoInfo.serialNumber}</span>
            <span style={{ ...styles.value, ...styles.mono }}>{info.serialNumber}</span>
          </div>
        )}
        <div style={styles.row}>
          <span style={styles.label}>{t.fidoInfo.aaguid}</span>
          <span style={{ ...styles.value, ...styles.mono }}>{info.aaguid}</span>
        </div>
      </div>

      {/* PIN 狀態 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoInfo.pinStatus}</div>
        <div style={styles.row}>
          <span style={styles.label}>{t.fidoInfo.pinSet}</span>
          <span style={styles.pinBadge(info.pinSet)}>
            {info.pinSet ? t.common.yes : t.common.no}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>{t.fidoInfo.retriesLeft}</span>
          <span style={styles.value}>{info.pinRetries}</span>
        </div>
      </div>

      {/* 協定版本 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t.fidoInfo.protocolVersions}</div>
        <div style={styles.tagList}>
          {info.versions.map((v) => (
            <span key={v} style={styles.tag}>{v}</span>
          ))}
        </div>
      </div>

      {/* 擴充功能 */}
      {info.extensions.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoInfo.extensions}</div>
          <div style={styles.tagList}>
            {info.extensions.map((ext) => (
              <span key={ext} style={styles.tag}>{ext}</span>
            ))}
          </div>
        </div>
      )}

      {/* 選項 */}
      {optionEntries.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{t.fidoInfo.options}</div>
          {optionEntries.map(([key, val]) => (
            <div key={key} style={styles.optionRow}>
              <span style={styles.optionKey}>{key}</span>
              <span style={styles.optionVal(val)}>{val ? t.common.enabled : t.common.disabled}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
