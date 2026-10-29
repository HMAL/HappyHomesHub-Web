import { cn } from '../../lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variants: Record<Variant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-500',
};

interface BadgeProps {
  label: string;
  variant?: Variant;
  className?: string;
}

export default function Badge({ label, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variants[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function statusVariant(status: string): Variant {
  const map: Record<string, Variant> = {
    open: 'warning',
    in_progress: 'info',
    resolved: 'success',
    closed: 'neutral',
    pending: 'warning',
    processing: 'info',
    paid: 'success',
    late: 'danger',
    waived: 'neutral',
    partial: 'info',
    active: 'success',
    ended: 'neutral',
    pending_invite: 'info',
    submitted: 'info',
    under_review: 'warning',
    approved: 'success',
    denied: 'danger',
    draft: 'neutral',
    low: 'neutral',
    medium: 'info',
    high: 'warning',
    urgent: 'danger',
  };
  return map[status] ?? 'default';
}

export function priorityVariant(priority: string): Variant {
  const map: Record<string, Variant> = {
    low: 'neutral',
    medium: 'info',
    high: 'warning',
    urgent: 'danger',
  };
  return map[priority] ?? 'default';
}
