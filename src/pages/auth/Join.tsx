import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Home, DollarSign, Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';
import HHLogo from '../../components/brand/HHLogo';
import Footer from '../../components/shared/Footer';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface InviteDetails {
  token: string;
  email: string | null;
  status: string;
  tenancy: {
    monthly_rent: number;
    deposit_amount: number;
    lease_start: string | null;
    lease_end: string | null;
    property: {
      address_line1: string;
      city: string;
      state: string;
      zip: string;
    };
  };
}

export default function Join() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted'>('loading');

  useEffect(() => {
    if (token) fetchInvite();
  }, [token]);

  async function fetchInvite() {
    setStatus('loading');
    // Token-scoped preview RPC (migration 032). The invites/tenancies tables are
    // no longer world-readable; this returns only the 10 preview columns and only
    // to a caller who holds the token.
    const { data, error } = await supabase
      .rpc('get_invite_preview', { p_token: token! })
      .maybeSingle();

    if (error || !data) {
      // Unknown/blocked token — treat as valid but unknown details and still let
      // the user proceed with signup using the token.
      setStatus('valid');
      return;
    }

    const d = data as any;
    if (d.status === 'accepted') {
      setStatus('accepted');
      return;
    }
    if (d.status === 'expired') {
      setStatus('invalid');
      return;
    }

    setInvite({
      token: token!,
      email: d.email,
      status: d.status,
      tenancy: {
        monthly_rent: d.monthly_rent,
        deposit_amount: d.deposit_amount,
        lease_start: d.lease_start,
        lease_end: d.lease_end,
        property: {
          address_line1: d.address_line1,
          city: d.city,
          state: d.state,
          zip: d.zip,
        },
      },
    });
    setStatus('valid');
  }

  const signupUrl = `/signup?invite=${token}${invite?.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`;
  const loginUrl = `/login?invite=${token}`;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0D1F2D] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen bg-[#0D1F2D] flex flex-col items-center justify-center px-4 py-12">
        <HHLogo variant="full" theme="dark" size={52} />
        <div className="mt-8 bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Home className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Invite Already Used</h1>
          <p className="text-gray-500 text-sm mb-6">This invite link has already been accepted.</p>
          <Link to="/login" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition" style={{ background: PRIMARY }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-[#0D1F2D] flex flex-col items-center justify-center px-4 py-12">
        <HHLogo variant="full" theme="dark" size={52} />
        <div className="mt-8 bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-500 text-sm mb-6">This invite link has expired. Ask your landlord to send a new one.</p>
          <Link to="/login" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Valid invite
  return (
    <div className="min-h-screen bg-[#0D1F2D] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <HHLogo variant="full" theme="dark" size={52} />
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-5 text-center" style={{ background: PRIMARY }}>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: ACCENT + '22' }}
              >
                <Home className="w-8 h-8" style={{ color: ACCENT }} />
              </div>
              <h1 className="font-display text-2xl font-bold text-white mb-1">You're Invited!</h1>
              <p className="text-white/60 text-sm">Your landlord has invited you to join HappyHomesHub</p>
            </div>

            <div className="p-8">
              {/* Property details — shown only if we could fetch them */}
              {invite?.tenancy?.property && (
                <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="w-4 h-4" style={{ color: ACCENT }} />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Property</p>
                  </div>
                  <p className="font-bold text-gray-900">{invite.tenancy.property.address_line1}</p>
                  <p className="text-sm text-gray-500">
                    {invite.tenancy.property.city}, {invite.tenancy.property.state} {invite.tenancy.property.zip}
                  </p>

                  <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                    {invite.tenancy.monthly_rent && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <DollarSign className="w-3.5 h-3.5" /> Monthly Rent
                        </span>
                        <span className="font-bold text-gray-900">{formatCurrency(invite.tenancy.monthly_rent)}</span>
                      </div>
                    )}
                    {invite.tenancy.deposit_amount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Security Deposit</span>
                        <span className="font-semibold text-gray-700">{formatCurrency(invite.tenancy.deposit_amount)}</span>
                      </div>
                    )}
                    {invite.tenancy.lease_start && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <Calendar className="w-3.5 h-3.5" /> Lease Start
                        </span>
                        <span className="font-semibold text-gray-700">{formatDate(invite.tenancy.lease_start)}</span>
                      </div>
                    )}
                    {invite.tenancy.lease_end && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Lease End</span>
                        <span className="font-semibold text-gray-700">{formatDate(invite.tenancy.lease_end)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No property details (RLS blocked) — generic message */}
              {!invite?.tenancy?.property && (
                <div className="bg-gray-50 rounded-xl p-5 mb-6 text-center">
                  <p className="text-sm text-gray-600">
                    Create your tenant account to view your property details and manage your tenancy.
                  </p>
                </div>
              )}

              {/* CTAs */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate(signupUrl)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition"
                  style={{ background: PRIMARY }}
                >
                  Create My Account <ArrowRight className="w-4 h-4" />
                </button>

                <Link
                  to={loginUrl}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
                >
                  I already have an account — Sign in
                </Link>
              </div>

              <p className="text-xs text-center text-gray-400 mt-5">
                By creating an account you agree to our{' '}
                <Link to="/legal/terms" className="underline hover:text-gray-600">Terms</Link>
                {' '}and{' '}
                <Link to="/legal/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
