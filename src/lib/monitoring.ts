import * as Sentry from '@sentry/react';
import { supabase } from './supabase';

export type ErrorSource = 'react_boundary' | 'window_onerror' | 'unhandled_rejection' | 'manual';

// Keys whose values must never leave the browser in an error report.
const PII_KEYS = [
  'ssn', 'ssn_last_four', 'date_of_birth', 'dob', 'monthly_income',
  'password', 'token', 'p_token', 'invite_token', 'access_token', 'refresh_token',
];

// Query params whose values must be removed before a URL is logged.
const SENSITIVE_PARAMS = ['token', 'invite_token', 'ref', 'code', 'access_token', 'refresh_token', 'type'];

// Strips secret-bearing query params (invite/recovery tokens, referral codes) from
// a URL so they never land in Sentry or the error_log.
function scrubUrl(raw: string | null): string | null {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    for (const k of SENSITIVE_PARAMS) if (u.searchParams.has(k)) u.searchParams.set(k, '[redacted]');
    // Recovery/magic-link tokens often arrive in the URL hash fragment.
    if (u.hash && /access_token|refresh_token|token=/.test(u.hash)) u.hash = '#[redacted]';
    return u.toString();
  } catch {
    return raw;
  }
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.includes(k.toLowerCase()) ? '[redacted]' : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

// Suppress duplicate floods (e.g. a render error firing every re-render) by
// skipping an identical message+source seen within the last few seconds.
const recentErrors = new Map<string, number>();
const DEDUPE_MS = 5000;

/**
 * Records a frontend error to the error_log table (best-effort) and to Sentry.
 * Errors users never report still surface here for the team to triage. PII is
 * scrubbed from the extra context before it leaves the browser.
 */
export function logError(error: unknown, source: ErrorSource, extra?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));

  const key = `${source}:${err.message}`;
  const now = Date.now();
  const last = recentErrors.get(key);
  if (last && now - last < DEDUPE_MS) return;
  recentErrors.set(key, now);
  if (recentErrors.size > 100) recentErrors.clear();

  Sentry.captureException(err, extra ? { extra: scrub(extra) as Record<string, unknown> } : undefined);

  // Fire-and-forget DB insert; never let logging throw into the app.
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      // RLS only accepts inserts from signed-in users (migration 052).
      // Anonymous visitors' errors are already captured by Sentry above.
      if (!data.session?.user) return;
      await supabase.from('error_log').insert({
        user_id: data.session.user.id,
        error_message: err.message.slice(0, 2000),
        error_stack: err.stack?.slice(0, 8000) ?? null,
        error_source: source,
        url: typeof location !== 'undefined' ? scrubUrl(location.href) : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        context: extra ? scrub(extra) : null,
      });
    } catch {
      // swallow — logging must never break the app
    }
  })();
}

/**
 * Initializes error tracking. No-op unless VITE_SENTRY_DSN is set, so local and
 * preview builds stay quiet. PII (SSN, DOB, income, tokens) is stripped before send.
 */
export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Don't capture request bodies / cookies; we send only scrubbed contexts.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url) ?? event.request.url;
      if (event.request?.data) event.request.data = scrub(event.request.data);
      if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      return event;
    },
  });
}
