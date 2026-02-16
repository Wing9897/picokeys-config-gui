interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: '#fff',
    borderRadius: 10,
    padding: '24px 28px',
    minWidth: 340,
    maxWidth: 440,
    boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#222',
  },
  message: {
    margin: '12px 0 20px',
    fontSize: 14,
    color: '#555',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    padding: '7px 18px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid #ccc',
    background: '#fff',
    color: '#333',
  },
  confirmBtn: {
    background: '#1976d2',
    color: '#fff',
    border: '1px solid #1976d2',
  },
  destructiveBtn: {
    background: '#d32f2f',
    color: '#fff',
    border: '1px solid #d32f2f',
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div style={styles.overlay} role="presentation" onClick={onCancel}>
      <div
        role={destructive ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-msg"
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" style={styles.title}>{title}</h2>
        <p id="confirm-dialog-msg" style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button style={styles.btn} onClick={onCancel}>{cancelLabel}</button>
          <button
            style={{
              ...styles.btn,
              ...(destructive ? styles.destructiveBtn : styles.confirmBtn),
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
