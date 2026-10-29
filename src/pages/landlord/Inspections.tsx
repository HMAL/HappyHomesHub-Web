import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ClipboardList, Plus, X, Calendar, User, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Inspection, InspectionPhoto, Property, Tenancy } from '../../types';
import { formatDateTime, stateToTimezone, safeHttpUrl } from '../../lib/utils';
import { compressImage } from '../../lib/image';
import Badge from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useT } from '../../lib/i18n';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface InspectionRow {
  id: string;
  tenancy_id: string;
  type: Inspection['type'];
  conducted_by: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  tenancy: (Tenancy & { property: Property }) | null;
  conductor: { full_name: string } | null;
}

const typeLabelKey: Record<string, string> = { move_in: 'insp.typeMoveIn', move_out: 'insp.typeMoveOut', routine: 'insp.typeRoutine' };
const typeVariant: Record<string, 'info' | 'warning' | 'neutral'> = { move_in: 'info', move_out: 'warning', routine: 'neutral' };

function InspectionDetailPanel({ row, onClose }: { row: InspectionRow; onClose: () => void }) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase
      .from('inspection_photos')
      .select('*')
      .eq('inspection_id', row.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setPhotos((data as InspectionPhoto[]) ?? []));
  }, [row.id]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > MAX_PHOTO_BYTES) {
        toast.show(t('toast.fileExceeds5mb', { name: file.name }), 'error');
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.show(t('toast.fileMustBeImage', { name: file.name }), 'error');
        continue;
      }
      setUploading(true);
      const compressed = await compressImage(file);
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `inspections/${row.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('inspection-photos').upload(path, compressed);
      if (upErr) { toast.show(t('toast.uploadFailed', { msg: upErr.message }), 'error'); setUploading(false); continue; }

      const { data: urlData } = supabase.storage.from('inspection-photos').getPublicUrl(path);
      const { data: inserted } = await supabase.from('inspection_photos').insert({
        inspection_id: row.id,
        storage_path: path,
        public_url: urlData.publicUrl,
        created_by: supabaseUser!.id,
      }).select().single();
      if (inserted) setPhotos((prev) => [...prev, inserted as InspectionPhoto]);
      setUploading(false);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100" style={{ background: PRIMARY }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT + '33' }}>
              <ClipboardList className="w-5 h-5" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="font-bold text-white">{typeLabelKey[row.type] ? t(typeLabelKey[row.type]) : row.type} {t('insp.inspectionSuffix')}</p>
              <p className="text-white/60 text-xs">{formatDateTime(row.created_at, stateToTimezone((row.tenancy as any)?.property?.state))}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">
          <Badge label={typeLabelKey[row.type] ? t(typeLabelKey[row.type]) : row.type} variant={typeVariant[row.type] ?? 'neutral'} />

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
              <FileText className="w-4 h-4" style={{ color: ACCENT }} />
              {t('insp.property')}
            </div>
            <p className="text-sm text-gray-800">
              {(row.tenancy as { property: { address_line1: string; city: string } } | null)?.property?.address_line1 ?? '—'}
            </p>
            <p className="text-xs text-gray-500">
              {(row.tenancy as { property: { city: string } } | null)?.property?.city}
            </p>
          </div>

          {row.conductor && (
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">{t('insp.conductedBy')}</p>
                <p className="text-sm font-semibold text-gray-800">{row.conductor.full_name}</p>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">{t('insp.date')}</p>
              <p className="text-sm font-semibold text-gray-800">{formatDateTime(row.created_at, stateToTimezone((row.tenancy as any)?.property?.state))}</p>
            </div>
          </div>

          {row.notes && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">{t('insp.notes')}</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{row.notes}</p>
            </div>
          )}

          {/* Photos section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">{t('insp.photos', { n: photos.length })}</p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
              >
                {uploading
                  ? <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  : <Camera className="w-3.5 h-3.5 text-gray-600" />}
                {uploading ? t('insp.uploading') : t('insp.addPhotos')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            {photos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-xl">
                {t('insp.noPhotos')}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((ph) => (
                  <a key={ph.id} href={safeHttpUrl(ph.public_url)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={ph.public_url}
                      alt={ph.caption ?? t('insp.photoAlt')}
                      className="w-full aspect-square object-cover rounded-lg border border-gray-100 hover:opacity-90 transition"
                    />
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">{t('insp.photoHint')}</p>
          </div>

          {(row.type === 'move_in' || row.type === 'move_out') && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-xs font-semibold text-amber-800 mb-1">{t('insp.tenantSignature')}</p>
              <p className="text-xs text-amber-700">
                {t('insp.tenantSignatureDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function InspectionsList() {
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useT();
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InspectionRow | null>(null);
  const toast = useToastStore();

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const propIds = (
        await supabase.from('properties').select('id').eq('landlord_id', supabaseUser!.id)
      ).data?.map((p: { id: string }) => p.id) ?? [];

      const tenancyIds = (
        await supabase.from('tenancies').select('id').in('property_id', propIds)
      ).data?.map((t: { id: string }) => t.id) ?? [];

      const { data, error: fetchErr } = await supabase
        .from('inspections')
        .select('*, tenancy:tenancy_id(*, property:property_id(address_line1, city, state)), conductor:conducted_by(full_name)')
        .in('tenancy_id', tenancyIds)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setRows((data as InspectionRow[]) ?? []);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('insp.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('insp.title')}</h1>
        <button
          onClick={() => navigate('/landlord/inspections/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
          style={{ background: PRIMARY }}
        >
          <Plus className="w-4 h-4" /> {t('insp.new')}
        </button>
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t('insp.noneYet')} description={t('insp.noneDesc')} />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: PRIMARY }}>
                <ClipboardList className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {(r.tenancy as { property: { address_line1: string } } | null)?.property?.address_line1 ?? '—'}
                </p>
                <p className="text-sm text-gray-500">{formatDateTime(r.created_at, stateToTimezone((r.tenancy as any)?.property?.state))}</p>
                {r.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{r.notes}</p>}
              </div>
              <Badge label={typeLabelKey[r.type] ? t(typeLabelKey[r.type]) : r.type} variant={typeVariant[r.type] ?? 'neutral'} />
            </button>
          ))}
        </div>
      )}

      {selected && <InspectionDetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export function InspectionNew() {
  const navigate = useNavigate();
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [tenancies, setTenancies] = useState<(Tenancy & { property: Property })[]>([]);
  const [selectedTenancy, setSelectedTenancy] = useState('');
  const [type, setType] = useState<'move_in' | 'move_out' | 'routine'>('routine');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supabaseUser) loadTenancies();
  }, [supabaseUser]);

  async function loadTenancies() {
    const { data: props } = await supabase.from('properties').select('id').eq('landlord_id', supabaseUser!.id);
    const propIds = (props ?? []).map((p: { id: string }) => p.id);
    if (propIds.length === 0) return;
    const { data } = await supabase
      .from('tenancies')
      .select('*, property:property_id(address_line1, city)')
      .in('property_id', propIds)
      .eq('status', 'active');
    setTenancies((data as (Tenancy & { property: Property })[]) ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenancy) { toast.show(t('toast.selectTenancy'), 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('inspections').insert({
      tenancy_id: selectedTenancy,
      type,
      conducted_by: supabaseUser!.id,
      notes: notes || null,
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    });
    setSaving(false);
    if (error) toast.show(error.message, 'error');
    else { toast.show(t('toast.inspectionRecorded'), 'success'); navigate('/landlord/inspections'); }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('insp.new')}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('insp.propertyTenancy')}</label>
          <select value={selectedTenancy} onChange={(e) => setSelectedTenancy(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition">
            <option value="">{t('insp.selectTenancy')}</option>
            {tenancies.map((tn) => (
              <option key={tn.id} value={tn.id}>{(tn.property as { address_line1: string })?.address_line1}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('insp.inspectionType')}</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition">
            <option value="move_in">{t('insp.typeMoveIn')}</option>
            <option value="move_out">{t('insp.typeMoveOut')}</option>
            <option value="routine">{t('insp.typeRoutine')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('insp.notes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={t('insp.notesPlaceholder')} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition resize-none" />
        </div>
        <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60" style={{ background: PRIMARY }}>
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ClipboardList className="w-4 h-4" />}
          {saving ? t('common.saving') : t('insp.save')}
        </button>
      </form>
    </div>
  );
}
