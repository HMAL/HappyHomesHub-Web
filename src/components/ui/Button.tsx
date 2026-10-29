import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  /** Background for the primary variant (role accent/primary color). */
  color?: string;
  children: ReactNode;
}

/** Consistent button with a built-in loading spinner and accessible disabled state.
 *  Consolidates the repeated rounded-xl button markup across pages. */
export default function Button({ variant = 'primary', loading, color = '#0D1F2D', children, className = '', disabled, ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed';
  const styles =
    variant === 'secondary' ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
    : variant === 'danger' ? 'text-white bg-red-600 hover:bg-red-700'
    : 'text-white hover:opacity-90';
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${styles} ${className}`}
      style={variant === 'primary' ? { background: color, ...rest.style } : rest.style}
    >
      {loading && <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
      {children}
    </button>
  );
}
