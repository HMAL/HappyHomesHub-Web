import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { timeAgo, initials, isUuid } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import TranslatableText from '../../components/shared/TranslatableText';
import { useT } from '../../lib/i18n';

const PRIMARY = '#1B3A2F';
const ACCENT = '#34D399';

interface Thread {
  threadKey: string;       // tenancy_id or direct_<otherId>
  tenancyId: string | null;
  otherId: string;
  otherName: string;
  otherLabel: string;      // "Landlord" or "Landlord · 123 Main St"
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export default function HandymanMessages() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<{ id: string; sender_id: string; body: string; created_at: string }[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [knownLandlords, setKnownLandlords] = useState<{ id: string; full_name: string }[]>([]);
  const [newToId, setNewToId] = useState('');
  const [newText, setNewText] = useState('');
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const uid = supabaseUser!.id;

  useEffect(() => {
    loadThreads();
    loadKnownLandlords();
  }, []);

  useEffect(() => {
    if (activeThread) loadMessages(activeThread);
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;
    const channelId = activeThread.tenancyId ?? `direct-${uid}-${activeThread.otherId}`;
    const channel = supabase
      .channel(`hm-messages-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${uid}` },
        (payload) => {
          const msg = payload.new as { sender_id: string; tenancy_id: string | null };
          const matchesTenancy = activeThread.tenancyId && msg.tenancy_id === activeThread.tenancyId;
          const matchesDirect = !activeThread.tenancyId && !msg.tenancy_id && msg.sender_id === activeThread.otherId;
          if (matchesTenancy || matchesDirect) loadMessages(activeThread);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeThread?.threadKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadThreads() {
    setLoading(true);

    const { data: msgs } = await supabase
      .from('messages')
      .select(`
        id, sender_id, receiver_id, tenancy_id, body, created_at, read_at,
        sender:sender_id(id, full_name),
        receiver:receiver_id(id, full_name),
        tenancy:tenancy_id(id, property:property_id(address_line1, landlord_id, landlord:landlord_id(full_name)))
      `)
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: false });

    if (!msgs) { setLoading(false); return; }

    const seen = new Set<string>();
    const thr: Thread[] = [];

    for (const m of msgs as any[]) {
      const tenancyId: string | null = m.tenancy_id ?? null;

      // Thread key: tenancy-based or direct
      const otherId: string = tenancyId
        ? (m.tenancy?.property?.landlord_id ?? (m.sender_id === uid ? m.receiver_id : m.sender_id))
        : (m.sender_id === uid ? m.receiver_id : m.sender_id);

      const threadKey = tenancyId ? `t_${tenancyId}` : `d_${otherId}`;
      if (seen.has(threadKey) || !otherId) continue;
      seen.add(threadKey);

      // Get other person's name (no extra query — landlord joined in initial fetch)
      let otherName = t('hmsg.landlord');
      if (tenancyId) {
        const landlordName = (m.tenancy?.property as any)?.landlord?.full_name;
        if (landlordName) otherName = landlordName;
      } else {
        const senderInfo = m.sender as { id: string; full_name: string } | null;
        const receiverInfo = m.receiver as { id: string; full_name: string } | null;
        otherName = m.sender_id === uid
          ? (receiverInfo?.full_name ?? t('hmsg.landlord'))
          : (senderInfo?.full_name ?? t('hmsg.landlord'));
      }

      const unread = (msgs as any[]).filter((x) => {
        if (x.read_at || x.sender_id === uid) return false;
        if (tenancyId) return x.tenancy_id === tenancyId;
        return x.tenancy_id === null && x.sender_id === otherId;
      }).length;

      const address = m.tenancy?.property?.address_line1;
      thr.push({
        threadKey,
        tenancyId,
        otherId,
        otherName,
        otherLabel: address ? t('hmsg.landlordAddr', { addr: address }) : t('hmsg.landlordDirect'),
        lastMessage: m.body,
        lastAt: m.created_at,
        unread,
      });
    }

    setThreads(thr);
    if (thr.length > 0) setActiveThread(thr[0]);
    setLoading(false);
  }

  async function loadMessages(thread: Thread) {
    let query = supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .order('created_at', { ascending: true });

    if (thread.tenancyId) {
      query = query.eq('tenancy_id', thread.tenancyId);
    } else {
      if (!isUuid(thread.otherId)) { setMessages([]); return; } // guard .or() injection
      query = query
        .is('tenancy_id', null)
        .or(`and(sender_id.eq.${uid},receiver_id.eq.${thread.otherId}),and(sender_id.eq.${thread.otherId},receiver_id.eq.${uid})`);
    }

    const { data } = await query;
    setMessages((data as typeof messages) ?? []);

    // Mark as read
    let markQuery = supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .neq('sender_id', uid)
      .is('read_at', null);

    if (thread.tenancyId) {
      markQuery = markQuery.eq('tenancy_id', thread.tenancyId);
    } else {
      markQuery = markQuery.is('tenancy_id', null).eq('sender_id', thread.otherId).eq('receiver_id', uid);
    }
    await markQuery;
  }

  async function loadKnownLandlords() {
    const { data } = await supabase
      .from('maintenance_requests')
      .select('tenancy:tenancy_id(property:property_id(landlord_id, landlord:landlord_id(id, full_name)))')
      .eq('handyman_id', uid);
    const seen = new Set<string>();
    const list: { id: string; full_name: string }[] = [];
    for (const mr of ((data ?? []) as any[])) {
      const landlordId = mr.tenancy?.property?.landlord_id;
      const landlordName = mr.tenancy?.property?.landlord?.full_name;
      if (landlordId && landlordName && !seen.has(landlordId)) {
        seen.add(landlordId);
        list.push({ id: landlordId, full_name: landlordName });
      }
    }
    setKnownLandlords(list);
  }

  async function startConversation() {
    if (!newToId || !newText.trim()) return;
    setStarting(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: uid,
      receiver_id: newToId,
      body: newText.trim(),
    });
    setStarting(false);
    if (error) { toast.show(t('toast.sendMessageFailedShort'), 'error'); return; }
    setShowNew(false);
    setNewText('');
    setNewToId('');
    await loadThreads();
  }

  async function send() {
    if (!text.trim() || !activeThread || sending) return;
    setSending(true);

    const payload: Record<string, unknown> = {
      sender_id: uid,
      receiver_id: activeThread.otherId,
      body: text.trim(),
    };
    if (activeThread.tenancyId) {
      payload.tenancy_id = activeThread.tenancyId;
    }

    const { error } = await supabase.from('messages').insert(payload);
    setSending(false);
    if (error) { toast.show(t('toast.sendMessageFailed'), 'error'); return; }
    setText('');
    await loadMessages(activeThread);
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Thread list */}
      <div className="w-72 border-r border-gray-100 bg-white overflow-y-auto shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-bold text-gray-900">{t('lmsg.title')}</h2>
          {knownLandlords.length > 0 && (
            <button
              onClick={() => setShowNew((v) => !v)}
              title={t('hmsg.startNew')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              {showNew ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          )}
        </div>
        {showNew && (
          <div className="p-3 border-b border-gray-100 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('hmsg.newConversation')}</p>
            <select
              value={newToId}
              onChange={(e) => setNewToId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] bg-white"
            >
              <option value="">{t('hmsg.selectLandlord')}</option>
              {knownLandlords.map((l) => (
                <option key={l.id} value={l.id}>{l.full_name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && startConversation()}
                placeholder={t('hmsg.firstMessage')}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F]"
              />
              <button
                onClick={startConversation}
                disabled={!newToId || !newText.trim() || starting}
                className="p-2 rounded-lg text-white disabled:opacity-50 transition hover:opacity-90"
                style={{ background: PRIMARY }}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-4"><SkeletonList count={3} /></div>
        ) : threads.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={MessageSquare} title={t('lmsg.noTenantMsgs')}
              description={knownLandlords.length > 0 ? t('hmsg.emptyDesc1') : t('hmsg.emptyDesc2')} />
          </div>
        ) : (
          threads.map((t) => (
            <button
              key={t.threadKey}
              onClick={() => setActiveThread(t)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50"
              style={activeThread?.threadKey === t.threadKey ? { background: ACCENT + '22' } : {}}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: PRIMARY }}
                >
                  {initials(t.otherName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.otherName}</p>
                    {t.unread > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: ACCENT, color: PRIMARY }}>
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{t.otherLabel}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{t.lastMessage}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!activeThread ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={MessageSquare} title={t('hmsg.selectConversation')} description="" />
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: PRIMARY }}>
                {initials(activeThread.otherName)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{activeThread.otherName}</p>
                <p className="text-xs text-gray-400">{activeThread.otherLabel}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.map((m) => {
                const isMe = m.sender_id === uid;
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-xs px-4 py-2.5 rounded-2xl text-sm"
                      style={isMe ? { background: PRIMARY, color: '#fff' } : { background: '#fff', color: '#111827' }}
                    >
                      {isMe ? <p>{m.body}</p> : <TranslatableText text={m.body} />}
                      <p className="text-xs mt-1 opacity-60">{timeAgo(m.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center gap-3">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={t('lmsg.typePlaceholder')}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition"
              />
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="p-2.5 rounded-xl text-white disabled:opacity-50 transition hover:opacity-90"
                style={{ background: PRIMARY }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
