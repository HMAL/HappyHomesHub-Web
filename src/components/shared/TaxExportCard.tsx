import { useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { buildScheduleECsv, downloadCsv } from '../../lib/taxExport';
import { useT } from '../../lib/i18n';

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

/** One-tap Schedule E export of rent income + categorized expenses for a tax year. */
export default function TaxExportCard({ primary = '#0D1F2D', accent = '#D4972A' }: { primary?: string; accent?: string }) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [year, setYear] = useState(currentYear - 1);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!supabaseUser) return;
    setBusy(true);
    try {
      const csv = await buildScheduleECsv(supabaseUser.id, year);
      downloadCsv(`happyhomeshub-schedule-e-${year}.csv`, csv);
      toast.show(t('toast.taxExported', { year }), 'success');
    } catch {
      toast.show(t('toast.exportFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}22`, color: primary }}>
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{t('cmp.taxTitle')}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('cmp.taxDesc')}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <label htmlFor="tax-year" className="sr-only">{t('cmp.taxYear')}</label>
            <select
              id="tax-year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: primary }}
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={handleExport}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
              style={{ background: primary }}
            >
              {busy
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Download className="w-4 h-4" />}
              {busy ? t('cmp.building') : t('cmp.exportCsv')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
