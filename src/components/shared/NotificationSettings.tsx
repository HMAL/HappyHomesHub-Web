import { useEffect, useState } from 'react';
import { Bell, MessageSquareText, Mail, Lock, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { subscribeToPush } from '../../lib/push';
import { useT } from '../../lib/i18n';

interface Prefs { push_enabled: boolean; sms_enabled: boolean; email_enabled: boolean; }

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** Notification channel preferences. SMS is a Premium-only benefit. */
export default function NotificationSettings({ accent = '#D4972A' }: { accent?: string }) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [prefs, setPrefs] = useState<Prefs>({ push_enabled: true, sms_enabled: false, email_enabled: true });
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const [{ data: pref }, { data: u }] = await Promise.all([
        supabase.from('notification_prefs').select('*').eq('user_id', supabaseUser.id).maybeSingle(),
        supabase.from('users').select('is_premium').eq('id', supabaseUser.id).single(),
      ]);
      if (pref) setPrefs({ push_enabled: pref.push_enabled, sms_enabled: pref.sms_enabled, email_enabled: pref.email_enabled });
      setIsPremium(!!u?.is_premium);
      setLoading(false);
    })();
  }, [supabaseUser]);

  async function save(next: Prefs) {
    setPrefs(next);
    await supabase.from('notification_prefs').upsert(
      { user_id: supabaseUser!.id, ...next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  }

  async function togglePush() {
    if (!prefs.push_enabled) {
      // Turning on: ensure the browser subscription exists.
      const ok = await subscribeToPush();
      if (!ok && Notification?.permission === 'denied') {
        toast.show(t('toast.enableNotifBrowser'), 'error');
        return;
      }
    }
    save({ ...prefs, push_enabled: !prefs.push_enabled });
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{t('cmp.notifTitle')}</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {/* Push (free) */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Bell className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{t('cmp.push')}</p>
            <p className="text-xs text-gray-400">{t('cmp.pushDesc')}</p>
          </div>
          <Toggle on={prefs.push_enabled} onClick={togglePush} />
        </div>

        {/* Email (free) */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{t('cmp.emailNotif')}</p>
            <p className="text-xs text-gray-400">{t('cmp.emailDesc')}</p>
          </div>
          <Toggle on={prefs.email_enabled} onClick={() => save({ ...prefs, email_enabled: !prefs.email_enabled })} />
        </div>

        {/* SMS (Premium) */}
        <div className="flex items-center gap-3 px-5 py-4">
          <MessageSquareText className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
              {t('cmp.sms')}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide" style={{ background: `${accent}22`, color: accent }}>
                <Sparkles className="w-2.5 h-2.5" /> {t('cmp.superBadge')}
              </span>
            </p>
            <p className="text-xs text-gray-400">
              {isPremium ? t('cmp.smsOn') : t('cmp.smsOff')}
            </p>
          </div>
          {isPremium ? (
            <Toggle on={prefs.sms_enabled} onClick={() => save({ ...prefs, sms_enabled: !prefs.sms_enabled })} />
          ) : (
            <Lock className="w-4 h-4 text-gray-300 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}
