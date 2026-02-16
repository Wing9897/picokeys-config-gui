/**
 * 共用樣式常量
 * 統一管理各組件的基礎樣式，減少重複代碼
 */

export const colors = {
  primary: '#1976d2',
  primaryDark: '#1565c0',
  success: '#388e3c',
  successLight: '#43a047',
  danger: '#d32f2f',
  dangerDark: '#c62828',
  warning: '#e65100',
  warningLight: '#ff9800',
  text: '#333',
  textSecondary: '#555',
  textMuted: '#666',
  textLight: '#888',
  textPlaceholder: '#999',
  border: '#ccc',
  borderLight: '#e0e0e0',
  borderLighter: '#f0f0f0',
  background: '#fff',
  backgroundLight: '#fafafa',
  backgroundMuted: '#f5f5f5',
};

export const baseStyles = {
  // 容器
  container: {
    maxWidth: 560,
  },
  containerWide: {
    maxWidth: 720,
  },

  // 區塊
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },

  // 表單
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '8px 10px',
    fontSize: 14,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box' as const,
    background: colors.background,
  },

  // 按鈕
  btn: {
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: colors.primary,
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
    background: colors.danger,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  btnSmall: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },

  // 表格
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 14,
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 10px',
    borderBottom: `2px solid ${colors.borderLight}`,
    color: colors.textSecondary,
    fontWeight: 600,
    fontSize: 13,
  },
  td: {
    padding: '8px 10px',
    borderBottom: `1px solid ${colors.borderLighter}`,
    color: colors.text,
  },

  // 列表
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: `1px solid ${colors.borderLighter}`,
    fontSize: 14,
  },

  // 空狀態
  empty: {
    padding: 24,
    textAlign: 'center' as const,
    color: colors.textPlaceholder,
    fontSize: 14,
  },

  // 錯誤訊息
  error: {
    color: colors.dangerDark,
    fontSize: 13,
    marginTop: -4,
  },

  // 提示文字
  hint: {
    fontSize: 12,
    color: colors.textPlaceholder,
    marginTop: 2,
  },

  // 警告區塊
  warning: {
    padding: 16,
    background: '#fff3e0',
    border: '1px solid #ffe0b2',
    borderRadius: 8,
    color: colors.warning,
    fontSize: 14,
    marginBottom: 16,
  },

  // 鎖定警告
  locked: {
    padding: 16,
    background: '#ffebee',
    borderLeft: '4px solid #f44336',
    borderRadius: 6,
    fontSize: 14,
    color: colors.dangerDark,
    marginBottom: 24,
  },

  // Monospace 文字
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
};

// 合併樣式的輔助函數
export function mergeStyles(...styles: (React.CSSProperties | false | undefined)[]): React.CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
}
