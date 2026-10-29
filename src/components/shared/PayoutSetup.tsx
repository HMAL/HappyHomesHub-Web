import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Landmark, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../stores/toast';
import { useT } from '../../lib/i18n';

interface Props {
  /** Absolute path the Stripe onboarding flow returns to, e.g. '/handyman/account'. */
  returnPath: string;
  title: string;
  description: string;
  connectedNote: string;
  primary: string;
  accent: string;
}

/**
 * Stripe Connect onboarding card. Reused by landlords (receive rent) and handymen
 * (get paid for jobs). Calls the shared connect-status / connect-onboard functions,
 * which operate on the signed-in user's row regardless of role.
 */
export default function PayoutSetup({ returnPath, title, description, connectedNote, primary, accent }: Props) {
  const toast = useToastStore();
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<{ connected: boolean; charges_enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const returned = searchParams.get('connect') === 'done';

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('connect-status', { body: {} });
        if (data) setStatus({ connected: !!data.connected, charges_enabled: !!data.charges_enabled });
      } catch { /* leave null — prompt to connect */ }
    })();
  }, [returned]);

  async function handleConnect() {
    setLoading(true);
    try {
      const base = `${window.location.origin}${returnPath}`;
      const { data, error } = await supabase.functions.invoke('connect-onboard', {
        body: { return_url: `${base}?connect=done`, refresh_url: `${base}?connect=refresh` },
      });
      if (error || !data?.url) throw error ?? new Error('No onboarding URL returned');
      window.location.href = data.url;
    } catch {
      toast.show(t('toast.payoutSetupFailed'), 'error');
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}22`, color: primary }}>
          <Landmark className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          {status?.charges_enabled ? (
            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> {connectedNote}
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
          {!status?.charges_enabled && (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
              style={{ background: primary }}
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Landmark className="w-4 h-4" />}
              {loading ? t('cmp.redirecting') : status?.connected ? t('cmp.finishPayout') : t('cmp.setupPayouts')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
