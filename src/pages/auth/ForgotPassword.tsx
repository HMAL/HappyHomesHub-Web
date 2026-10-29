import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../stores/toast';
import AuthShell from '../../components/shared/AuthShell';
import { useT } from '../../lib/i18n';

export default function ForgotPassword() {
  const toast = useToastStore();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <AuthShell maxWidth="max-w-sm">
          {sent ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="font-display text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-4">
                We sent a password reset link to <strong>{email}</strong>. Check your inbox (and spam folder).
              </p>
              <button
                onClick={async () => {
                  setLoading(true);
                  const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setLoading(false);
                  if (err) setError(err.message);
                  else toast.show(t('toast.resetResent'), 'success');
                }}
                disabled={loading}
                className="w-full mb-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Resend email'}
              </button>
              <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">Reset your password</h1>
              <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            </div>
          )}
    </AuthShell>
  );
}
