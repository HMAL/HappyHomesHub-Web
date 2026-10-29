// ─────────────────────────────────────────────────────────────────────────────
// TransUnion resident-screening connector (the integration "seam").
//
// HappyHomesHub charges the applicant up front (Stripe), then needs to actually
// order a screening report from TransUnion and receive the result. TransUnion's
// resident-screening APIs (SmartMove / TruVision Resident Screening / ShareAble
// for Rentals) are PARTNER-GATED: the exact base URL, auth scheme, request bodies
// and result payloads are only published once you have an approved integration
// account. See TRANSUNION_SETUP.md in this folder for what to apply for.
//
// Because we don't have credentials yet, this module is the single place that
// turns "applicant + tier" into "ordered report" and "provider postback" into
// "normalized result". Everything is env-gated: with no credentials configured,
// isConfigured() returns false and the rest of the app falls back to the existing
// manual flow — nothing breaks. When credentials arrive, fill in the two clearly
// marked TODO blocks (request mapping + response mapping) and set the env vars.
// No other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────

export class NotConfiguredError extends Error {
  constructor() {
    super('TransUnion connector is not configured');
    this.name = 'NotConfiguredError';
  }
}

// Required env to go live. All must be present for isConfigured() to be true.
//   TRANSUNION_API_BASE      e.g. https://api.transunion.com/resident-screening/v1
//   TRANSUNION_API_KEY       partner API key / bearer token (or use the OAuth path)
//   TRANSUNION_CALLBACK_URL  public URL of the screening-callback function, which
//                            you register with TransUnion as the result postback
// Optional:
//   TRANSUNION_PRODUCT_BUNDLE  the product/bundle code to order (defaults below)
const API_BASE = Deno.env.get('TRANSUNION_API_BASE') ?? '';
const API_KEY = Deno.env.get('TRANSUNION_API_KEY') ?? '';
const CALLBACK_URL = Deno.env.get('TRANSUNION_CALLBACK_URL') ?? '';
const PRODUCT_BUNDLE = Deno.env.get('TRANSUNION_PRODUCT_BUNDLE') ?? 'smartcheck_plus';

export function isConfigured(): boolean {
  return Boolean(API_BASE && API_KEY && CALLBACK_URL);
}

// What we send TransUnion to start a request. We deliberately do NOT collect SSN
// or full DOB ourselves: in the SmartMove model the applicant completes their own
// PII + identity-verification exam on TransUnion's hosted page, reached via the
// returned invite_url. We only identify and invite them.
export interface ScreeningApplicant {
  reportId: string;        // our screening_reports.id — round-tripped as the external ref
  applicantId: string;     // users.id
  fullName: string;
  email: string;
  // The token the provider must echo back on the callback so we can authenticate
  // the postback for this specific report.
  callbackToken: string;
  tier: 'capped' | 'unlimited';
}

export interface CreateOrderResult {
  // Provider's order/request id — stored in screening_reports.smartmove_order_id
  // and used to match the eventual callback.
  providerRequestId: string;
  // Hosted link the applicant opens to consent + complete identity verification.
  inviteUrl: string | null;
}

export type NormalizedStatus = 'processing' | 'completed' | 'failed';
export type NormalizedRecommendation = 'approved' | 'consider' | 'declined' | null;

export interface NormalizedReport {
  providerRequestId: string;
  status: NormalizedStatus;
  score: number | null;
  recommendation: NormalizedRecommendation;
  reportUrl: string | null;
}

// Small typed wrapper around the partner REST API. Centralizes base URL + auth so
// the two mapping functions below stay focused on field shape.
async function tuFetch(path: string, init: RequestInit): Promise<Response> {
  return await fetch(`${API_BASE.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      // TODO(credentials): confirm the real auth scheme. Many TransUnion partner
      // APIs use OAuth2 client-credentials (exchange id/secret for a bearer) rather
      // than a static key; swap this header for a cached token fetch if so.
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
}

// ── Order a report ───────────────────────────────────────────────────────────
// Called once the applicant's payment succeeds. Returns the provider order id and
// the applicant invite link.
export async function createScreeningOrder(
  applicant: ScreeningApplicant,
): Promise<CreateOrderResult> {
  if (!isConfigured()) throw new NotConfiguredError();

  // TODO(contract): map to TransUnion's real request schema once you have the
  // partner API docs. The fields below are a representative SmartMove-style
  // request; names WILL differ per the published spec. Keep externalReference =
  // applicant.reportId and the callback fields so results can be matched + trusted.
  const [firstName, ...rest] = applicant.fullName.trim().split(/\s+/);
  const lastName = rest.join(' ') || firstName;
  const requestBody = {
    productBundle: PRODUCT_BUNDLE,
    externalReference: applicant.reportId,
    applicant: {
      firstName,
      lastName,
      email: applicant.email,
    },
    // Where TransUnion should POST the result, plus the token it must echo back.
    callback: {
      url: CALLBACK_URL,
      token: applicant.callbackToken,
    },
  };

  const res = await tuFetch('/screening-requests', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TransUnion order failed: ${res.status} ${detail}`);
  }

  // TODO(contract): map the real response. Representative shape shown.
  const data = await res.json().catch(() => ({}));
  const providerRequestId = String(
    data.requestId ?? data.orderId ?? data.id ?? '',
  );
  if (!providerRequestId) {
    throw new Error('TransUnion order succeeded but returned no request id');
  }
  const inviteUrl = data.applicantUrl ?? data.inviteUrl ?? data.exam?.url ?? null;

  return { providerRequestId, inviteUrl: inviteUrl ? String(inviteUrl) : null };
}

// ── Normalize a result postback ──────────────────────────────────────────────
// Called by screening-callback with the raw provider payload. Maps provider-native
// status/score/recommendation onto our enums. Returns null if the payload can't be
// matched to a request id (caller treats that as a bad request).
export function normalizeCallback(payload: unknown): NormalizedReport | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, any>;

  // TODO(contract): map to the real callback schema once documented.
  const providerRequestId = String(
    p.requestId ?? p.orderId ?? p.id ?? '',
  );
  if (!providerRequestId) return null;

  const rawStatus = String(p.status ?? p.state ?? '').toLowerCase();
  const status: NormalizedStatus =
    /complete|ready|done|finished/.test(rawStatus) ? 'completed'
    : /fail|error|declined?_to_process|cancel/.test(rawStatus) ? 'failed'
    : 'processing';

  const rawRec = String(p.recommendation ?? p.decision ?? p.result ?? '').toLowerCase();
  const recommendation: NormalizedRecommendation =
    /approve|accept|pass/.test(rawRec) ? 'approved'
    : /consider|review|caution/.test(rawRec) ? 'consider'
    : /declin|deny|fail|reject/.test(rawRec) ? 'declined'
    : null;

  const scoreRaw = p.score ?? p.residentScore ?? p.creditScore ?? null;
  const score = scoreRaw == null ? null : Number(scoreRaw);

  const reportUrl = p.reportUrl ?? p.documentUrl ?? p.pdfUrl ?? null;

  return {
    providerRequestId,
    status,
    score: Number.isFinite(score as number) ? (score as number) : null,
    recommendation,
    reportUrl: reportUrl ? String(reportUrl) : null,
  };
}
