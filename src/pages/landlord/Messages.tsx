import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Send, ArrowLeft, Users, HardHat } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Message } from '../../types';
import { timeAgo, initials, isUuid } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import TranslatableText from '../../components/shared/TranslatableText';
import { newMessageEmail, type Lang } from '../../lib/notify';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface TenantThread {
  tenancy_id: string;
  property_address: string;
  tenant_name: string;
  last_message: string;
  last_at: string;
  unread: number;
}

interface HandymanThread {
  handyman_id: string;
  handyman_name: string;
  last_message: string;
  last_at: string;
  unread: number;
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export function MessagesInbox() {
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useT();
  const [tab, setTab] = useState<'tenants' | 'handymen'>('tenants');
  const [tenantThreads, setTenantThreads] = useState<TenantThread[]>([]);
  const [handymanThreads, setHandymanThreads] = useState<HandymanThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseUser) {
      loadTenants();
      loadHandymen();
    }
  }, [supabaseUser]);

  async function loadTenants() {
    setLoading(true);
    const uid = supabaseUser!.id;
    const propIds = (
      await supabase.from('properties').select('id').eq('landlord_id', uid)
    ).data?.map((p: { id: string }) => p.id) ?? [];

    const { data: tenancies } = await supabase
      .from('tenancies')
      .select('id, property:property_id(address_line1), tenant:tenant_id(full_name)')
      .in('property_id', propIds)
      .in('status', ['active', 'pending_invite']);

    if (!tenancies) { setLoading(false); return; }

    const tenancyIds = tenancies.map((tn: { id: string }) => tn.id);
    const { data: messages } = await supabase
      .from('messages')
      .select('tenancy_id, body, created_at, read_at, sender_id')
      .in('tenancy_id', tenancyIds)
      .order('created_at', { ascending: false });

    const byTenancy = new Map<string, { last: Message; unread: number }>();
    (messages ?? [] as any[]).forEach((m: any) => {
      if (!byTenancy.has(m.tenancy_id)) {
        byTenancy.set(m.tenancy_id, { last: m as Message, unread: 0 });
      }
      if (!m.read_at && m.sender_id !== uid) {
        byTenancy.get(m.tenancy_id)!.unread++;
      }
    });

    setTenantThreads(
      tenancies
        .filter((tn: any) => byTenancy.has(tn.id))
        .map((tn: any) => ({
          tenancy_id: tn.id,
          property_address: tn.property?.address_line1 ?? '',
          tenant_name: tn.tenant?.full_name ?? t('tnt.pendingTenant'),
          last_message: byTenancy.get(tn.id)!.last.body,
          last_at: byTenancy.get(tn.id)!.last.created_at,
          unread: byTenancy.get(tn.id)!.unread,
        })),
    );
    setLoading(false);
  }

  async function loadHandymen() {
    const uid = supabaseUser!.id;
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, body, created_at, read_at, sender:sender_id(full_name), receiver:receiver_id(full_name)')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .is('tenancy_id', null)
      .order('created_at', { ascending: false });

    const byPerson = new Map<string, { msg: any; unread: number; name: string }>();
    (msgs ?? []).forEach((m: any) => {
      const otherId: string = m.sender_id === uid ? m.receiver_id : m.sender_id;
      const otherName: string = m.sender_id === uid
        ? (m.receiver as { full_name: string } | null)?.full_name ?? t('lmsg.handyman')
        : (m.sender as { full_name: string } | null)?.full_name ?? t('lmsg.handyman');
      if (!byPerson.has(otherId)) {
        byPerson.set(otherId, { msg: m, unread: 0, name: otherName });
      }
      if (!m.read_at && m.sender_id !== uid) {
        byPerson.get(otherId)!.unread++;
      }
    });

    setHandymanThreads(
      Array.from(byPerson.entries()).map(([id, { msg, unread, name }]) => ({
        handyman_id: id,
        handyman_name: name,
        last_message: msg.body,
        last_at: msg.created_at,
        unread,
      })),
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-5">{t('lmsg.title')}</h1>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => setTab('tenants')}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
          style={tab === 'tenants' ? { background: PRIMARY, color: '#fff' } : { color: '#6b7280' }}
        >
          <Users className="w-4 h-4" /> {t('lmsg.habitants')}
        </button>
        <button
          onClick={() => setTab('handymen')}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
          style={tab === 'handymen' ? { background: PRIMARY, color: '#fff' } : { color: '#6b7280' }}
        >
          <HardHat className="w-4 h-4" /> {t('lmsg.handymen')}
        </button>
      </div>

      {tab === 'tenants' && (
        loading ? (
          <SkeletonList />
        ) : tenantThreads.length === 0 ? (
          <EmptyState icon={MessageSquare} title={t('lmsg.noTenantMsgs')} description={t('lmsg.noTenantMsgsDesc')} />
        ) : (
          <div className="space-y-2">
            {tenantThreads.map((c) => (
              <button
                key={c.tenancy_id}
                onClick={() => navigate(`/landlord/messages/${c.tenancy_id}`)}
                className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: PRIMARY, color: ACCENT }}>
                  {initials(c.tenant_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{c.tenant_name}</p>
                  <p className="text-xs text-gray-400">{c.property_address}</p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{c.last_message}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="text-xs text-gray-400">{timeAgo(c.last_at)}</p>
                  {c.unread > 0 && (
                    <span className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: ACCENT }}>
                      {c.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {tab === 'handymen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{t('lmsg.directConvos')}</p>
            <button
              onClick={() => navigate('/landlord/handymen')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              {t('lmsg.findHandymen')}
            </button>
          </div>
          {handymanThreads.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title={t('lmsg.noHandymanMsgs')}
              description={t('lmsg.noHandymanMsgsDesc')}
              action={{ label: t('lmsg.findHandymenAction'), onClick: () => navigate('/landlord/handymen') }}
            />
          ) : (
            <div className="space-y-2">
              {handymanThreads.map((th) => (
                <button
                  key={th.handyman_id}
                  onClick={() => navigate(`/landlord/messages/handyman/${th.handyman_id}`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: '#1B3A2F', color: '#34D399' }}>
                    {initials(th.handyman_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{th.handyman_name}</p>
                    <p className="text-xs text-gray-400">{t('lmsg.handyman')}</p>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{th.last_message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="text-xs text-gray-400">{timeAgo(th.last_at)}</p>
                    {th.unread > 0 && (
                      <span className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: ACCENT }}>
                        {th.unread}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tenant Thread ────────────────────────────────────────────────────────────

export function MessageThread() {
  const { tenancyId } = useParams();
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const [messages, setMessages] = useState<(Message & { sender: { full_name: string } | null })[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tenancyInfo, setTenancyInfo] = useState<{ property_address: string; tenant_name: string; tenant_email?: string; tenant_lang: Lang } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tenancyId) { load(); loadMeta(); }
  }, [tenancyId]);

  useEffect(() => {
    if (!tenancyId) return;
    const channel = supabase
      .channel(`landlord-thread-${tenancyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenancy_id=eq.${tenancyId}` }, () => { fetchMessages(false); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenancyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMeta() {
    const { data } = await supabase
      .from('tenancies')
      .select('property:property_id(address_line1), tenant:tenant_id(full_name, email, language)')
      .eq('id', tenancyId)
      .single();
    if (data) {
      const d = data as any;
      const tenant = Array.isArray(d.tenant) ? d.tenant[0] : d.tenant;
      setTenancyInfo({
        property_address: (Array.isArray(d.property) ? d.property[0] : d.property)?.address_line1 ?? '',
        tenant_name: tenant?.full_name ?? t('common.tenant'),
        tenant_email: tenant?.email,
        tenant_lang: tenant?.language === 'es' ? 'es' : 'en',
      });
    }
  }

  async function fetchMessages(showSpinner: boolean) {
    if (showSpinner) setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name)')
      .eq('tenancy_id', tenancyId)
      .order('created_at', { ascending: true });
    setMessages((data as typeof messages) ?? []);
    if (showSpinner) setLoading(false);
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('tenancy_id', tenancyId)
      .neq('sender_id', supabaseUser!.id)
      .is('read_at', null);
  }

  async function load() { await fetchMessages(true); }

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    const { error } = await supabase.from('messages').insert({
      tenancy_id: tenancyId,
      sender_id: supabaseUser!.id,
      body,
    });
    setSending(false);
    if (error) { toast.show(t('toast.sendMessageFailed'), 'error'); return; }
    setText('');
    if (tenancyInfo?.tenant_email) {
      newMessageEmail(tenancyInfo.tenant_email, 'landlord', tenancyInfo.tenant_lang);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/landlord/messages')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="font-semibold text-gray-900">{tenancyInfo?.tenant_name ?? t('lmsg.title')}</p>
          <p className="text-xs text-gray-400">{tenancyInfo?.property_address}</p>
        </div>
      </div>
      <ChatBox
        messages={messages.map((m) => ({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at }))}
        myId={supabaseUser!.id}
        loading={loading}
        text={text}
        setText={setText}
        onSend={send}
        sending={sending}
        bottomRef={bottomRef}
        accentColor={PRIMARY}
      />
    </div>
  );
}

// ─── Handyman Direct Thread ───────────────────────────────────────────────────

export function HandymanThread() {
  const { handymanId } = useParams();
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const [messages, setMessages] = useState<{ id: string; sender_id: string; body: string; created_at: string }[]>([]);
  const [handymanName, setHandymanName] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const uid = supabaseUser!.id;

  // The handyman id comes from the URL; reject anything that isn't a UUID before it
  // reaches a PostgREST .or() filter (injection guard).
  const validHandymanId = isUuid(handymanId) ? handymanId : null;

  useEffect(() => {
    if (validHandymanId) { loadHandyman(); loadMessages(); }
  }, [validHandymanId]);

  useEffect(() => {
    if (!validHandymanId || !uid) return;
    const channel = supabase
      .channel(`landlord-handyman-${uid}-${validHandymanId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${uid}` },
        (payload) => { if ((payload.new as { sender_id: string }).sender_id === validHandymanId) loadMessages(false); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [validHandymanId, uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadHandyman() {
    const { data } = await supabase.from('users').select('full_name').eq('id', validHandymanId).single();
    if (data) setHandymanName((data as { full_name: string }).full_name);
  }

  async function loadMessages(showSpinner = true) {
    if (!validHandymanId) return;
    if (showSpinner) setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .is('tenancy_id', null)
      .or(`and(sender_id.eq.${uid},receiver_id.eq.${validHandymanId}),and(sender_id.eq.${validHandymanId},receiver_id.eq.${uid})`)
      .order('created_at', { ascending: true });
    setMessages((data as typeof messages) ?? []);
    if (showSpinner) setLoading(false);
    // Mark as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .is('tenancy_id', null)
      .eq('sender_id', validHandymanId)
      .eq('receiver_id', uid)
      .is('read_at', null);
  }

  async function send() {
    if (!text.trim() || sending || !validHandymanId) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: uid,
      receiver_id: validHandymanId,
      body: text.trim(),
    });
    setSending(false);
    if (error) { toast.show(t('toast.sendMessageFailed'), 'error'); return; }
    setText('');
    loadMessages(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/landlord/messages')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="font-semibold text-gray-900">{handymanName || t('lmsg.handyman')}</p>

          <p className="text-xs text-gray-400">{t('lmsg.handymanDM')}</p>
        </div>
      </div>
      <ChatBox
        messages={messages}
        myId={uid}
        loading={loading}
        text={text}
        setText={setText}
        onSend={send}
        sending={sending}
        bottomRef={bottomRef}
        accentColor={PRIMARY}
      />
    </div>
  );
}

// ─── Shared Chat Box ──────────────────────────────────────────────────────────

function ChatBox({
  messages, myId, loading, text, setText, onSend, sending, bottomRef, accentColor,
}: {
  messages: { id: string; sender_id: string; body: string; created_at: string }[];
  myId: string;
  loading: boolean;
  text: string;
  setText: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  bottomRef: React.RefObject<HTMLDivElement>;
  accentColor: string;
}) {
  const { t } = useT();
  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <SkeletonList count={3} />
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">{t('lmsg.startConvo')}</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === myId;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
                  style={isMe ? { background: accentColor, color: '#fff' } : {}}
                >
                  {isMe ? <p>{m.body}</p> : <TranslatableText text={m.body} />}
                  <p className={`text-xs mt-1 ${isMe ? 'text-white/50' : 'text-gray-400'}`}>{timeAgo(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-gray-100 p-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder={t('lmsg.typePlaceholder')}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
          style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
        />
        <button
          onClick={onSend}
          disabled={!text.trim() || sending}
          className="px-4 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
          style={{ background: accentColor }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
