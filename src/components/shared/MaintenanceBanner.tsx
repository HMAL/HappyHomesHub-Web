import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useT } from '../../lib/i18n';

interface MaintenanceSettings {
  maintenance_flag: boolean;
  maintenance_time: string | null;
  maintenance_text: string | null;
}

const DISMISS_KEY = 'hhh_maintenance_dismissed';

export default function MaintenanceBanner() {
  const { t } = useT();
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('maintenance_flag, maintenance_time, maintenance_text')
      .eq('key', 'maintenance')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as MaintenanceSettings);
      });
  }, []);

  // maintenance_flag true means site is LIVE — hide the banner
  if (!settings || settings.maintenance_flag || dismissed) return null;

  const timeLabel = settings.maintenance_time
    ? new Date(`1970-01-01T${settings.maintenance_time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const message =
    settings.maintenance_text ??
    (timeLabel
      ? t('cmp.maintUntil', { time: timeLabel })
      : t('cmp.maint'));

  return (
    // Fixed overlay at the bottom: the banner appears after an async fetch, and
    // an in-flow bar at the top would shift the whole page down (CLS).
    <div className="fixed bottom-0 inset-x-0 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm font-medium z-50 shadow-[0_-2px_8px_rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      <button
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
          setDismissed(true);
        }}
        aria-label={t('cmp.dismissBanner')}
        className="shrink-0 hover:opacity-75 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
