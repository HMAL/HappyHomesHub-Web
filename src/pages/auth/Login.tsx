import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Home } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import AuthShell from '../../components/shared/AuthShell';
import { useT } from '../../lib/i18n';

async function acceptInvite(token: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('accept_invite', {
    p_token: token,
    p_user_id: userId,
  });

  if (error) {
    console.error('[Login] accept_invite rpc error:', error);
    return false;
  }

  const result = data as { success: boolean; error?: string } | null;
  return result?.success ?? false;
}

export default function Login() {
  const navigate = useNavigate();
  const { session, activeRole, isLoading, loadRoles, setActiveRole } = useAuthStore();
  const { t } = useT();
  const toast = useToastStore();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inviteToken = searchParams.get('invite') ?? '';

  useEffect(() => {
    if (session && !isLoading) {
      if (activeRole) navigate(`/${activeRole}`, { replace: true });
      else navigate('/role-select', { replace: true });
    }
  }, [session, activeRole, isLoading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (inviteToken && userId) {
      const ok = await acceptInvite(inviteToken, userId);
      if (ok) {
        await loadRoles();
        setActiveRole('tenant');
        toast.show(t('toast.inviteAccepted'), 'success');
        navigate('/tenant', { replace: true });
      } else {
        // Account is signed in even though the invite link failed.
        // Redirect to dashboard and surface a recoverable warning.
        await loadRoles();
        toast.show(t('toast.inviteLinkFailed'), 'warning');
        navigate('/role-select', { replace: true });
      }
    } else {
      toast.show(t('toast.welcomeBack'), 'success');
    }

    setLoading(false);
  }

  return (
    <AuthShell>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">{t('login.title')}</h1>
            <p className="text-sm text-gray-500 mb-6">{t('login.subtitle')}</p>

            {/* Invite banner */}
            {inviteToken && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-2">
                <Home className="w-4 h-4 text-teal-600 shrink-0" />
                <p className="text-sm text-teal-700 font-medium">
                  Sign in to accept your tenancy invite
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('login.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('login.password')}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-gray-800">
                  {t('login.forgot')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0D1F2D] text-white font-semibold text-sm hover:bg-[#1a3347] transition disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {loading ? t('login.signingIn') : t('login.submit')}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              {t('login.noAccount')}{' '}
              <Link
                to={inviteToken ? `/signup?invite=${inviteToken}` : '/signup'}
                className="font-semibold text-[#0D1F2D] hover:underline"
              >
                {t('login.signupLink')}
              </Link>
            </p>
          </div>
    </AuthShell>
  );
}
