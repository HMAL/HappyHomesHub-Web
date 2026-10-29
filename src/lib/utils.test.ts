import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  formatMonth,
  timeAgo,
  formatPhone,
  isValidPhone,
  initials,
  getGreeting,
  startOfMonth,
  endOfMonth,
  monthKey,
  prevMonth,
  nextMonth,
} from './utils';

describe('cn', () => {
  it('joins string classes', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('skips falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('includes object keys where value is true', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('mixes strings and objects', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('returns empty string for all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats whole dollars', () => {
    expect(formatCurrency(1400)).toBe('$1,400.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats cents', () => {
    expect(formatCurrency(9.99)).toBe('$9.99');
  });

  it('formats large amounts', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });
});

describe('formatDate', () => {
  it('formats a valid date string', () => {
    expect(formatDate('2026-01-15')).toMatch(/Jan\s+15,\s+2026/);
  });

  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('formatMonth', () => {
  it('formats month and year', () => {
    expect(formatMonth('2026-06-01')).toMatch(/June\s+2026/);
  });
});

describe('timeAgo', () => {
  let now: number;

  beforeEach(() => {
    now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Today for same day', () => {
    const d = new Date(now - 1000 * 60 * 60).toISOString();
    expect(timeAgo(d)).toBe('Today');
  });

  it('returns Yesterday for 1 day ago', () => {
    const d = new Date(now - 86400000).toISOString();
    expect(timeAgo(d)).toBe('Yesterday');
  });

  it('returns Nd ago for 3 days ago', () => {
    const d = new Date(now - 3 * 86400000).toISOString();
    expect(timeAgo(d)).toBe('3d ago');
  });

  it('returns Nw ago for 2 weeks ago', () => {
    const d = new Date(now - 14 * 86400000).toISOString();
    expect(timeAgo(d)).toBe('2w ago');
  });

  it('returns Nmo ago for 2 months ago', () => {
    const d = new Date(now - 60 * 86400000).toISOString();
    expect(timeAgo(d)).toBe('2mo ago');
  });
});

describe('formatPhone', () => {
  it('formats 10 digits', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567');
  });

  it('strips non-digit characters before formatting', () => {
    expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567');
  });

  it('handles partial input — 3 digits', () => {
    expect(formatPhone('555')).toBe('555');
  });

  it('handles partial input — 6 digits', () => {
    expect(formatPhone('555123')).toBe('(555) 123');
  });

  it('truncates beyond 10 digits', () => {
    expect(formatPhone('55512345678')).toBe('(555) 123-4567');
  });
});

describe('isValidPhone', () => {
  it('returns true for 10-digit number', () => {
    expect(isValidPhone('5551234567')).toBe(true);
  });

  it('returns true for formatted 10-digit number', () => {
    expect(isValidPhone('(555) 123-4567')).toBe(true);
  });

  it('returns false for 9 digits', () => {
    expect(isValidPhone('555123456')).toBe(false);
  });

  it('returns false for 11 digits', () => {
    expect(isValidPhone('55512345678')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });

  it('returns false for letters', () => {
    expect(isValidPhone('abcdefghij')).toBe(false);
  });
});

describe('initials', () => {
  it('extracts two initials from full name', () => {
    expect(initials('John Smith')).toBe('JS');
  });

  it('extracts one initial from single name', () => {
    expect(initials('John')).toBe('J');
  });

  it('uppercases initials', () => {
    expect(initials('john smith')).toBe('JS');
  });

  it('returns ? for null', () => {
    expect(initials(null)).toBe('?');
  });

  it('returns ? for undefined', () => {
    expect(initials(undefined)).toBe('?');
  });

  it('returns ? for empty string', () => {
    expect(initials('')).toBe('?');
  });

  it('handles extra whitespace', () => {
    expect(initials('  Jane   Doe  ')).toBe('JD');
  });

  it('caps at 2 initials for three-part names', () => {
    expect(initials('Mary Jane Watson')).toBe('MJ');
  });
});

describe('getGreeting', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Good morning before noon', () => {
    vi.setSystemTime(new Date('2026-01-01T09:00:00'));
    expect(getGreeting()).toBe('Good morning');
  });

  it('returns Good afternoon from noon to 5pm', () => {
    vi.setSystemTime(new Date('2026-01-01T14:00:00'));
    expect(getGreeting()).toBe('Good afternoon');
  });

  it('returns Good evening from 5pm onward', () => {
    vi.setSystemTime(new Date('2026-01-01T19:00:00'));
    expect(getGreeting()).toBe('Good evening');
  });
});

describe('startOfMonth', () => {
  it('returns first day of current month at midnight', () => {
    const result = startOfMonth(new Date('2026-06-15'));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(1);
  });
});

describe('endOfMonth', () => {
  it('returns last day of current month at end of day', () => {
    const result = endOfMonth(new Date('2026-06-15'));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(30);
    expect(result.getSeconds()).toBe(59);
  });
});

describe('monthKey', () => {
  it('returns YYYY-MM format', () => {
    expect(monthKey(new Date('2026-06-15'))).toBe('2026-06');
  });

  it('zero-pads single-digit months', () => {
    expect(monthKey(new Date(2026, 0, 1))).toBe('2026-01');
  });
});

describe('prevMonth', () => {
  it('returns first of previous month', () => {
    const result = prevMonth(new Date('2026-06-15'));
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(1);
  });

  it('wraps from January to December of prior year', () => {
    const result = prevMonth(new Date('2026-01-15'));
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
  });
});

describe('nextMonth', () => {
  it('returns first of next month', () => {
    const result = nextMonth(new Date('2026-06-15'));
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(1);
  });

  it('wraps from December to January of next year', () => {
    const result = nextMonth(new Date('2026-12-15'));
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
  });
});
