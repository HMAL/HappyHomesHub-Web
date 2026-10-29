import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Download, PenLine, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Document as Doc, DocumentType, SignatureStatus } from '../../types';
import { formatDateTime } from '../../lib/utils';
import Badge from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useT } from '../../lib/i18n';
import { signatureRequestedEmail, type Lang } from '../../lib/notify';

const PRIMARY = '#0D1F2D';

const typeVariant: Record<DocumentType, 'info' | 'success' | 'warning' | 'neutral'> = {
  lease_agreement: 'success',
  inspection_move_in: 'info',
  inspection_move_out: 'warning',
  notice: 'warning',
  addendum: 'info',
  other: 'neutral',
};

const sigVariant: Record<SignatureStatus, 'warning' | 'success' | 'neutral' | 'danger'> = {
  none: 'neutral',
  requested: 'warning',
  signed: 'success',
  declined: 'danger',
};

const sigLabelKey: Record<SignatureStatus, string> = {
  none: '',
  requested: 'ldoc.awaitingSignature',
  signed: 'doc.signed',
  declined: 'doc.declined',
};

const docTypeKey: Record<DocumentType, string> = {
  lease_agreement: 'ldoc.t_lease_agreement',
  inspection_move_in: 'ldoc.t_inspection_move_in',
  inspection_move_out: 'ldoc.t_inspection_move_out',
  notice: 'ldoc.t_notice',
  addendum: 'ldoc.t_addendum',
  other: 'ldoc.t_other',
};

interface PropertyOption { id: string; address_line1: string; city: string; }

export default function Documents() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('other');
  const [title, setTitle] = useState('');
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [activeTenancyId, setActiveTenancyId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [tenantEmailMap, setTenantEmailMap] = useState<Record<string, string>>({});
  const [tenantLangMap, setTenantLangMap] = useState<Record<string, Lang>>({});

  useEffect(() => {
    if (supabaseUser) { load(); loadProperties(); }
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const propIds = (
        await supabase.from('properties').select('id').eq('landlord_id', supabaseUser!.id)
      ).data?.map((p: { id: string }) => p.id) ?? [];

      const { data, error: fetchErr } = await supabase
        .from('documents')
        .select('*')
        .in('property_id', propIds)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      const fetched = (data as Doc[]) ?? [];
      setDocs(fetched);

      // Resolve tenant emails for signature notifications
      const tenancyIds = [...new Set(fetched.filter((d) => d.tenancy_id).map((d) => d.tenancy_id!))];
      if (tenancyIds.length > 0) {
        const { data: tenancies } = await supabase
          .from('tenancies')
          .select('id, tenant:tenant_id(email, language)')
          .in('id', tenancyIds);
        const map: Record<string, string> = {};
        const langMap: Record<string, Lang> = {};
        (tenancies ?? []).forEach((t: { id: string; tenant: { email: string; language?: string } | { email: string; language?: string }[] | null }) => {
          const tenant = Array.isArray(t.tenant) ? t.tenant[0] : t.tenant;
          if (tenant?.email) map[t.id] = tenant.email;
          if (tenant) langMap[t.id] = tenant.language === 'es' ? 'es' : 'en';
        });
        setTenantEmailMap(map);
        setTenantLangMap(langMap);
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('ldoc.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadProperties() {
    const { data } = await supabase
      .from('properties')
      .select('id, address_line1, city')
      .eq('landlord_id', supabaseUser!.id)
      .order('created_at', { ascending: true });
    const props = (data as PropertyOption[]) ?? [];
    setProperties(props);
    if (props.length === 1) handlePropChange(props[0].id);
  }

  async function handlePropChange(propId: string) {
    setSelectedPropId(propId);
    setActiveTenancyId(null);
    if (!propId) return;
    const { data } = await supabase
      .from('tenancies')
      .select('id')
      .eq('property_id', propId)
      .in('status', ['active', 'pending_invite'])
      .limit(1)
      .single();
    setActiveTenancyId(data?.id ?? null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedPropId) { toast.show(t('toast.selectPropertyFirst'), 'warning'); return; }
    // A typed title wins; otherwise derive one from the file name.
    const docTitle = title.trim() || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const allowedExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const fileExt = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!allowedExts.includes(fileExt)) { toast.show(t('toast.fileTypeAllowed'), 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.show(t('toast.fileUnder10mb'), 'error'); return; }
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${supabaseUser!.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
    if (uploadErr) { toast.show(uploadErr.message, 'error'); setUploading(false); return; }

    await supabase.from('documents').insert({
      uploaded_by: supabaseUser!.id,
      property_id: selectedPropId,
      tenancy_id: activeTenancyId ?? null,
      type: docType,
      title: docTitle,
      storage_path: path,
      file_size: file.size,
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    });

    toast.show(t('toast.documentUploaded'), 'success');
    setTitle('');
    setUploading(false);
    load();
  }

  async function download(doc: Doc) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) { toast.show(t('toast.couldNotOpenDoc'), 'error'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function requestSignature(doc: Doc) {
    if (!doc.tenancy_id) {
      toast.show(t('toast.docNotLinked'), 'warning');
      return;
    }
    const tenantEmail = tenantEmailMap[doc.tenancy_id];
    if (!tenantEmail) {
      toast.show(t('toast.noTenantEmailTenancy'), 'warning');
      return;
    }
    setRequestingId(doc.id);
    const { error } = await supabase
      .from('documents')
      .update({
        signature_status: 'requested',
        signature_requested_at: new Date().toISOString(),
        signature_requested_by: supabaseUser!.id,
        updated_by: supabaseUser!.id,
      })
      .eq('id', doc.id);
    if (error) { toast.show(error.message, 'error'); setRequestingId(null); return; }
    setDocs((prev) =>
      prev.map((d) =>
        d.id === doc.id
          ? { ...d, signature_status: 'requested' as SignatureStatus, signature_requested_at: new Date().toISOString() }
          : d,
      ),
    );
    signatureRequestedEmail(tenantEmail, doc.title, doc.tenancy_id ? tenantLangMap[doc.tenancy_id] ?? 'en' : 'en');
    toast.show(t('toast.signatureRequested'), 'success');
    setRequestingId(null);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('ldoc.title')}</h1>

      {/* Upload */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">{t('ldoc.upload')}</h2>
        <div className="flex gap-3 flex-wrap">
          {properties.length > 1 && (
            <select
              value={selectedPropId}
              onChange={(e) => handlePropChange(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            >
              <option value="">{t('ldoc.selectProperty')}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.address_line1}, {p.city}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('ldoc.docTitle')}
            className="flex-1 min-w-40 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
          />
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
          >
            <option value="lease_agreement">{t('ldoc.t_lease_agreement')}</option>
            <option value="inspection_move_in">{t('ldoc.t_inspection_move_in')}</option>
            <option value="inspection_move_out">{t('ldoc.t_inspection_move_out')}</option>
            <option value="notice">{t('ldoc.t_notice')}</option>
            <option value="addendum">{t('ldoc.t_addendum')}</option>
            <option value="other">{t('ldoc.t_other')}</option>
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !selectedPropId}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            {uploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? t('ldoc.uploading') : t('ldoc.chooseFile')}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
        </div>
        <p className="text-xs text-gray-400 mt-2">{t('ldoc.fileHint')}</p>
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title={t('ldoc.noneYet')} description={t('ldoc.noneDesc')} />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-100 flex items-start gap-4">
              <FileText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{d.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge label={t(docTypeKey[d.type])} variant={typeVariant[d.type]} />
                  {d.signature_status !== 'none' && (
                    <Badge label={t(sigLabelKey[d.signature_status])} variant={sigVariant[d.signature_status]} />
                  )}
                  <span className="text-xs text-gray-400">{formatDateTime(d.created_at)}</span>
                  {d.file_size && (
                    <span className="text-xs text-gray-400">{(d.file_size / 1024).toFixed(0)} KB</span>
                  )}
                  {d.signature_status === 'signed' && d.signed_at && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      {t('ldoc.signedAt', { date: formatDateTime(d.signed_at) })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(d.type === 'lease_agreement' || d.type === 'addendum') && d.signature_status === 'none' && (
                  <button
                    onClick={() => requestSignature(d)}
                    disabled={requestingId === d.id}
                    title={t('ldoc.requestSigTitle')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                    style={{ background: PRIMARY }}
                  >
                    {requestingId === d.id
                      ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <PenLine className="w-3 h-3" />}
                    {requestingId === d.id ? t('ldoc.requesting') : t('ldoc.requestSignature')}
                  </button>
                )}
                {d.signature_status === 'requested' && (() => {
                  const requestedAt = d.signature_requested_at ? new Date(d.signature_requested_at) : null;
                  const daysPending = requestedAt ? Math.floor((Date.now() - requestedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  const isOverdue = daysPending >= 7;
                  const tenantEmail = d.tenancy_id ? tenantEmailMap[d.tenancy_id] : undefined;
                  return (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                        <Clock className="w-3 h-3" /> {isOverdue ? t('ldoc.overdueDays', { n: daysPending }) : t('status.pending')}
                      </span>
                      {tenantEmail && (
                        <button
                          onClick={() => { signatureRequestedEmail(tenantEmail, d.title, d.tenancy_id ? tenantLangMap[d.tenancy_id] ?? 'en' : 'en'); toast.show(t('toast.reminderSent'), 'success'); }}
                          className="text-xs text-gray-400 hover:text-gray-700 underline"
                        >
                          {t('ldoc.resend')}
                        </button>
                      )}
                    </div>
                  );
                })()}
                <button
                  onClick={() => download(d)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-800"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
