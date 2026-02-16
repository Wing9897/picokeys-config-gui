import { useEffect } from 'react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  visible: boolean;
  onClose: () => void;
}

const colorMap: Record<NotificationProps['type'], { bg: string; border: string }> = {
  success: { bg: '#e8f5e9', border: '#4caf50' },
  error: { bg: '#ffebee', border: '#f44336' },
  warning: { bg: '#fff3e0', border: '#ff9800' },
};

const styles = {
  container: {
    position: 'fixed' as const,
    top: 16,
    right: 16,
    zIndex: 1100,
    minWidth: 260,
    maxWidth: 380,
    padding: '12px 40px 12px 16px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    transition: 'opacity 0.2s',
  },
  closeBtn: {
    position: 'absolute' as const,
    top: 8,
    right: 10,
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    color: '#666',
    lineHeight: 1,
    padding: 2,
  },
};

export default function Notification({ message, type, visible, onClose }: NotificationProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [visible, onClose]);

  if (!visible) return null;

  const colors = colorMap[type];

  return (
    <div
      role="alert"
      style={{
        ...styles.container,
        background: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
      }}
    >
      {message}
      <button style={styles.closeBtn} onClick={onClose} aria-label="關閉通知">
        ×
      </button>
    </div>
  );
}
