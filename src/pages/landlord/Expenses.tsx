import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Receipt, Plus, Trash2, Pencil, X, Wrench, Search, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Property, ExpenseCategory } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { compressImage } from '../../lib/image';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import TaxExportCard from '../../components/shared/TaxExportCard';
import SuperLock from '../../components/shared/SuperLock';
import { useIsSuper } from '../../lib/useIsSuper';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface TicketOption { id: string; title: string; status: string; }

interface ExpenseRow {
  id: string;
  property_id: string;
  landlord_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  receipt_path?: string;
  maintenance_request_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  property: Property | null;
  maintenance_request: { id: string; title: string } | null;
}

async function uploadReceipt(uid: string, file: File): Promise<string | null> {
  const compressed = await compressImage(file); // shrinks photo receipts; PDFs pass through
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${uid}/${Date.now()}-receipt.${ext}`;
  const { error } = await supabase.storage.from('receipts').upload(path, compressed, { upsert: false });
  if (error) return null;
  return path;
}

async function getReceiptUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

const CATEGORIES: ExpenseCategory[] = [
  'maintenance', 'insurance', 'taxes', 'utilities', 'mortgage',
  'management_fee', 'landscaping', 'cleaning', 'other',
];

async function loadTicketsForProperty(propId: string): Promise<TicketOption[]> {
  const tenancyRes = await supabase.from('tenancies').select('id').eq('property_id', propId);
  const tenancyIds = tenancyRes.data?.map((t: { id: string }) => t.id) ?? [];
  if (tenancyIds.length === 0) return [];
  const { data } = await supabase
    .from('maintenance_requests')
    .select('id, title, status')
    .in('tenancy_id', tenancyIds)
    .order('created_at', { ascending: false });
  return (data ?? []) as TicketOption[];
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditExpenseModal({ expense, onClose, onSaved }: { expense: ExpenseRow; onClose: () => void; onSaved: (updated: ExpenseRow) => void }) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(expense.amount));
  const [date, setDate] = useState(expense.expense_date.slice(0, 10));
  const [tickets, setTickets] = useState<TicketOption[]>([]);
  const [requestId, setRequestId] = useState<string>(expense.maintenance_request_id ?? '');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTicketsForProperty(expense.property_id).then(setTickets);
  }, [expense.property_id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    let receipt_path = expense.receipt_path;
    if (receiptFile) {
      const uploaded = await uploadReceipt(supabaseUser!.id, receiptFile);
      if (uploaded) receipt_path = uploaded;
      else toast.show(t('toast.receiptFailedNoNew'), 'warning');
    }
    const { data, error } = await supabase
      .from('expenses')
      .update({
        category,
        description: description.trim(),
        amount: parseFloat(amount),
        expense_date: date,
        maintenance_request_id: requestId || null,
        receipt_path: receipt_path ?? null,
        updated_by: supabaseUser!.id,
      })
      .eq('id', expense.id)
      .select('*, property:property_id(address_line1, city), maintenance_request:maintenance_request_id(id, title)')
      .single();
    setSaving(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.expenseUpdated'), 'success');
    onSaved(data as ExpenseRow);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: PRIMARY }}>
          <p className="font-semibold text-white">{t('exp.editTitle')}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.category')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition">
                {CATEGORIES.map((c) => <option key={c} value={c}>{t('exp.cat_' + c)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.amount')}</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={0} step="0.01" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.description')}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.linkTicket')} <span className="text-gray-400 font-normal">{t('exp.optional')}</span></label>
            <select value={requestId} onChange={(e) => setRequestId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition">
              <option value="">{t('exp.notLinked')}</option>
              {tickets.map((tk) => (
                <option key={tk.id} value={tk.id}>{tk.title} ({t('status.' + tk.status)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('exp.receipt')} <span className="text-gray-400 font-normal">{t('exp.receiptOptional')}</span>
            </label>
            {expense.receipt_path && !receiptFile && (
              <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> {t('exp.currentReceipt')}
              </p>
            )}
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60" style={{ background: PRIMARY }}>
              {saving ? t('common.saving') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function ExpensesList() {
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('expenses')
        .select('*, property:property_id(address_line1, city), maintenance_request:maintenance_request_id(id, title)')
        .eq('landlord_id', supabaseUser!.id)
        .order('expense_date', { ascending: false });
      if (fetchErr) throw fetchErr;
      setExpenses((data as ExpenseRow[]) ?? []);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('exp.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (error) {
      toast.show(error.message, 'error');
    } else {
      toast.show(t('toast.expenseDeleted'), 'success');
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return expenses.filter((e) => {
      const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
      const matchQ = !q || `${e.description} ${e.category}`.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [expenses, search, categoryFilter]);

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const { isSuper, loading: superLoading } = useIsSuper();
  if (!superLoading && !isSuper) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <SuperLock title={t('exp.lockTitle')} description={t('exp.pitch')}>{null}</SuperLock>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('exp.title')}</h1>
          {filtered.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{t('exp.total', { amount: formatCurrency(total) })}</p>
          )}
        </div>
        <button
          onClick={() => navigate('/landlord/expenses/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
          style={{ background: PRIMARY }}
        >
          <Plus className="w-4 h-4" /> {t('exp.add')}
        </button>
      </div>

      <TaxExportCard primary={PRIMARY} accent={ACCENT} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('exp.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] bg-white transition"
        >
          <option value="all">{t('exp.allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{t('exp.cat_' + c)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Receipt} title={search || categoryFilter !== 'all' ? t('exp.noMatch') : t('exp.noneYet')} description={search || categoryFilter !== 'all' ? t('exp.noMatchDesc') : t('exp.noneDesc')} />
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div key={e.id} className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 capitalize">{t('exp.cat_' + e.category)}</p>
                <p className="text-sm text-gray-500 truncate">{e.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(e.property as { address_line1: string } | null)?.address_line1} · {formatDate(e.expense_date)}
                </p>
                {e.maintenance_request && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: ACCENT + '18', color: '#92400e' }}>
                    <Wrench className="w-3 h-3" />
                    {(e.maintenance_request as { title: string }).title}
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-900 shrink-0">{formatCurrency(e.amount)}</p>
              {e.receipt_path && (
                <button
                  onClick={async () => {
                    const url = await getReceiptUrl(e.receipt_path!);
                    if (url) window.open(url, '_blank');
                    else toast.show(t('toast.couldNotLoadReceipt'), 'error');
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition"
                  title={t('exp.viewReceipt')}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setEditing(e)}
                className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition"
                title={t('exp.editExpense')}
              >
                <Pencil className="w-4 h-4" />
              </button>
              {confirmDeleteId === e.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="px-2 py-1 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deletingId === e.id ? '…' : t('common.delete')}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(e.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                  title={t('exp.deleteExpense')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditExpenseModal
          expense={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => setExpenses((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
        />
      )}
    </div>
  );
}

// ─── New ─────────────────────────────────────────────────────────────────────

export function ExpenseNew() {
  const navigate = useNavigate();
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [searchParams] = useSearchParams();

  // Pre-fill from MaintenanceDetail shortcut
  const preRequestId = searchParams.get('request_id') ?? '';
  const prePropId = searchParams.get('property_id') ?? '';

  const [properties, setProperties] = useState<Property[]>([]);
  const [propId, setPropId] = useState(prePropId);
  const [category, setCategory] = useState<ExpenseCategory>('maintenance');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tickets, setTickets] = useState<TicketOption[]>([]);
  const [requestId, setRequestId] = useState(preRequestId);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supabaseUser) {
      supabase.from('properties').select('*').eq('landlord_id', supabaseUser.id)
        .then(({ data }) => {
          setProperties(data as Property[] ?? []);
          // If pre-filled property isn't in the list yet, wait for load
        });
    }
  }, [supabaseUser]);

  // When property changes, load its maintenance tickets
  useEffect(() => {
    if (!propId) { setTickets([]); return; }
    loadTicketsForProperty(propId).then((t) => {
      setTickets(t);
      // If pre-filled requestId is no longer valid for this property, clear it
      if (requestId && !t.some((x) => x.id === requestId)) setRequestId('');
    });
  }, [propId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propId || !amount || !description) { toast.show(t('toast.fillAllRequired'), 'error'); return; }
    setSaving(true);
    let receipt_path: string | null = null;
    if (receiptFile) {
      receipt_path = await uploadReceipt(supabaseUser!.id, receiptFile);
      if (!receipt_path) toast.show(t('toast.receiptFailed'), 'warning');
    }
    const { error } = await supabase.from('expenses').insert({
      property_id: propId,
      landlord_id: supabaseUser!.id,
      category,
      description: description.trim(),
      amount: parseFloat(amount),
      expense_date: date,
      maintenance_request_id: requestId || null,
      receipt_path,
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    });
    setSaving(false);
    if (error) toast.show(error.message, 'error');
    else { toast.show(t('toast.expenseLogged'), 'success'); navigate('/landlord/expenses'); }
  }

  const { isSuper, loading: superLoading } = useIsSuper();
  if (!superLoading && !isSuper) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <SuperLock title={t('exp.lockTitle')} description={t('exp.pitch')}>{null}</SuperLock>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('exp.logTitle')}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.property')}</label>
          <select value={propId} onChange={(e) => setPropId(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition">
            <option value="">{t('exp.selectProperty')}</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.address_line1}</option>)}
          </select>
        </div>

        {/* Maintenance ticket picker — shown once a property is selected */}
        {propId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('exp.linkTicket')} <span className="text-gray-400 font-normal">{t('exp.optional')}</span>
            </label>
            {tickets.length === 0 ? (
              <p className="text-xs text-gray-400 px-1">{t('exp.noTickets')}</p>
            ) : (
              <select
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
              >
                <option value="">{t('exp.notLinked')}</option>
                {tickets.map((tk) => (
                  <option key={tk.id} value={tk.id}>
                    {tk.title} ({t('status.' + tk.status)})
                  </option>
                ))}
              </select>
            )}
            {requestId && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: ACCENT }}>
                <Wrench className="w-3 h-3" /> {t('exp.trackedUnder')}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.categoryReq')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition">
              {CATEGORIES.map((c) => <option key={c} value={c}>{t('exp.cat_' + c)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.amountReq')}</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min={0} step="0.01" placeholder="0.00" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.descriptionReq')}</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required placeholder={t('exp.descPlaceholder')} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('exp.dateReq')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('exp.receipt')} <span className="text-gray-400 font-normal">{t('exp.receiptOptionalMax')}</span>
          </label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition"
          />
          {receiptFile && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Paperclip className="w-3 h-3" /> {receiptFile.name}
            </p>
          )}
        </div>
        <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60" style={{ background: PRIMARY }}>
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Receipt className="w-4 h-4" />}
          {saving ? t('common.saving') : t('exp.saveExpense')}
        </button>
      </form>
    </div>
  );
}
