import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, LogOut, ChevronRight, Edit2, Trash2, AlertTriangle, Mail, HelpCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { supabase } from '../../lib/supabase';
import { initials, formatPhone, isValidPhone } from '../../lib/utils';
import RoleManager from '../../components/shared/RoleManager';
import PayoutSetup from '../../components/shared/PayoutSetup';
import { useT } from '../../lib/i18n';

const PRIMARY = '#1B3A2F';
const ACCENT = '#34D399';

export default function HandymanAccount() {
  const { profile, supabaseUser, signOut } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  async function handleSave() {
    if (phone && !isValidPhone(phone)) { toast.show(t('toast.phone10'), 'error'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile!.id);
    setSaving(false);
    if (error) toast.show(error.message, 'error');
    else { toast.show(t('toast.profileUpdated'), 'success'); setEditing(false); }
  }

  async function handleDeleteAccount() {
    if (!supabaseUser) return;
    setDeletingAccount(true);
    await supabase.from('role_assignments').delete().eq('user_id', supabaseUser.id);
    toast.show(t('toast.accountRemoved'), 'success');
    setTimeout(() => { signOut(); navigate('/', { replace: true }); }, 1500);
  }

  if (editing) {
    return (
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-800 text-sm">{t('common.back')}</button>
          <h1 className="font-display text-xl font-bold text-gray-900">{t('lacct.editProfile')}</h1>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('hacct.fullName')}</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('lacct.phone')}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(555) 000-0000" maxLength={14} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition" />
            {phone && !isValidPhone(phone) && <p className="text-xs text-red-500 mt-1">{t('lacct.phone10')}</p>}
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60" style={{ background: PRIMARY }}>
            {saving ? t('common.saving') : t('common.saveChanges')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('lacct.account')}</h1>

      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3" style={{ background: PRIMARY }}>
          {initials(profile?.full_name ?? '?')}
        </div>
        <p className="font-semibold text-gray-900">{profile?.full_name}</p>
        <p className="text-sm text-gray-400">{profile?.email}</p>
        <span className="mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: ACCENT, color: PRIMARY }}>{t('hacct.handyman')}</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 mb-4">
        <button onClick={() => setEditing(true)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition text-left">
          <Edit2 className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-sm font-medium text-gray-700">{t('lacct.editProfile')}</span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
        <button onClick={() => navigate('/handyman/profile')} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition text-left">
          <User className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-sm font-medium text-gray-700">{t('hacct.myProfile')}</span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
        <button onClick={() => { signOut(); navigate('/login'); }} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition text-left">
          <LogOut className="w-4 h-4 text-red-400" />
          <span className="flex-1 text-sm font-medium text-red-600">{t('common.signOut')}</span>
        </button>
      </div>

      <div className="mb-4">
        <PayoutSetup
          returnPath="/handyman/account"
          title={t('hacct.getPaid')}
          description={t('hacct.getPaidDesc')}
          connectedNote={t('hacct.connectedNote')}
          primary={PRIMARY}
          accent={ACCENT}
        />
      </div>

      <div className="mb-4">
        <RoleManager />
      </div>

      {/* Contact & Support */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">{t('lacct.contactSupport')}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          <a href="mailto:support@happyhomeshub.com" className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition group">
            <Mail className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">{t('lacct.emailSupport')}</p>
              <p className="text-xs text-gray-400">support@happyhomeshub.com</p>
            </div>
          </a>
          <Link to="/faq" className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition group">
            <HelpCircle className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">{t('lacct.browseFaq')}</p>
              <p className="text-xs text-gray-400">{t('lacct.faqDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-50 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-red-700">{t('lacct.dangerZone')}</h2>
        </div>
        <div className="p-5">
          {confirmDeleteAccount ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">{t('lacct.removeAccessConfirm')}</p>
              <p className="text-xs text-gray-500">{t('lacct.deleteDataNote')} <a href="mailto:support@happyhomeshub.com" className="underline">support@happyhomeshub.com</a>.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={handleDeleteAccount} disabled={deletingAccount}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1"
                  style={{ background: '#dc2626' }}>
                  {deletingAccount ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {t('lacct.yesDeleteAccess')}
                </button>
                <button onClick={() => setConfirmDeleteAccount(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('lacct.deleteAccount')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('lacct.deleteAccountDesc')}</p>
              </div>
              <button onClick={() => setConfirmDeleteAccount(true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
