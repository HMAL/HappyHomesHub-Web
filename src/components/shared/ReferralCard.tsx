import { useEffect, useState } from 'react';
import { Gift, Copy, Check, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { useT } from '../../lib/i18n';

interface Props {
  /** Tailors the reward copy to the audience. */
  variant: 'property' | 'screening';
}

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

export default function ReferralCard({ variant }: Props) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [code, setCode] = useState<string | null>(null);
  const [joined, setJoined] = useState(0);
  const [earnedCents, setEarnedCents] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const { data: c } = await supabase.rpc('get_or_create_referral_code');
      setCode((c as string) ?? null);

      const [{ count }, { data: rewards }] = await Promise.all([
        supabase
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', supabaseUser.id),
        supabase
          .from('referral_rewards')
          .select('amount_cents')
          .eq('user_id', supabaseUser.id),
      ]);
      setJoined(count ?? 0);
      setEarnedCents((rewards ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0));
    })();
  }, [supabaseUser]);

  const link = code ? `${window.location.origin}/signup?ref=${code}` : '';
  const rewardLine =
    variant === 'property'
      ? t('cmp.refRewardProperty')
      : t('cmp.refRewardScreening');

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.show(t('toast.referralCopied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show(t('toast.copyFailed'), 'error');
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-5">
      <div className="p-5" style={{ background: PRIMARY }}>
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-bold text-white">{t('cmp.refTitle')}</h2>
        </div>
        <p className="text-xs text-white/60">{rewardLine}</p>
      </div>

      <div className="bg-white p-5">
        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('cmp.refYourLink')}</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            placeholder={t('inv.generating')}
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 bg-gray-50 truncate"
          />
          <button
            onClick={copyLink}
            disabled={!link}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: PRIMARY }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t('cmp.copiedShort') : t('common.copy')}
          </button>
        </div>

        <div className="flex gap-3 mt-4">
          <div className="flex-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{t('cmp.friendsJoined')}</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{joined}</p>
          </div>
          <div className="flex-1 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
              <Gift className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{t('cmp.creditsEarned')}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: earnedCents > 0 ? '#16a34a' : PRIMARY }}>
              ${(earnedCents / 100).toFixed(0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
