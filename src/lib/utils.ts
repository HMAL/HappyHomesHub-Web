import { en } from '../locales/en';
import { es } from '../locales/es';

type ClassValue = string | undefined | null | false | Record<string, boolean>;

// Framework-free language state for these pure helpers. The LanguageProvider keeps
// this in sync via setUtilsLang() so dates/greetings localize without threading a
// hook through every call site.
let utilsLang: 'en' | 'es' = 'en';
export function setUtilsLang(l: 'en' | 'es') { utilsLang = l; }
function uLocale(): string { return utilsLang === 'es' ? 'es-ES' : 'en-US'; }
function uw(key: string, vars?: Record<string, string | number>): string {
  const cat = utilsLang === 'es' ? es : en;
  let str = cat[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(String(v));
  return str;
}

export function cn(...classes: ClassValue[]): string {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === 'string') return [c];
      return Object.entries(c)
        .filter(([, v]) => v)
        .map(([k]) => k);
    })
    .join(' ');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function parseDateStr(dateStr: string): Date {
  if (dateStr.includes('T') || dateStr.includes('Z')) return new Date(dateStr);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Maps US state abbreviations to IANA timezone identifiers (predominant zone per state).
const STATE_TIMEZONE: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix',
  AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York', DE: 'America/New_York', FL: 'America/New_York',
  GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Denver',
  IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago',
  ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York',
  MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York',
  NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York',
  ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
  OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago',
  TX: 'America/Chicago', UT: 'America/Denver', VT: 'America/New_York',
  VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
  WI: 'America/Chicago', WY: 'America/Denver', DC: 'America/New_York',
  PR: 'America/Puerto_Rico', VI: 'America/St_Thomas',
};

export function stateToTimezone(state: string | undefined | null): string {
  return (state && STATE_TIMEZONE[state.trim().toUpperCase()]) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  return parseDateStr(dateStr).toLocaleDateString(uLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | undefined | null, timezone?: string): string {
  if (!dateStr) return '—';
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Date(dateStr).toLocaleString(uLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  });
}

export function formatMonth(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString(uLocale(), { month: 'long', year: 'numeric' });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return uw('util.today');
  if (days === 1) return uw('util.yesterday');
  if (days < 7) return uw('util.daysAgo', { n: days });
  if (days < 30) return uw('util.weeksAgo', { n: Math.floor(days / 7) });
  return uw('util.monthsAgo', { n: Math.floor(days / 30) });
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length === 10;
}

// Returns the URL only if it is a safe http(s) link, else '#'. Guards against
// javascript:/data: scheme injection when rendering a link from stored data.
export function safeHttpUrl(url: string | null | undefined): string {
  if (!url) return '#';
  try {
    const u = new URL(url, window.location.origin);
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : '#';
  } catch {
    return '#';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// True only for a canonical UUID. Use before interpolating an id (e.g. a URL
// param) into a PostgREST .or() filter, which is otherwise injectable.
export function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v);
}

export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return uw('util.goodMorning');
  if (h < 17) return uw('util.goodAfternoon');
  return uw('util.goodEvening');
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function prevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function nextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}
