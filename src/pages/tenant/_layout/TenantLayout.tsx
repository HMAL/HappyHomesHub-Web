import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, Wrench, FileText, MessageSquare,
  ShieldCheck, UserCircle, LogOut, Menu, X, Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/auth';
import { initials } from '../../../lib/utils';
import Footer from '../../../components/shared/Footer';
import { useT } from '../../../lib/i18n';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

function useTenantCounts(uid: string | undefined) {
  const [messagesBadge, setMessagesBadge] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    async function fetchCounts() {
      const { data: t } = await supabase
        .from('tenancies')
        .select('id')
        .eq('tenant_id', uid!)
        .in('status', ['active', 'pending_invite'])
        .limit(1)
        .single();
      if (!t || cancelled) return;
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('tenancy_id', t.id)
        .is('read_at', null)
        .neq('sender_id', uid!);
      if (!cancelled) setMessagesBadge(count ?? 0);
    }

    fetchCounts();

    const channel = supabase
      .channel(`tenant-badges-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (!cancelled) fetchCounts();
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [uid]);

  return { messagesBadge };
}

const nav = [
  { to: '/tenant', labelKey: 'sidebar.dashboard', icon: LayoutDashboard, end: true },
  { to: '/tenant/rent', labelKey: 'sidebar.rent', icon: DollarSign },
  { to: '/tenant/repairs', labelKey: 'sidebar.repairs', icon: Wrench },
  { to: '/tenant/documents', labelKey: 'sidebar.documents', icon: FileText },
  { to: '/tenant/messages', labelKey: 'sidebar.messages', icon: MessageSquare },
  { to: '/tenant/screening', labelKey: 'sidebar.screening', icon: Search },
  { to: '/tenant/application', labelKey: 'sidebar.application', icon: ShieldCheck },
  { to: '/tenant/deposit', labelKey: 'sidebar.deposit', icon: DollarSign },
];

const accountNav = [{ to: '/tenant/account', labelKey: 'sidebar.account', icon: UserCircle }];

function SidebarContent({ onClose, messagesBadge }: { onClose?: () => void; messagesBadge: number }) {
  const { profile, signOut } = useAuthStore();
  const { t } = useT();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex flex-col h-full" style={{ background: PRIMARY }}>
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: ACCENT }}>
            {t('portal.habitant')}
          </p>
          <p className="text-white font-bold text-lg font-display leading-tight">HappyHomesHub</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="text-white/60 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-hide">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive ? 'text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`
            }
            style={({ isActive }) => (isActive ? { background: ACCENT + '22', color: ACCENT } : {})}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{t(item.labelKey)}</span>
            {item.to === '/tenant/messages' && messagesBadge > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs font-bold px-1" style={{ background: ACCENT, color: PRIMARY }}>
                {messagesBadge}
              </span>
            )}
          </NavLink>
        ))}
        <div className="pt-3 pb-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-white/30 mb-1">{t('common.account')}</p>
        </div>
        {accountNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive ? 'text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`
            }
            style={({ isActive }) => (isActive ? { background: ACCENT + '22', color: ACCENT } : {})}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: ACCENT, color: PRIMARY }}
          >
            {profile ? initials(profile.full_name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{profile?.full_name}</p>
            <p className="text-white/50 text-xs truncate">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-300 bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 hover:text-red-200 transition-all"
        >
          <LogOut className="w-4 h-4" />
          {t('common.signOut')}
        </button>
      </div>
    </div>
  );
}

export default function TenantLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { supabaseUser, signOut } = useAuthStore();
  const { messagesBadge } = useTenantCounts(supabaseUser?.id);
  const { t } = useT();
  const navigate = useNavigate();

  async function handleQuickSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile-only floating sign-out — one tap, no need to open the drawer */}
      {!sidebarOpen && (
        <button
          onClick={handleQuickSignOut}
          aria-label={t('common.signOut')}
          className="lg:hidden fixed bottom-4 left-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 active:scale-95 transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      )}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 overflow-hidden">
        <SidebarContent messagesBadge={messagesBadge} />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full">
            <SidebarContent onClose={() => setSidebarOpen(false)} messagesBadge={messagesBadge} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/10"
          style={{ background: PRIMARY }}
        >
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="text-white">
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-white font-bold text-sm font-display">HappyHomesHub</p>
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
          <Footer />
        </main>
      </div>
    </div>
  );
}
