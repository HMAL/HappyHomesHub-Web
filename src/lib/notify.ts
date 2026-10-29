import { supabase } from './supabase';

// Emails are sent in the RECIPIENT's language (their users.language), not the
// sender's UI language. Callers fetch the recipient's language and pass it; it
// defaults to 'en' when unknown.
export type Lang = 'en' | 'es';

function tr(lang: Lang, en: string, es: string): string {
  return lang === 'es' ? es : en;
}

// Escape user-controlled values before embedding them in email HTML — a repair
// title or name could otherwise inject markup/links into the recipient's inbox.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Localized human-readable maintenance status (mirrors status.* in the catalogs).
export function statusLabel(lang: Lang, status: string): string {
  const en: Record<string, string> = {
    open: 'Open', assigned: 'Assigned', in_progress: 'In Progress',
    resolved: 'Resolved', closed: 'Closed',
  };
  const es: Record<string, string> = {
    open: 'Abierta', assigned: 'Asignada', in_progress: 'En progreso',
    resolved: 'Resuelta', closed: 'Cerrada',
  };
  const map = lang === 'es' ? es : en;
  return map[status] ?? status.replace(/_/g, ' ');
}

// Fire-and-forget: calls the send-notification Edge Function.
// Failures are logged but never thrown — callers should not await this for UX.
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await supabase.functions.invoke('send-notification', { body: { to, subject, html } });
  } catch (err) {
    console.warn('sendEmail failed silently:', err);
  }
}

const APP = 'https://app.happyhomeshub.com';

// ── Template helpers ─────────────────────────────────────────────────────────

export function repairSubmittedEmail(landlordEmail: string, tenantName: string, title: string, address: string, lang: Lang = 'en') {
  const t = esc(title), n = esc(tenantName), a = esc(address);
  const subject = tr(lang, `New repair request: ${t}`, `Nueva solicitud de reparación: ${t}`);
  const html = tr(lang,
    `<p>Hi,</p>
<p><strong>${n}</strong> submitted a maintenance request at <strong>${a}</strong>:</p>
<p style="font-size:18px;font-weight:bold;">${t}</p>
<p>Log in to <a href="${APP}/landlord/maintenance">HappyHomesHub</a> to view and assign it.</p>`,
    `<p>Hola,</p>
<p><strong>${n}</strong> envió una solicitud de mantenimiento en <strong>${a}</strong>:</p>
<p style="font-size:18px;font-weight:bold;">${t}</p>
<p>Inicia sesión en <a href="${APP}/landlord/maintenance">HappyHomesHub</a> para verla y asignarla.</p>`,
  );
  return sendEmail(landlordEmail, subject, html);
}

export function repairStatusChangedEmail(tenantEmail: string, title: string, newStatus: string, lang: Lang = 'en') {
  const status = statusLabel(lang, newStatus);
  const t = esc(title);
  const subject = tr(lang, `Repair update: ${t}`, `Actualización de reparación: ${t}`);
  const html = tr(lang,
    `<p>Hi,</p>
<p>Your maintenance request <strong>${t}</strong> has been updated to <strong>${status}</strong>.</p>
<p>Log in to <a href="${APP}/tenant/repairs">HappyHomesHub</a> to track progress.</p>`,
    `<p>Hola,</p>
<p>Tu solicitud de mantenimiento <strong>${t}</strong> se actualizó a <strong>${status}</strong>.</p>
<p>Inicia sesión en <a href="${APP}/tenant/repairs">HappyHomesHub</a> para dar seguimiento.</p>`,
  );
  return sendEmail(tenantEmail, subject, html);
}

// fromRole: the sender's role, used to render a localized "your landlord/tenant/handyman".
export function newMessageEmail(recipientEmail: string, fromRole: 'landlord' | 'tenant' | 'handyman', lang: Lang = 'en') {
  const sender = {
    landlord: tr(lang, 'your landlord', 'tu arrendador'),
    tenant: tr(lang, 'your tenant', 'tu inquilino'),
    handyman: tr(lang, 'your handyman', 'tu técnico'),
  }[fromRole];
  const subject = tr(lang, `New message from ${sender}`, `Nuevo mensaje de ${sender}`);
  const html = tr(lang,
    `<p>Hi,</p>
<p>You have a new message from <strong>${sender}</strong> on HappyHomesHub.</p>
<p><a href="${APP}">Log in to reply →</a></p>`,
    `<p>Hola,</p>
<p>Tienes un nuevo mensaje de <strong>${sender}</strong> en HappyHomesHub.</p>
<p><a href="${APP}">Inicia sesión para responder →</a></p>`,
  );
  return sendEmail(recipientEmail, subject, html);
}

export function rentPaidEmail(landlordEmail: string, tenantName: string, amount: string, address: string, lang: Lang = 'en') {
  const n = esc(tenantName), amt = esc(amount), a = esc(address);
  const subject = tr(lang, `Rent payment received — ${a}`, `Pago de renta recibido — ${a}`);
  const html = tr(lang,
    `<p>Hi,</p>
<p><strong>${n}</strong> paid <strong>${amt}</strong> via card for <strong>${a}</strong>.</p>
<p>The payment has been automatically recorded in <a href="${APP}/landlord/rent">HappyHomesHub</a>.</p>`,
    `<p>Hola,</p>
<p><strong>${n}</strong> pagó <strong>${amt}</strong> con tarjeta por <strong>${a}</strong>.</p>
<p>El pago se registró automáticamente en <a href="${APP}/landlord/rent">HappyHomesHub</a>.</p>`,
  );
  return sendEmail(landlordEmail, subject, html);
}

export function rentOverdueEmail(tenantEmail: string, amount: string, dueDate: string, lang: Lang = 'en') {
  const amt = esc(amount), due = esc(dueDate);
  const subject = tr(lang, 'Rent payment overdue', 'Pago de renta atrasado');
  const html = tr(lang,
    `<p>Hi,</p>
<p>Your rent payment of <strong>${amt}</strong> was due on <strong>${due}</strong> and has not been recorded yet.</p>
<p>Please submit your payment or report it in <a href="${APP}/tenant/rent">HappyHomesHub</a>.</p>`,
    `<p>Hola,</p>
<p>Tu pago de renta de <strong>${amt}</strong> venció el <strong>${due}</strong> y aún no se ha registrado.</p>
<p>Por favor realiza tu pago o repórtalo en <a href="${APP}/tenant/rent">HappyHomesHub</a>.</p>`,
  );
  return sendEmail(tenantEmail, subject, html);
}

export function signatureRequestedEmail(tenantEmail: string, documentTitle: string, lang: Lang = 'en') {
  const d = esc(documentTitle);
  const subject = tr(lang, `Signature required: ${d}`, `Firma requerida: ${d}`);
  const html = tr(lang,
    `<p>Hi,</p>
<p>Your landlord has requested your electronic signature on <strong>${d}</strong>.</p>
<p>Please log in to <a href="${APP}/tenant/documents">HappyHomesHub</a> to review and sign the document.</p>
<p style="font-size:11px;color:#888;">By signing electronically you agree this constitutes a valid signature under the E-SIGN Act.</p>`,
    `<p>Hola,</p>
<p>Tu arrendador ha solicitado tu firma electrónica en <strong>${d}</strong>.</p>
<p>Inicia sesión en <a href="${APP}/tenant/documents">HappyHomesHub</a> para revisar y firmar el documento.</p>
<p style="font-size:11px;color:#888;">Al firmar electrónicamente aceptas que esto constituye una firma válida bajo la Ley E-SIGN.</p>`,
  );
  return sendEmail(tenantEmail, subject, html);
}

export function quoteAcceptedEmail(handymanEmail: string, landlordName: string, jobTitle: string, amount: string, lang: Lang = 'en') {
  const ln = esc(landlordName), j = esc(jobTitle), amt = esc(amount);
  const subject = tr(lang, `Quote accepted: ${j}`, `Cotización aceptada: ${j}`);
  const html = tr(lang,
    `<p>Hi,</p>
<p><strong>${ln}</strong> has accepted your quote of <strong>${amt}</strong> for the job: <strong>${j}</strong>.</p>
<p>You have been assigned to this maintenance request. Log in to <a href="${APP}/handyman/jobs">HappyHomesHub</a> to view the job details.</p>`,
    `<p>Hola,</p>
<p><strong>${ln}</strong> ha aceptado tu cotización de <strong>${amt}</strong> para el trabajo: <strong>${j}</strong>.</p>
<p>Has sido asignado a esta solicitud de mantenimiento. Inicia sesión en <a href="${APP}/handyman/jobs">HappyHomesHub</a> para ver los detalles del trabajo.</p>`,
  );
  return sendEmail(handymanEmail, subject, html);
}

export function signatureSignedEmail(landlordEmail: string, tenantName: string, documentTitle: string, lang: Lang = 'en') {
  const n = esc(tenantName), d = esc(documentTitle);
  const subject = tr(lang, `Document signed: ${d}`, `Documento firmado: ${d}`);
  const html = tr(lang,
    `<p>Hi,</p>
<p><strong>${n}</strong> has electronically signed <strong>${d}</strong>.</p>
<p>The signature timestamp and image have been saved to <a href="${APP}/landlord/documents">HappyHomesHub</a>.</p>`,
    `<p>Hola,</p>
<p><strong>${n}</strong> ha firmado electrónicamente <strong>${d}</strong>.</p>
<p>La marca de tiempo y la imagen de la firma se guardaron en <a href="${APP}/landlord/documents">HappyHomesHub</a>.</p>`,
  );
  return sendEmail(landlordEmail, subject, html);
}
