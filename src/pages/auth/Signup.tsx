import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Building2, Users, Wrench, ArrowRight, ArrowLeft, UserPlus, Plus, Trash2, Home, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { UserRole } from '../../types';
import AuthShell from '../../components/shared/AuthShell';
import { formatPhone } from '../../lib/utils';
import { isDisposableEmail } from '../../lib/email';
import { useT } from '../../lib/i18n';
import {
  HANDYMAN_SERVICES,
  SERVICE_RADII,
  HANDYMAN_AVAIL,
  US_STATES as US_STATES_FULL,
} from '../../lib/constants';

interface PropertyAddress { street: string; city: string; state: string; zip: string; }
const emptyAddress = (): PropertyAddress => ({ street: '', city: '', state: '', zip: '' });

// Abbreviations only for the legacy select used in signup property forms
const US_STATES = US_STATES_FULL.map(([abbr]) => abbr);

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string; icon: typeof Building2; color: string; bg: string }[] = [
  { value: 'landlord',  label: 'Homeowner', desc: 'I own or manage rental properties',        icon: Building2, color: '#D4972A', bg: '#0D1F2D' },
  { value: 'tenant',   label: 'Habitant',  desc: 'I rent or am looking to rent a home',       icon: Users,     color: '#00C8BB', bg: '#12202E' },
  { value: 'handyman', label: 'Handyman',  desc: 'I provide repair and maintenance services', icon: Wrench,    color: '#34D399', bg: '#1B3A2F' },
];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length < 8) return { score: 0, label: 'Too short', color: 'bg-red-400' };
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-400' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-400' };
  return { score: 3, label: 'Strong', color: 'bg-green-500' };
}

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] focus:border-transparent transition bg-white';

function StepIndicator({ step, totalSteps }: { step: number; totalSteps: number }) {
  const allLabels = ['Your Role', 'Your Details', 'Login Info'];
  const labels = totalSteps === 2 ? ['Your Details', 'Login Info'] : allLabels;
  return (
    <div className="flex items-center mb-6">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={n} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-green-500 text-white' : active ? 'bg-[#0D1F2D] text-white' : 'bg-gray-200 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs font-medium ${done ? 'text-green-600' : active ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < labels.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
          </div>
        );
      })}
    </div>
  );
}

interface InviteProperty {
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  monthly_rent?: number;
  deposit_amount?: number;
  lease_start?: string | null;
  lease_end?: string | null;
}

export default function Signup() {
  const navigate  = useNavigate();
  const toast     = useToastStore();
  const { t }     = useT();
  const { loadRoles, setActiveRole } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [confirming, setConfirming] = useState<{ email: string; mode: 'invite' | 'normal' } | null>(null);

  // Invite mode: when user arrives from /join/:token
  const inviteToken = searchParams.get('invite') ?? '';
  const inviteEmail = searchParams.get('email') ?? '';
  const inviteMode  = !!inviteToken;

  // Role deep link: /signup?role=handyman (used by the handyman flyer QR) skips the
  // role-picker and starts the new user directly on their role's details step.
  const roleParam = searchParams.get('role');
  const presetRole: UserRole | null =
    !inviteMode && (roleParam === 'landlord' || roleParam === 'tenant' || roleParam === 'handyman')
      ? (roleParam as UserRole)
      : null;

  // In invite mode: 2 steps (Details + Password), forced tenant role
  // Normal mode: 3 steps (Role + Details + Password)
  const totalSteps = inviteMode ? 2 : 3;

  const [step, setStep]     = useState(inviteMode ? 1 : presetRole ? 2 : 1);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteProperty, setInviteProperty] = useState<InviteProperty | null>(null);

  // Step 1 (normal: role; invite: skipped; preset: role from the deep link)
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(
    inviteMode ? ['tenant'] : presetRole ? [presetRole] : [],
  );

  // Fetch invite details for invite mode (property address, deposit, lease dates).
  // Uses the token-scoped preview RPC (migration 032); invites/tenancies are no
  // longer world-readable.
  useEffect(() => {
    if (!inviteToken) return;
    supabase
      .rpc('get_invite_preview', { p_token: inviteToken })
      .maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        if (d?.address_line1) {
          setInviteProperty({
            address_line1: d.address_line1,
            city: d.city,
            state: d.state,
            zip: d.zip,
            monthly_rent: d.monthly_rent,
            deposit_amount: d.deposit_amount,
            lease_start: d.lease_start,
            lease_end: d.lease_end,
          });
        }
      });
  }, [inviteToken]);

  // Step 2 — common
  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState(inviteEmail);
  const [phone, setPhone]                 = useState('');

  // Step 2 — tenant address (only in non-invite mode)
  const [streetAddress] = useState('');
  const [city] = useState('');
  const [usState] = useState('');
  const [zip] = useState('');

  // Step 2 — landlord properties
  const [propertyAddresses, setPropertyAddresses] = useState<PropertyAddress[]>([emptyAddress()]);

  // Step 2 — business name (landlord + handyman)
  const [businessName, setBusinessName]   = useState('');

  // Step 2 — handyman
  const [services, setServices]               = useState<string[]>([]);
  const [serviceZip, setServiceZip]           = useState('');
  const [serviceRadius, setServiceRadius]     = useState('');
  const [handymanAvail, setHandymanAvail]     = useState<string[]>([]);
  const [workingHours, setWorkingHours]       = useState('');

  // Step 3 (step 2 in invite mode)
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  const isTenant   = selectedRoles.includes('tenant');
  const isLandlord = selectedRoles.includes('landlord');
  const isHandyman = selectedRoles.includes('handyman');

  // In invite mode, step 1 = details (since role is pre-selected)
  // Map visual step numbers to underlying step numbers
  const detailsStep    = inviteMode ? 1 : 2;
  const credentialsStep = inviteMode ? 2 : 3;

  function updateProperty(index: number, field: keyof PropertyAddress, value: string) {
    setPropertyAddresses((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  }
  function addProperty() {
    if (propertyAddresses.length < 10) setPropertyAddresses((prev) => [...prev, emptyAddress()]);
  }
  function removeProperty(index: number) {
    setPropertyAddresses((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleRole(role: UserRole) {
    setError('');
    setSelectedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  function toggleService(s: string) {
    setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleAvail(a: string) {
    setHandymanAvail((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  function goNext() { setError(''); setStep((s) => s + 1); }
  function goBack() { setError(''); setStep((s) => s - 1); }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRoles.length === 0) { setError('Please select at least one role to continue.'); return; }
    goNext();
  }

  async function handleDetailsStep(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim())          { setError('Full name is required.'); return; }
    if (!isValidEmail(email))      { setError('Please enter a valid email address.'); return; }
    const phoneDigits = phone.replace(/\D/g, '');
    // Accept 10-digit (US) or 11-digit starting with 1 (E.164 +1)
    if (phoneDigits.length !== 10 && !(phoneDigits.length === 11 && phoneDigits.startsWith('1'))) {
      setError('Phone number must be 10 digits (or include +1 country code).'); return;
    }

    // Tenant address only required when tenant is the sole role (invite flow) — never in normal flow
    // (tenant-only is blocked at step 1; tenant+other skips tenant fields)

    if (isLandlord) {
      for (let i = 0; i < propertyAddresses.length; i++) {
        const a = propertyAddresses[i];
        if (!a.street.trim() || !a.city.trim() || !a.state || !a.zip.trim()) {
          setError(`Please complete all fields for property ${i + 1}.`); return;
        }
      }
    }

    if (isHandyman) {
      if (services.length === 0)  { setError('Please select at least one service you provide.'); return; }
      if (!serviceZip.trim())     { setError('Service ZIP code is required.'); return; }
      if (!serviceRadius)         { setError('Please select your service radius.'); return; }
    }

    // Reject disposable/throwaway email providers (fail-open if the checker is unavailable).
    setLoading(true);
    const disposable = await isDisposableEmail(email);
    setLoading(false);
    if (disposable) { setError(t('signup.disposableEmail')); return; }

    goNext();
  }

  async function acceptInvite(userId: string): Promise<boolean> {
    if (!inviteToken) return false;

    const { data, error } = await supabase.rpc('accept_invite', {
      p_token: inviteToken,
      p_user_id: userId,
    });

    if (error) {
      console.error('[Signup] accept_invite rpc error:', error);
      return false;
    }

    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      console.error('[Signup] accept_invite failed:', result?.error);
      return false;
    }

    return true;
  }

  async function handleCredentialsStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8)          { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const roles = inviteMode ? ['tenant'] : selectedRoles;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          roles,
          ...(isTenant && !inviteMode && {
            street_address: streetAddress.trim(),
            city: city.trim(),
            state: usState,
            zip: zip.trim(),
          }),
          ...(isLandlord && { property_addresses: propertyAddresses }),
          ...(isHandyman && {
            services,
            service_zip: serviceZip.trim(),
            service_radius: serviceRadius,
          }),
        },
      },
    });

    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (data.session && data.user) {
      const uid = data.user.id;

      // Assign role(s) — invite mode uses accept_invite rpc which handles role too
      if (!inviteMode) {
        await Promise.all(
          roles.map((role) =>
            supabase.from('role_assignments').insert({
              user_id: uid,
              role,
              context_id: uid,
              context_type: 'global',
              created_by: uid,
              updated_by: uid,
            })
          )
        );

        // Create handyman profile immediately so the profile page isn't blank on first login
        if (isHandyman) {
          await supabase.from('handyman_profiles').upsert({
            user_id: uid,
            skills: services,
            availability: handymanAvail,
            service_area: `${serviceZip.trim()} (${serviceRadius})`,
            working_hours: workingHours.trim() || null,
            is_available: true,
          }, { onConflict: 'user_id' });
        }

        // Save business name for landlords and handymen
        if (businessName.trim()) {
          await supabase.from('users').update({ business_name: businessName.trim() }).eq('id', uid);
        }
      }

      // Accept invite (links tenancy + assigns tenant role via SECURITY DEFINER fn)
      if (inviteMode) {
        const ok = await acceptInvite(uid);
        if (!ok) {
          setError('Your account was created but we could not link your invite. Please contact support or ask your landlord to resend the invite link.');
          setLoading(false);
          return;
        }
      }

      await loadRoles();
      if (roles.length === 1) {
        setActiveRole(roles[0] as UserRole);
        navigate(`/${roles[0]}`, { replace: true });
      } else {
        navigate('/role-select', { replace: true });
      }
      toast.show(t('toast.welcomeHHH'), 'success');
    } else {
      // Email confirmation required — show in-page confirmation card
      setConfirming({ email, mode: inviteMode ? 'invite' : 'normal' });
    }
    setLoading(false);
  }

  if (confirming) {
    return (
      <AuthShell>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-2">
                We sent a confirmation link to <strong>{confirming.email}</strong>.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {confirming.mode === 'invite'
                  ? 'Click the link to confirm your account, then sign in to access your tenancy.'
                  : 'Click the link in your email to activate your account, then sign in.'}
              </p>
              <p className="text-xs text-gray-400 mb-6">Check your spam folder if you don't see it within a few minutes.</p>
              <Link
                to="/login"
                className="block w-full py-3 rounded-xl bg-[#0D1F2D] text-white font-semibold text-sm hover:bg-[#1a3347] transition text-center"
              >
                Go to sign in
              </Link>
            </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell maxWidth="max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <StepIndicator step={step} totalSteps={totalSteps} />

            {/* Invite mode banner */}
            {inviteMode && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[#00C8BB]/10 border border-[#00C8BB]/30 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00C8BB] shrink-0" />
                <p className="text-sm text-teal-700 font-medium">Creating your tenant account</p>
              </div>
            )}

            {/* Role deep-link banner (e.g. handyman flyer QR) */}
            {presetRole && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[#1B3A2F]/10 border border-[#34D399]/40 flex items-center gap-2">
                {presetRole === 'handyman'
                  ? <Wrench className="w-4 h-4 text-[#1B3A2F] shrink-0" />
                  : presetRole === 'landlord'
                  ? <Building2 className="w-4 h-4 text-[#1B3A2F] shrink-0" />
                  : <Users className="w-4 h-4 text-[#1B3A2F] shrink-0" />}
                <p className="text-sm text-[#1B3A2F] font-medium">
                  {presetRole === 'handyman'
                    ? 'Registering as a Handyman — list your trades and start getting jobs.'
                    : presetRole === 'landlord'
                    ? 'Registering as a Homeowner.'
                    : 'Registering as a Habitant.'}
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
            )}

            {/* ── Step 1 (normal): Role multi-select ── */}
            {!inviteMode && step === 1 && (
              <>
                <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">What brings you here?</h1>
                <p className="text-sm text-gray-500 mb-5">Select all that apply</p>
                <form onSubmit={handleStep1} className="space-y-3">
                  {ROLE_OPTIONS.map((r) => {
                    const selected = selectedRoles.includes(r.value);
                    return (
                      <button key={r.value} type="button" onClick={() => toggleRole(r.value)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selected ? 'border-[#0D1F2D] bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: r.bg }}>
                          <r.icon className="w-5 h-5" style={{ color: r.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{r.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'border-[#0D1F2D] bg-[#0D1F2D]' : 'border-gray-300'}`}>
                          {selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </button>
                    );
                  })}

                  {/* Tenant-only: informational notice */}
                  {isTenant && selectedRoles.length === 1 && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200">
                      <span className="text-teal-500 text-base mt-0.5">ℹ️</span>
                      <div>
                        <p className="text-sm font-semibold text-teal-800">No invite yet? That's okay.</p>
                        <p className="text-xs text-teal-700 mt-0.5">
                          Create your account now. Once your landlord sends you an invite link, your tenancy will be connected automatically.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tenant + other roles: info notice */}
                  {isTenant && selectedRoles.length > 1 && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-blue-500 text-base mt-0.5">ℹ️</span>
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Your other role(s) will be set up now</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Tenant details come from your landlord's invite. Once they send you a link, your tenancy will be connected.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={selectedRoles.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 mt-1 rounded-xl bg-[#0D1F2D] text-white font-semibold text-sm hover:bg-[#1a3347] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}

            {/* ── Details step (step 2 in normal, step 1 in invite) ── */}
            {step === detailsStep && (
              <>
                <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">
                  {inviteMode ? 'Create your account' : 'About you'}
                </h1>
                <p className="text-sm text-gray-500 mb-5">
                  {inviteMode ? 'Enter your details to get started' : "Fill in your details — we only ask what's needed"}
                </p>
                <form onSubmit={handleDetailsStep} className="space-y-4">

                  {/* Tenant + other roles: remind user tenant info comes from landlord */}
                  {isTenant && !inviteMode && selectedRoles.length > 1 && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-blue-500 text-sm mt-0.5">ℹ️</span>
                      <p className="text-xs text-blue-700">
                        <span className="font-semibold">Tenant information is filled by your landlord.</span> We'll set up your other role(s) below. Your landlord will invite you when your tenancy is ready.
                      </p>
                    </div>
                  )}

                  {/* Invite: read-only property info */}
                  {inviteMode && inviteProperty && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Home className="w-3.5 h-3.5 text-[#00C8BB]" />
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Property (View Only)</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{inviteProperty.address_line1}</p>
                      <p className="text-xs text-gray-500">{inviteProperty.city}, {inviteProperty.state} {inviteProperty.zip}</p>
                      <div className="border-t border-gray-200 pt-2 mt-2 grid grid-cols-2 gap-2 text-xs">
                        {inviteProperty.monthly_rent != null && (
                          <div>
                            <span className="text-gray-400">Monthly Rent</span>
                            <p className="font-semibold text-gray-800">${inviteProperty.monthly_rent.toLocaleString()}/mo</p>
                          </div>
                        )}
                        {inviteProperty.deposit_amount != null && inviteProperty.deposit_amount > 0 && (
                          <div>
                            <span className="text-gray-400">Security Deposit</span>
                            <p className="font-semibold text-gray-800">${inviteProperty.deposit_amount.toLocaleString()}</p>
                          </div>
                        )}
                        {inviteProperty.lease_start && (
                          <div>
                            <span className="text-gray-400">Lease Start</span>
                            <p className="font-semibold text-gray-800">{new Date(inviteProperty.lease_start).toLocaleDateString()}</p>
                          </div>
                        )}
                        {inviteProperty.lease_end && (
                          <div>
                            <span className="text-gray-400">Lease End</span>
                            <p className="font-semibold text-gray-800">{new Date(inviteProperty.lease_end).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 pt-1">Lease documents will be available in your tenant portal after signup.</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jane Smith" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                      readOnly={!!inviteEmail}
                      className={inputCls + (email && !isValidEmail(email) ? ' border-red-300 focus:ring-red-400' : '') + (inviteEmail ? ' bg-gray-50 text-gray-500' : '')}
                    />
                    {inviteEmail && (
                      <p className="text-xs text-gray-400 mt-1">Email pre-filled from your invite</p>
                    )}
                    {email && !inviteEmail && !isValidEmail(email) && (
                      <p className="text-xs text-red-500 mt-1">Enter a valid email (e.g. name@example.com)</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="(555) 000-0000"
                      maxLength={16}
                      className={inputCls + (phone && !/^[\d\s()\-+]{7,}$/.test(phone) ? ' border-red-300 focus:ring-red-400' : '')}
                    />
                    <p className="text-xs text-gray-400 mt-1">US 10-digit or include +1 country code</p>
                  </div>

                  {/* Landlord properties */}
                  {isLandlord && (
                    <div className="pt-2 border-t border-gray-100 space-y-4">
                      <p className="text-xs font-semibold text-[#D4972A] uppercase tracking-wide">Your Homeowner Profile</p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Name <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Smith Properties LLC" className={inputCls} />
                      </div>
                      <p className="text-xs font-semibold text-[#D4972A] uppercase tracking-wide">Properties You Manage</p>
                      {propertyAddresses.map((addr, i) => (
                        <div key={i} className="p-4 rounded-xl border border-gray-200 space-y-3 relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-700">Property {i + 1}</span>
                            {propertyAddresses.length > 1 && (
                              <button type="button" onClick={() => removeProperty(i)} className="text-red-400 hover:text-red-600 transition">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Street Address <span className="text-red-500">*</span></label>
                            <input type="text" value={addr.street} onChange={(e) => updateProperty(i, 'street', e.target.value)} placeholder="123 Main St" className={inputCls} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">City <span className="text-red-500">*</span></label>
                              <input type="text" value={addr.city} onChange={(e) => updateProperty(i, 'city', e.target.value)} placeholder="Austin" className={inputCls} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">State <span className="text-red-500">*</span></label>
                              <select value={addr.state} onChange={(e) => updateProperty(i, 'state', e.target.value)} className={inputCls}>
                                <option value="">Select</option>
                                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="w-1/2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">ZIP Code <span className="text-red-500">*</span></label>
                            <input type="text" value={addr.zip} onChange={(e) => updateProperty(i, 'zip', e.target.value)} placeholder="78701" maxLength={10} className={inputCls} />
                          </div>
                        </div>
                      ))}
                      {propertyAddresses.length < 10 && (
                        <button type="button" onClick={addProperty}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#D4972A] hover:text-[#D4972A] transition">
                          <Plus className="w-4 h-4" /> Add another property
                        </button>
                      )}
                    </div>
                  )}

                  {/* Handyman details */}
                  {isHandyman && (
                    <div className="pt-2 border-t border-gray-100 space-y-4">
                      <p className="text-xs font-semibold text-[#34D399] uppercase tracking-wide">Handyman Details</p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Name <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Dave's Repair Co." className={inputCls} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Service ZIP Code <span className="text-red-500">*</span></label>
                          <input type="text" value={serviceZip} onChange={(e) => setServiceZip(e.target.value)} required placeholder="78701" maxLength={10} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Radius <span className="text-red-500">*</span></label>
                          <select value={serviceRadius} onChange={(e) => setServiceRadius(e.target.value)} required className={inputCls}>
                            <option value="">Select</option>
                            {SERVICE_RADII.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Working Hours <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input type="text" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="e.g. Mon–Fri 8am–6pm, weekends by appt" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                        <div className="flex flex-wrap gap-2">
                          {HANDYMAN_AVAIL.map(({ key, label }) => {
                            const on = handymanAvail.includes(key);
                            return (
                              <button key={key} type="button" onClick={() => toggleAvail(key)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${on ? 'border-[#1B3A2F] bg-[#1B3A2F] text-[#34D399]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Services you provide <span className="text-red-500">*</span></label>
                        <div className="flex flex-wrap gap-2">
                          {HANDYMAN_SERVICES.map((s) => {
                            const on = services.includes(s);
                            return (
                              <button key={s} type="button" onClick={() => toggleService(s)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${on ? 'border-[#1B3A2F] bg-[#1B3A2F] text-[#34D399]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    {!inviteMode && (
                      <button type="button" onClick={goBack} className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                        <ArrowLeft className="w-4 h-4" /> Back
                      </button>
                    )}
                    <button type="submit" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0D1F2D] text-white font-semibold text-sm hover:bg-[#1a3347] transition">
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ── Credentials step ── */}
            {step === credentialsStep && (
              <>
                <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">Set your password</h1>
                <p className="text-sm text-gray-500 mb-5">Almost done — secure your account</p>
                <form onSubmit={handleCredentialsStep} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                    <p className="text-xs text-gray-400 mb-1.5">At least 8 characters. Add uppercase, numbers, or symbols for a stronger password.</p>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Min. 8 characters" className={inputCls + ' pr-11'} />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password.length > 0 && (() => {
                      const s = passwordStrength(password);
                      return (
                        <div className="mt-2">
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3].map((n) => (
                              <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= s.score ? s.color : 'bg-gray-200'}`} />
                            ))}
                          </div>
                          <p className={`text-xs font-medium ${s.score >= 3 ? 'text-green-600' : s.score === 2 ? 'text-amber-500' : 'text-red-500'}`}>{s.label}</p>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter password" className={inputCls + ' pr-11'} />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={goBack} className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0D1F2D] text-white font-semibold text-sm hover:bg-[#1a3347] transition disabled:opacity-60">
                      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                  </div>
                </form>
              </>
            )}

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link
                to={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
                className="font-semibold text-[#0D1F2D] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
    </AuthShell>
  );
}
