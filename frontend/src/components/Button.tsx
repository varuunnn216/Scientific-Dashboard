import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: '#2563eb',
    color: '#fff',
    border: '1px solid #2563eb',
  },
  secondary: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
  },
  danger: {
    background: '#dc2626',
    color: '#fff',
    border: '1px solid #dc2626',
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '4px 10px', fontSize: 12, borderRadius: 4 },
  md: { padding: '8px 16px', fontSize: 14, borderRadius: 6 },
  lg: { padding: '12px 24px', fontSize: 16, borderRadius: 8 },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'opacity 0.15s',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <button style={baseStyle} disabled={disabled || loading} {...rest}>
      {loading && (
        <span
          style={{
            width: 14,
            height: 14,
            border: '2px solid transparent',
            borderTopColor: variant === 'secondary' ? '#374151' : '#fff',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </button>
  );
}