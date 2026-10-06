// SCRUM-151: Sends a client confirmation email via Resend when a quote is accepted.
// Triggered by a Supabase Database Webhook on accepted_quotes INSERT.
// SCRUM-184: The time is confirmed later by sync-appointment, so this email says "time coming soon",
// and Nigel now gets a "New job accepted" email too.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { escapeHtml, jobDetailsHtml, sendEmail } from "../_shared/email.ts"

const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("NIGEL_EMAIL") || ""

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record // Supabase sends { type, table, record, schema, old_record }

    if (!record?.email) {
      console.error('SCRUM-151: accepted_quotes row missing email, skipping', record)
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    const clientEmail = await sendEmail({
      to: record.email,
      replyTo: ADMIN_NOTIFY_EMAIL || undefined,
      subject: 'Your cleaning service quote has been accepted',
      html: `
        <h2>Your quote has been accepted!</h2>
        <p>Hi ${escapeHtml(record.customer_name || 'there')},</p>
        <p>We're confirming your <strong>${escapeHtml(record.service)}</strong> service at ${escapeHtml(record.property)}.</p>
        <p>We'll email you shortly to confirm your appointment date and time.</p>
        <p>If anything looks off, just reply to this email.</p>
        <p>— Prasad's Cleaning Services</p>
      `
    })

    const adminEmail = await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      replyTo: record.email,
      subject: `New job accepted: ${record.customer_name || record.email}`,
      html: `
        <h2>New job accepted</h2>
        <p>Set the appointment time in the Admin Dashboard to book it on Calendly.</p>
        ${jobDetailsHtml(record)}
      `
    })

    // SCRUM-151: Always 200 — the accept already happened, failures are only logged.
    return new Response(JSON.stringify({ clientEmail, adminEmail }), { status: 200 })
  } catch (err) {
    console.error('SCRUM-151: notify-quote-accepted crashed', err)
    return new Response(JSON.stringify({ sent: false, error: String(err) }), { status: 200 })
  }
})
