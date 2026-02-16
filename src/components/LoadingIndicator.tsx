const spinKeyframes = `
@keyframes kiro-spin {
  to { transform: rotate(360deg); }
}`;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e0e0e0',
    borderTopColor: '#1976d2',
    borderRadius: '50%',
    animation: 'kiro-spin 0.8s linear infinite',
  },
  message: {
    fontSize: 13,
    color: '#666',
  },
};

export default function LoadingIndicator({ message }: { message?: string }) {
  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={styles.container} role="status" aria-label={message ?? '載入中'}>
        <div style={styles.spinner} />
        {message && <span style={styles.message}>{message}</span>}
      </div>
    </>
  );
}
