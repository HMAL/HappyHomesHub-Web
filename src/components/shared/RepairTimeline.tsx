import { Check, CalendarClock } from 'lucide-react';
import type { MaintenanceStatus } from '../../types';
import { useT } from '../../lib/i18n';

// The happy-path progression a tenant cares about. 'closed' collapses into the
// final step; 'assigned' shares the "Assigned" step with the pro being booked.
const STEPS: { key: MaintenanceStatus; labelKey: string }[] = [
  { key: 'open', labelKey: 'cmp.stepSubmitted' },
  { key: 'assigned', labelKey: 'cmp.stepProAssigned' },
  { key: 'in_progress', labelKey: 'cmp.stepInProgress' },
  { key: 'resolved', labelKey: 'cmp.stepDone' },
];

const ORDER: Record<MaintenanceStatus, number> = {
  open: 0, assigned: 1, in_progress: 2, resolved: 3, closed: 3,
};

function formatEta(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Visual status stepper + "your pro is scheduled" banner — directly answers the
 *  #1 tenant question: what's happening with my repair and when. */
export default function RepairTimeline({
  status, scheduledFor, accent = '#00C8BB',
}: { status: MaintenanceStatus; scheduledFor?: string | null; accent?: string }) {
  const { t, lang } = useT();
  const current = ORDER[status] ?? 0;
  const upcoming = scheduledFor && new Date(scheduledFor).getTime() > Date.now();

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {upcoming && status !== 'resolved' && status !== 'closed' && (
        <div className="flex items-center gap-2 mb-4 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
          <CalendarClock className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            <span className="font-semibold">{t('cmp.proScheduled')}</span> {t('cmp.proScheduledFor', { eta: formatEta(scheduledFor!, lang === 'es' ? 'es-ES' : 'en-US') })}
          </p>
        </div>
      )}

      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const reached = i <= current;
          return (
            <li key={step.key} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <span
                  className="absolute top-3 right-1/2 w-full h-0.5"
                  style={{ background: reached ? accent : '#e5e7eb' }}
                  aria-hidden
                />
              )}
              <span
                className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: reached ? accent : '#e5e7eb',
                  color: reached ? '#fff' : '#9ca3af',
                  boxShadow: active ? `0 0 0 4px ${accent}33` : undefined,
                }}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`mt-1.5 text-[11px] text-center ${reached ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                {t(step.labelKey)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
