import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

type Variant = 'gold' | 'ink' | 'outline-dark' | 'outline-light' | 'accent';

interface CTALinkProps {
  to: string;
  variant?: Variant;
  /** Custom accent background (role accent hex) — used with variant="accent". */
  accent?: string;
  /** Text color to pair with a custom accent background. */
  accentText?: string;
  /** Show a trailing arrow (default true). */
  arrow?: boolean;
  size?: 'md' | 'lg';
  className?: string;
  children: ReactNode;
}

/** Marketing CTA link — one radius, one hover treatment, visible focus ring.
 *  Replaces the ad-hoc styled <Link> buttons across public pages. */
export default function CTALink({
  to,
  variant = 'gold',
  accent,
  accentText,
  arrow = true,
  size = 'md',
  className = '',
  children,
}: CTALinkProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
    'hover:brightness-110 active:brightness-95 focus-visible:outline-offset-4';
  const sizing = size === 'lg' ? 'px-8 py-4 text-base' : 'px-6 py-3.5 text-sm';

  const styles: Record<Exclude<Variant, 'accent'>, string> = {
    gold: 'bg-gold text-ink',
    ink: 'bg-ink text-white',
    'outline-dark': 'border border-white/25 text-white hover:bg-white/10 hover:brightness-100',
    'outline-light': 'border border-gray-300 text-gray-800 hover:bg-gray-50 hover:brightness-100',
  };

  const inline =
    variant === 'accent' ? { background: accent, color: accentText ?? '#0D1F2D' } : undefined;
  const variantClass = variant === 'accent' ? '' : styles[variant];

  return (
    <Link to={to} className={`${base} ${sizing} ${variantClass} ${className}`} style={inline}>
      {children}
      {arrow && <ArrowRight className="w-4 h-4" />}
    </Link>
  );
}
