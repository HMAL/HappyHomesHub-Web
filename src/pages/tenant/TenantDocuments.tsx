import { useEffect, useRef, useState } from 'react';
import { FileText, Download, PenLine, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Document as Doc, DocumentType, SignatureStatus } from '../../types';
import { formatDateTime } from '../../lib/utils';
import Badge from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';
import EmptyState from '../../components/shared/EmptyState';
import SignaturePad, { SignaturePadHandle } from '../../components/shared/SignaturePad';
import { signatureSignedEmail, type Lang } from '../../lib/notify';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

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
  requested: 'doc.awaitingSignature',
  signed: 'doc.signed',
  declined: 'doc.declined',
};

export default function TenantDocuments() {
  const { supabaseUser, profile } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingDoc, setSigningDoc] = useState<Doc | null>(null);
  const [signerName, setSignerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('id, property_id')
        .eq('tenant_id', supabaseUser!.id)
        .in('status', ['active', 'pending_invite'])
        .limit(1)
        .single();

      if (!tenancy) return;

      const t = tenancy as { id: string; property_id: string };
      const { data, error: fetchErr } = await supabase
        .from('documents')
        .select('*')
        .or(`tenancy_id.eq.${t.id},property_id.eq.${t.property_id}`)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setDocs((data as Doc[]) ?? []);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? 'Failed to load documents';
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function download(doc: Doc) {
    setDownloadingId(doc.id);
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60);
    setDownloadingId(null);
    if (error || !data?.signedUrl) { toast.show(t('toast.couldNotOpenDoc'), 'error'); return; }
    window.open(data.signedUrl, '_blank');
  }

  function openSignModal(doc: Doc) {
    setSigningDoc(doc);
    setSignerName(profile?.full_name ?? '');
  }

  function closeSignModal() {
    setSigningDoc(null);
    setSignerName('');
    padRef.current?.clear();
  }

  function submitSignature() {
    if (!signingDoc) return;
    if (!signerName.trim()) { toast.show(t('toast.confirmName'), 'warning'); return; }
    if (padRef.current?.isEmpty()) { toast.show(t('toast.drawSignature'), 'warning'); return; }

    setSubmitting(true);
    const storagePath = `${supabaseUser!.id}/sig_${signingDoc.id}.png`;

    padRef.current!.toBlob(async (blob) => {
      if (!blob) { toast.show(t('toast.captureSignatureFailed'), 'error'); setSubmitting(false); return; }

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, blob, { contentType: 'image/png', upsert: true });

      if (uploadErr) { toast.show(uploadErr.message, 'error'); setSubmitting(false); return; }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('documents')
        .update({
          signature_status: 'signed',
          signed_at: now,
          signed_by: supabaseUser!.id,
          signature_image_path: storagePath,
          signer_name_confirmed: signerName.trim(),
          updated_by: supabaseUser!.id,
        })
        .eq('id', signingDoc.id);

      if (updateErr) { toast.show(updateErr.message, 'error'); setSubmitting(false); return; }

      // Fire-and-forget: notify landlord
      supabase
        .from('users')
        .select('email, language')
        .eq('id', signingDoc.uploaded_by)
        .single()
        .then(({ data: landlordUser }) => {
          if (landlordUser?.email) {
            const ll: Lang = landlordUser.language === 'es' ? 'es' : 'en';
            signatureSignedEmail(landlordUser.email, signerName.trim(), signingDoc.title, ll);
          }
        });

      const docId = signingDoc.id;
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, signature_status: 'signed' as SignatureStatus, signed_at: now }
            : d,
        ),
      );

      toast.show(t('toast.documentSigned'), 'success');
      closeSignModal();
      setSubmitting(false);
      load();
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('sidebar.documents')}</h1>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title={t('doc.none')} description={t('doc.noneDesc')} />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-100 flex items-start gap-4">
              <FileText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{d.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge label={d.type.replace(/_/g, ' ')} variant={typeVariant[d.type]} />
                  {d.signature_status !== 'none' && (
                    <Badge label={t(sigLabelKey[d.signature_status])} variant={sigVariant[d.signature_status]} />
                  )}
                  <span className="text-xs text-gray-400">{formatDateTime(d.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.signature_status === 'requested' && (
                  <button
                    onClick={() => openSignModal(d)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition"
                    style={{ background: ACCENT, color: PRIMARY }}
                  >
                    <PenLine className="w-3 h-3" /> {t('doc.sign')}
                  </button>
                )}
                {d.signature_status === 'signed' && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                )}
                <button
                  onClick={() => download(d)}
                  disabled={downloadingId === d.id}
                  className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-800 disabled:opacity-50"
                  title={t('doc.download')}
                >
                  {downloadingId === d.id
                    ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    : <Download className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signature modal */}
      {signingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeSignModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-gray-900">{t('doc.signDocument')}</h2>
              <button onClick={closeSignModal} className="p-1 rounded-lg hover:bg-gray-100 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Document info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800">{signingDoc.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{signingDoc.type.replace(/_/g, ' ')}</p>
              <button
                onClick={() => download(signingDoc)}
                className="mt-2 text-xs flex items-center gap-1 hover:underline"
                style={{ color: ACCENT }}
              >
                <Download className="w-3 h-3" /> {t('doc.downloadReview')}
              </button>
            </div>

            {/* Name confirmation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('doc.confirmName')}
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={t('doc.namePlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
              />
            </div>

            {/* Canvas signature pad */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">{t('doc.drawSignature')}</label>
                <button
                  onClick={() => padRef.current?.clear()}
                  className="text-xs text-gray-400 hover:text-gray-700 transition"
                >
                  {t('common.clear')}
                </button>
              </div>
              <SignaturePad ref={padRef} penColor={PRIMARY} />
              <p className="text-xs text-gray-400 mt-1.5">
                {t('doc.drawHint')}
              </p>
            </div>

            {/* Legal notice */}
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-3 leading-relaxed">
              {t('doc.esignNotice')}
            </p>

            {/* Submit */}
            <button
              onClick={submitSignature}
              disabled={submitting}
              className="w-full py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: PRIMARY, color: '#fff' }}
            >
              {submitting
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <PenLine className="w-4 h-4" />}
              {submitting ? t('doc.savingSignature') : t('doc.signDocument')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
