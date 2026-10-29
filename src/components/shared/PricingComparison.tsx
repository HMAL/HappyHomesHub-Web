import { Check, Minus } from 'lucide-react';
import CTALink from '../ui/CTALink';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

// value: true = included, false = not included, string = a specific value (shown verbatim).
type Cell = boolean | string;
interface Row { labelKey: string; landlord: Cell; super: Cell; }

// For string cells, store a translation key resolved at render.
const KEPT_1MO = 'cmp.pcKept1mo';
const KEPT_LEASE = 'cmp.pcKeptLease';

const ROWS: Row[] = [
  { labelKey: 'cmp.pc_rent', landlord: true, super: true },
  { labelKey: 'cmp.pc_latefee', landlord: true, super: true },
  { labelKey: 'cmp.pc_invites', landlord: true, super: true },
  { labelKey: 'cmp.pc_maintenance', landlord: true, super: true },
  { labelKey: 'cmp.pc_inspections', landlord: true, super: true },
  { labelKey: 'cmp.pc_messaging', landlord: true, super: true },
  { labelKey: 'cmp.pc_lease', landlord: true, super: true },
  { labelKey: 'cmp.pc_marketplace', landlord: true, super: true },
  { labelKey: 'cmp.pc_notifications', landlord: true, super: true },
  { labelKey: 'cmp.pc_pwa', landlord: true, super: true },
  { labelKey: 'cmp.pc_photos', landlord: KEPT_1MO, super: KEPT_LEASE },
  { labelKey: 'cmp.pc_expenses', landlord: false, super: true },
  { labelKey: 'cmp.pc_payouts', landlord: false, super: true },
  { labelKey: 'cmp.pc_sms', landlord: false, super: true },
  { labelKey: 'cmp.pc_analytics', landlord: false, super: true },
  { labelKey: 'cmp.pc_ach', landlord: false, super: true },
  { labelKey: 'cmp.pc_support', landlord: false, super: true },
];

function CellView({ value, accent }: { value: Cell; accent?: boolean }) {
  const { t } = useT();
  if (value === true) return <Check className="w-4 h-4 mx-auto" style={{ color: accent ? ACCENT : '#16a34a' }} />;
  if (value === false) return <Minus className="w-4 h-4 mx-auto text-gray-300" />;
  return <span className="text-xs font-medium text-gray-700">{t(value)}</span>;
}

export default function PricingComparison() {
  const { t } = useT();
  return (
    <div className="max-w-3xl mx-auto">
      {/* Tier headers */}
      <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-px rounded-t-2xl overflow-hidden border border-gray-200 bg-gray-200">
        <div className="bg-white p-4" />
        <div className="bg-white p-4 text-center">
          <p className="font-display font-bold text-gray-900">{t('lacct.tier_landlord')}</p>
          <p className="text-2xl font-bold text-gray-900">$7<span className="text-xs font-normal text-gray-400">{t('cmp.perPropMo')}</span></p>
        </div>
        <div className="p-4 text-center text-white relative" style={{ background: PRIMARY }}>
          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: ACCENT, color: PRIMARY }}>
            {t('lacct.mostPopular')}
          </span>
          <p className="font-display font-bold" style={{ color: ACCENT }}>{t('lacct.tier_super')}</p>
          <p className="text-2xl font-bold">$10<span className="text-xs font-normal text-white/50">{t('cmp.perPropMo')}</span></p>
        </div>
      </div>

      {/* Rows */}
      <div className="border-x border-gray-200">
        {ROWS.map((r, i) => (
          <div key={r.labelKey} className={`grid grid-cols-[1.6fr_1fr_1fr] items-center ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
            <div className="p-3 text-sm text-gray-700">{t(r.labelKey)}</div>
            <div className="p-3 text-center"><CellView value={r.landlord} /></div>
            <div className="p-3 text-center" style={{ background: '#FBF6EC' }}><CellView value={r.super} accent /></div>
          </div>
        ))}
      </div>

      {/* Launch coupon row */}
      <div className="grid grid-cols-[1.6fr_1fr_1fr] items-center border-x border-b border-gray-200 rounded-b-2xl overflow-hidden">
        <div className="p-3 text-sm font-semibold text-gray-900">
          {t('cmp.withCodePre')} <span className="font-mono">HAPPYHOMEOWNER</span> {t('cmp.withCodePost')}
        </div>
        <div className="p-3 text-center text-sm font-bold text-green-600">{t('lacct.free')}</div>
        <div className="p-3 text-center text-sm font-bold" style={{ background: '#FBF6EC', color: PRIMARY }}>{t('cmp.just3mo')}</div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        {t('cmp.pcFootPre')} <strong>{t('cmp.pcFootBold')}</strong> {t('cmp.pcFootPost')}
      </p>

      <div className="text-center mt-6">
        <CTALink to="/signup?role=landlord" variant="gold">
          {t('common.startFree')}
        </CTALink>
      </div>
    </div>
  );
}
