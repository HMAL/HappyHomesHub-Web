import { supabase } from './supabase';
import type { ExpenseCategory } from '../types';

// Maps the app's expense categories onto IRS Schedule E (Form 1040) expense lines.
const SCHEDULE_E_LINE: Record<ExpenseCategory, string> = {
  cleaning: 'Cleaning and maintenance',
  landscaping: 'Cleaning and maintenance',
  maintenance: 'Repairs',
  insurance: 'Insurance',
  management_fee: 'Management fees',
  mortgage: 'Mortgage interest',
  taxes: 'Taxes',
  utilities: 'Utilities',
  other: 'Other',
};

const EXPENSE_LINES = Array.from(new Set(Object.values(SCHEDULE_E_LINE)));

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface PropertyRow {
  address: string;
  rents: number;
  byLine: Record<string, number>;
}

/**
 * Builds a Schedule-E-shaped CSV for a landlord and tax year: one row per property
 * with rents received and expenses grouped by Schedule E line, plus a totals row.
 * Income counts rent_payments marked paid in the year; expenses count by expense_date.
 */
export async function buildScheduleECsv(landlordId: string, year: number): Promise<string> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address_line1, city, state')
    .eq('landlord_id', landlordId);

  const props = properties ?? [];
  const rows = new Map<string, PropertyRow>();
  for (const p of props) {
    rows.set(p.id, {
      address: `${p.address_line1}, ${p.city}, ${p.state}`,
      rents: 0,
      byLine: Object.fromEntries(EXPENSE_LINES.map((l) => [l, 0])),
    });
  }

  // Rent income: paid payments in the year, joined to their property.
  const propIds = props.map((p) => p.id);
  if (propIds.length) {
    const { data: tenancies } = await supabase
      .from('tenancies').select('id, property_id').in('property_id', propIds);
    const tenancyToProp = new Map((tenancies ?? []).map((t) => [t.id, t.property_id]));

    const tenancyIds = (tenancies ?? []).map((t) => t.id);
    if (tenancyIds.length) {
      const { data: payments } = await supabase
        .from('rent_payments')
        .select('amount, tenancy_id, paid_at, status')
        .in('tenancy_id', tenancyIds)
        .eq('status', 'paid')
        .gte('paid_at', start).lte('paid_at', `${end}T23:59:59`);
      for (const pay of payments ?? []) {
        const propId = tenancyToProp.get(pay.tenancy_id);
        const row = propId && rows.get(propId);
        if (row) row.rents += Number(pay.amount) || 0;
      }
    }

    // Expenses by category in the year.
    const { data: expenses } = await supabase
      .from('expenses')
      .select('property_id, category, amount, expense_date')
      .in('property_id', propIds)
      .gte('expense_date', start).lte('expense_date', end);
    for (const ex of expenses ?? []) {
      const row = rows.get(ex.property_id);
      if (!row) continue;
      const line = SCHEDULE_E_LINE[ex.category as ExpenseCategory] ?? 'Other';
      row.byLine[line] += Number(ex.amount) || 0;
    }
  }

  // Assemble CSV.
  const header = ['Property', 'Rents received', ...EXPENSE_LINES, 'Total expenses', 'Net income'];
  const lines: string[] = [
    `HappyHomesHub — Schedule E summary — ${year}`,
    header.map(csvCell).join(','),
  ];

  const totals = { rents: 0, byLine: Object.fromEntries(EXPENSE_LINES.map((l) => [l, 0])), exp: 0, net: 0 };
  for (const row of rows.values()) {
    const totalExp = EXPENSE_LINES.reduce((s, l) => s + row.byLine[l], 0);
    const net = row.rents - totalExp;
    totals.rents += row.rents;
    EXPENSE_LINES.forEach((l) => { totals.byLine[l] += row.byLine[l]; });
    totals.exp += totalExp;
    totals.net += net;
    lines.push([
      csvCell(row.address),
      row.rents.toFixed(2),
      ...EXPENSE_LINES.map((l) => row.byLine[l].toFixed(2)),
      totalExp.toFixed(2),
      net.toFixed(2),
    ].join(','));
  }

  lines.push([
    'TOTAL',
    totals.rents.toFixed(2),
    ...EXPENSE_LINES.map((l) => totals.byLine[l].toFixed(2)),
    totals.exp.toFixed(2),
    totals.net.toFixed(2),
  ].join(','));

  return lines.join('\n');
}

/** Triggers a browser download of the given CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
