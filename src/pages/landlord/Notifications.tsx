import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Wrench, DollarSign, MessageSquare, ClipboardList, Building2, CheckCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { timeAgo } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import NotificationSettings from '../../components/shared/NotificationSettings';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface NotifItem {
  id: string;
  type: 'maintenance' | 'rent' | 'message' | 'inspection' | 'property';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

const ICON_MAP: Record<NotifItem['type'], React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  maintenance: Wrench,
  rent: DollarSign,
  message: MessageSquare,
  inspection: ClipboardList,
  property: Building2,
};

const COLOR_MAP: Record<NotifItem['type'], string> = {
  maintenance: '#ef4444',
  rent: '#16a34a',
  message: '#3b82f6',
  inspection: '#8b5cf6',
  property: ACCENT,
};

const ROUTE_MAP: Record<NotifItem['type'], string> = {
  maintenance: '/landlord/maintenance',
  rent: '/landlord/rent',
  message: '/landlord/messages',
  inspection: '/landlord/inspections',
  property: '/landlord/properties',
};

export default function Notifications() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const navigate = useNavigate();
  const { t } = useT();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
    const uid = supabaseUser!.id;

    const propIds = (
      await supabase.from('properties').select('id').eq('landlord_id', uid)
    ).data?.map((p: { id: string }) => p.id) ?? [];

    if (propIds.length === 0) { setItems([]); setLoading(false); return; }

    const tenancyIds = (
      await supabase.from('tenancies').select('id').in('property_id', propIds)
    ).data?.map((t: { id: string }) => t.id) ?? [];

    if (tenancyIds.length === 0) { setItems([]); setLoading(false); return; }

    const [maintRes, payRes, msgRes] = await Promise.all([
      supabase
        .from('maintenance_requests')
        .select('id, title, status, created_at, tenancy:tenancy_id(property:property_id(address_line1))')
        .in('tenancy_id', tenancyIds)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('rent_payments')
        .select('id, amount, status, due_date, created_at, tenancy:tenancy_id(property:property_id(address_line1))')
        .in('tenancy_id', tenancyIds)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('messages')
        .select('id, body, created_at, read_at, tenancy:tenancy_id(property:property_id(address_line1)), sender:sender_id(full_name)')
        .in('tenancy_id', tenancyIds)
        .neq('sender_id', uid)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const notifs: NotifItem[] = [];

    (maintRes.data ?? []).forEach((r: any) => {
      const prop = (r.tenancy as any)?.property?.address_line1 ?? t('ntf.unknownProperty');
      notifs.push({
        id: `maint-${r.id}`,
        type: 'maintenance',
        title: t('ntf.maintTitle', { title: r.title }),
        body: t('ntf.maintBody', { prop, status: t('status.' + r.status) }),
        timestamp: r.created_at,
        read: ['resolved', 'closed'].includes(r.status),
      });
    });

    (payRes.data ?? []).forEach((p: any) => {
      const prop = (p.tenancy as any)?.property?.address_line1 ?? t('ntf.unknownProperty');
      notifs.push({
        id: `pay-${p.id}`,
        type: 'rent',
        title: p.status === 'paid' ? t('ntf.rentReceived') : p.status === 'late' ? t('ntf.rentOverdue') : t('ntf.rentPending'),
        body: t('ntf.rentBody', { prop, amount: Number(p.amount).toLocaleString(), date: p.due_date }),
        timestamp: p.created_at,
        read: p.status === 'paid',
      });
    });

    (msgRes.data ?? []).forEach((m: any) => {
      const prop = (m.tenancy as any)?.property?.address_line1 ?? t('ntf.unknownProperty');
      const sender = (m.sender as any)?.full_name ?? t('common.tenant');
      notifs.push({
        id: `msg-${m.id}`,
        type: 'message',
        title: t('ntf.msgFrom', { sender }),
        body: t('ntf.msgBody', { prop, snippet: `${m.body.slice(0, 80)}${m.body.length > 80 ? '…' : ''}` }),
        timestamp: m.created_at,
        read: !!m.read_at,
      });
    });

    notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setItems(notifs.slice(0, 40));
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('ntf.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('ntf.title')}</h1>
          {unreadCount > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: ACCENT }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, read: true })))}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition"
          >
            <CheckCheck className="w-4 h-4" /> {t('ntf.markAllRead')}
          </button>
        )}
      </div>

      <NotificationSettings accent={ACCENT} />

      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">{t('ntf.allCaughtUp')}</p>
          <p className="text-sm text-gray-400">{t('ntf.noActivity')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = ICON_MAP[item.type];
            const color = COLOR_MAP[item.type];
            return (
              <button
                key={item.id}
                onClick={() => {
                  setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, read: true } : i));
                  navigate(ROUTE_MAP[item.type]);
                }}
                className={`w-full text-left bg-white rounded-xl px-4 py-4 shadow-sm border transition-all flex items-start gap-4 hover:shadow-md ${
                  item.read ? 'border-gray-100 opacity-70' : 'border-l-4 cursor-pointer'
                }`}
                style={!item.read ? { borderLeftColor: color } : {}}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: color + '18' }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${item.read ? 'text-gray-600' : 'text-gray-900'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(item.timestamp)}</p>
                </div>
                {!item.read && (
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
