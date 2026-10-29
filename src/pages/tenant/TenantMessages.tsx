import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Message } from '../../types';
import { timeAgo } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import TranslatableText from '../../components/shared/TranslatableText';
import { newMessageEmail, type Lang } from '../../lib/notify';
import { useT } from '../../lib/i18n';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

export default function TenantMessages() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [messages, setMessages] = useState<(Message & { sender: { full_name: string } | null })[]>([]);
  const [tenancyId, setTenancyId] = useState<string | null>(null);
  const [landlordEmail, setLandlordEmail] = useState<string | null>(null);
  const [landlordLang, setLandlordLang] = useState<Lang>('en');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (supabaseUser) init();
  }, [supabaseUser]);

  useEffect(() => {
    if (!tenancyId) return;
    const channel = supabase
      .channel(`tenant-messages-${tenancyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenancy_id=eq.${tenancyId}` }, () => { loadMessages(tenancyId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenancyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function init() {
    setLoading(true);
    const { data: t } = await supabase
      .from('tenancies')
      .select('id, property:property_id(landlord_id)')
      .eq('tenant_id', supabaseUser!.id)
      .in('status', ['active', 'pending_invite'])
      .limit(1)
      .single();
    if (!t) { setLoading(false); return; }
    setTenancyId(t.id);
    // Load landlord email for notification
    const landlordId = (t as any).property?.landlord_id;
    if (landlordId) {
      supabase.from('users').select('email, language').eq('id', landlordId).single().then(({ data }) => {
        if (data?.email) setLandlordEmail(data.email);
        if (data?.language) setLandlordLang(data.language === 'es' ? 'es' : 'en');
      });
    }
    await loadMessages(t.id);
  }

  async function loadMessages(tid: string) {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name)')
      .eq('tenancy_id', tid)
      .order('created_at', { ascending: true });
    setMessages((data as typeof messages) ?? []);
    setLoading(false);
    // Mark read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('tenancy_id', tid)
      .neq('sender_id', supabaseUser!.id)
      .is('read_at', null);
  }

  async function send() {
    if (!text.trim() || sending || !tenancyId) return;
    setSending(true);
    const body = text.trim();
    const { error } = await supabase.from('messages').insert({
      tenancy_id: tenancyId,
      sender_id: supabaseUser!.id,
      body,
    });
    setSending(false);
    if (error) {
      toast.show(t('toast.sendMessageFailed'), 'error');
      return;
    }
    setText('');
    if (landlordEmail) newMessageEmail(landlordEmail, 'tenant', landlordLang);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-4">{t('sidebar.messages')}</h1>

      {!tenancyId && !loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 mb-1">{t('msg.noTenancyLinked')}</p>
            <p className="text-sm text-gray-400">{t('msg.noTenancyDesc')}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <SkeletonList count={4} />
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                {t('msg.noMessagesTenant')}
              </p>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === supabaseUser?.id;
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
                      style={isMe ? { background: PRIMARY } : {}}
                    >
                      {!isMe && (
                        <p className="text-xs font-semibold mb-1" style={{ color: ACCENT }}>
                          {(m.sender as { full_name: string } | null)?.full_name ?? t('common.landlord')}
                        </p>
                      )}
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
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={t('msg.placeholderTenant')}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="px-4 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
