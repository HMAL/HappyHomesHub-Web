import { useEffect, useState } from 'react';
import { Mail, Copy, CheckCircle, RefreshCw, Clock, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Property } from '../../types';
import { formatPhone, isValidPhone } from '../../lib/utils';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface PendingInvite {
  id: string;
  token: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  tenancy_id: string;
  property_id: string;
  property: { address_line1: string; city: string } | null;
  tenancy: { monthly_rent: number } | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Invite() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [properties, setProperties] = useState<Property[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [selectedProp, setSelectedProp] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseUser) {
      loadData();
    }
  }, [supabaseUser]);

  async function loadData() {
    const [{ data: props }, { data: invites }] = await Promise.all([
      supabase.from('properties').select('*').eq('landlord_id', supabaseUser!.id),
      supabase
        .from('invites')
        .select('id, token, email, phone, created_at, tenancy_id, property_id, property:property_id(address_line1, city), tenancy:tenancy_id(monthly_rent)')
        .eq('landlord_id', supabaseUser!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);
    setProperties((props as Property[]) ?? []);
    setPendingInvites((invites as unknown as PendingInvite[]) ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProp || !monthlyRent || (!email && !phone)) {
      toast.show(t('toast.fillRequiredFields'), 'error');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      toast.show(t('toast.validEmail'), 'error');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      toast.show(t('toast.phone10'), 'error');
      return;
    }
    setSaving(true);

    const { data: tenancy, error: te } = await supabase
      .from('tenancies')
      .insert({
        property_id: selectedProp,
        monthly_rent: parseFloat(monthlyRent),
        deposit_amount: parseFloat(deposit) || 0,
        status: 'pending_invite',
        lease_start: leaseStart || null,
        lease_end: leaseEnd || null,
        created_by: supabaseUser!.id,
        updated_by: supabaseUser!.id,
      })
      .select()
      .single();

    if (te || !tenancy) {
      setSaving(false);
      toast.show(te?.message ?? t('toast.createTenancyFailed'), 'error');
      return;
    }

    const { data: invite, error: ie } = await supabase
      .from('invites')
      .insert({
        property_id: selectedProp,
        tenancy_id: tenancy.id,
        landlord_id: supabaseUser!.id,
        email: email || null,
        phone: phone || null,
        created_by: supabaseUser!.id,
        updated_by: supabaseUser!.id,
      })
      .select()
      .single();

    setSaving(false);

    if (ie || !invite) {
      toast.show(ie?.message ?? t('toast.createInviteFailed'), 'error');
      return;
    }

    const link = `${window.location.origin}/join/${invite.token}`;
    setGeneratedLink(link);
    toast.show(t('toast.inviteCreated'), 'success');

    // The landlord now has a property + a tenant: this activates any referral
    // that brought them here, rewarding both them and their referrer. Idempotent.
    supabase.rpc('qualify_landlord_referral').then(() => {});

    // Auto-send invite email if tenant email was provided
    const inviteEmail = email.trim();
    setSentToEmail(inviteEmail);
    if (inviteEmail) {
      supabase.functions.invoke('send-notification', {
        body: {
          to: inviteEmail,
          subject: 'You have been invited to HappyHomesHub',
          html: `<p>Hi,</p><p>Your landlord has invited you to manage your tenancy on <strong>HappyHomesHub</strong>.</p><p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#12202E;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Accept Invite →</a></p><p style="font-size:12px;color:#888;">Or copy this link: ${link}</p>`,
        },
      }).catch(() => {});
    }

    // Reset form
    setSelectedProp('');
    setEmail('');
    setPhone('');
    setMonthlyRent('');
    setDeposit('');
    setLeaseStart('');
    setLeaseEnd('');

    await loadData();
  }

  async function handleResend(inv: PendingInvite) {
    setResendingId(inv.id);

    // Delete old invite and create a new one with a fresh token
    await supabase.from('invites').delete().eq('id', inv.id);

    const { data: newInvite, error } = await supabase
      .from('invites')
      .insert({
        property_id: inv.property_id,
        tenancy_id: inv.tenancy_id,
        landlord_id: supabaseUser!.id,
        email: inv.email,
        phone: inv.phone,
        created_by: supabaseUser!.id,
        updated_by: supabaseUser!.id,
      })
      .select()
      .single();

    setResendingId(null);

    if (error || !newInvite) {
      toast.show(t('toast.regenLinkFailed'), 'error');
      return;
    }

    const link = `${window.location.origin}/join/${newInvite.token}`;
    await navigator.clipboard.writeText(link);
    toast.show(t('toast.newLinkCopied'), 'success');
    await loadData();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await supabase.from('invites').update({ status: 'expired', updated_by: supabaseUser!.id }).eq('id', id);
    setDeletingId(null);
    setConfirmCancelId(null);
    toast.show(t('toast.inviteCancelled'), 'success');
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
  }

  function copyLink(token: string, id: string) {
    const link = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.show(t('toast.linkCopied'), 'success');
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: PRIMARY }}>
          <Mail className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('inv.title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('inv.property')}</label>
          <select
            value={selectedProp}
            onChange={(e) => setSelectedProp(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
          >
            <option value="">{t('inv.selectProperty')}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address_line1}, {p.city}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('inv.tenantEmail')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@email.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('inv.tenantPhone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 000-0000"
              maxLength={14}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('inv.monthlyRent')}</label>
            <input
              type="number"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              required
              min={0}
              placeholder="1500"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('inv.deposit')}</label>
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              min={0}
              placeholder="1500"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('inv.leaseStart')}</label>
            <input
              type="date"
              value={leaseStart}
              onChange={(e) => setLeaseStart(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('inv.leaseEnd')}</label>
            <input
              type="date"
              value={leaseEnd}
              onChange={(e) => setLeaseEnd(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
          style={{ background: PRIMARY }}
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
          {saving ? t('inv.creating') : t('inv.createLink')}
        </button>
      </form>

      {generatedLink && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="font-semibold text-green-800">{t('inv.linkCreated')}</p>
          </div>
          <p className="text-sm text-green-700 mb-3">
            {sentToEmail
              ? <>{t('inv.emailSentPre')} <strong>{sentToEmail}</strong>{t('inv.emailSentPost')}</>
              : t('inv.shareLink')}
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={generatedLink}
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-green-200 text-sm text-gray-700 focus:outline-none"
            />
            <button
              onClick={() => { navigator.clipboard.writeText(generatedLink); toast.show(t('toast.copied'), 'success'); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 transition"
              style={{ background: PRIMARY }}
            >
              <Copy className="w-4 h-4" /> {t('common.copy')}
            </button>
          </div>
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">{t('inv.pendingInvites', { n: pendingInvites.length })}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">{t('inv.expireNote')}</p>
          <div className="space-y-3">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {inv.property?.address_line1 ?? t('inv.unknownProperty')}, {inv.property?.city ?? ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {inv.email ?? inv.phone ?? t('inv.noContact')} · {t('inv.sentLabel')} {timeAgo(inv.created_at)}
                      {inv.tenancy?.monthly_rent ? ` · $${inv.tenancy.monthly_rent.toLocaleString()}/mo` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{t('status.pending')}</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Copy current link */}
                  <button
                    onClick={() => copyLink(inv.token, inv.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    {copiedId === inv.id
                      ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /> {t('common.copied')}</>
                      : <><Copy className="w-3.5 h-3.5" /> {t('inv.copyLink')}</>}
                  </button>

                  {/* Regenerate + copy new link */}
                  <button
                    onClick={() => handleResend(inv)}
                    disabled={!!resendingId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0D1F2D] text-xs font-semibold text-[#0D1F2D] hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {resendingId === inv.id
                      ? <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />}
                    {resendingId === inv.id ? t('inv.generating') : t('inv.newLinkCopy')}
                  </button>

                  {/* Cancel invite */}
                  {confirmCancelId === inv.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        disabled={!!deletingId}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deletingId === inv.id ? '…' : t('inv.yesCancel')}
                      </button>
                      <button
                        onClick={() => setConfirmCancelId(null)}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                      >
                        {t('inv.keep')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmCancelId(inv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
