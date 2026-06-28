// Shared email-sending wrapper. Wraps Resend with safe fallbacks so the
// rest of the app can call `sendEmail(...)` without caring whether
// RESEND_API_KEY is configured (dev / preview environments) — silent
// no-op in that case, structured warn logged.

import { Resend } from 'resend'

let _resend: Resend | null = null
let _resendChecked = false

function getResend(): Resend | null {
  if (_resendChecked) return _resend
  _resendChecked = true
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — emails will not be sent')
    return null
  }
  _resend = new Resend(key)
  return _resend
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  // Optional reply-to so invite recipients can hit reply to talk to the inviter.
  replyTo?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const r = getResend()
  if (!r) return { ok: false, error: 'email-disabled' }
  const from = process.env.EMAIL_FROM || 'NeuroCanvas <noreply@neuro-canvas.com>'
  try {
    const res = await r.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    })
    if ('error' in res && res.error) {
      console.error('[email] send failed', {
        to: input.to,
        name: (res.error as { name?: string }).name,
      })
      return { ok: false, error: 'send-failed' }
    }
    return { ok: true, id: (res as { data?: { id?: string } }).data?.id }
  } catch (e) {
    console.error('[email] send threw', {
      to: input.to,
      name: (e as Error)?.name,
    })
    return { ok: false, error: 'send-threw' }
  }
}

// ─── Templates ──────────────────────────────────────────────────────

const ROLE_VERB: Record<string, string> = {
  VIEWER: 'view',
  COMMENTER: 'comment on',
  EDITOR: 'collaborate on',
}

const ROLE_NOUN: Record<string, string> = {
  VIEWER: 'View access',
  COMMENTER: 'Comment access',
  EDITOR: 'Edit access',
}

export interface InviteEmailInput {
  mapTitle: string
  inviterName: string
  role: 'VIEWER' | 'COMMENTER' | 'EDITOR'
  shareUrl: string
  personalNote?: string
}

export function buildInviteEmail(input: InviteEmailInput): { subject: string; html: string } {
  const safeUrl = escapeHtml(input.shareUrl)
  const safeTitle = escapeHtml(input.mapTitle || 'a NeuroCanvas map')
  const safeInviter = escapeHtml(input.inviterName || 'Someone')
  const verb = ROLE_VERB[input.role] || 'view'
  const roleNoun = ROLE_NOUN[input.role] || 'Access'
  const noteBlock = input.personalNote
    ? `<div style="background:#1A1A1E;border-left:3px solid #00D2BE;border-radius:6px;padding:14px 18px;margin:20px 0;color:#E8E8EC;font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(input.personalNote)}</div>`
    : ''

  // Logo: a hosted PNG referenced by absolute URL (Gmail and most clients
  // strip inline SVG / base64, so the public icon is the reliable option).
  // Derive the origin from the share URL — which is already built from
  // AUTH_ORIGIN server-side — so the logo points at the right environment.
  // Falls back to the brand-colour block when no valid origin is available
  // (dev / preview), preserving the previous look.
  let logoUrl = ''
  try { logoUrl = new URL(input.shareUrl).origin + '/icon-512.png' } catch { /* keep fallback */ }
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="NeuroCanvas" style="display:inline-block;width:48px;height:48px;border-radius:12px;margin-bottom:16px;border:0;outline:none;text-decoration:none;">`
    : `<div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#00D2BE,#00A89A);border-radius:12px;margin-bottom:16px;"></div>`

  const subject = `${input.inviterName} invited you to ${verb} "${input.mapTitle}" on NeuroCanvas`
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="background-color:#0A0A0C;color:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:32px;">
      ${logoBlock}
      <h1 style="font-size:24px;font-weight:700;margin:0;">NeuroCanvas</h1>
    </div>
    <div style="background:#121216;border:1px solid #252529;border-radius:16px;padding:32px;">
      <h2 style="font-size:20px;font-weight:600;margin:0 0 12px;">You're invited to ${verb} "${safeTitle}"</h2>
      <p style="color:#A1A1AA;line-height:1.6;margin:0 0 4px;font-size:14px;"><strong style="color:#FAFAFA;">${safeInviter}</strong> shared a NeuroCanvas mind map with you.</p>
      <p style="color:#71717A;line-height:1.6;margin:0 0 20px;font-size:13px;">${roleNoun} · Link expires per the inviter's settings.</p>
      ${noteBlock}
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#00D2BE,#00A89A);color:#0A0A0C;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:10px;">Open the map</a>
      <p style="color:#71717A;font-size:13px;margin:24px 0 0;line-height:1.5;">If the button doesn't work, paste this link into your browser:<br><span style="color:#A1A1AA;word-break:break-all;">${safeUrl}</span></p>
    </div>
    <p style="color:#52525B;font-size:12px;text-align:center;margin-top:24px;">If you didn't expect this invitation, you can safely ignore it.<br>&copy; ${new Date().getFullYear()} NeuroCanvas</p>
  </div>
</body>
</html>`
  return { subject, html }
}
