// SCRUM-151: Sends a client confirmation email via Resend when a quote is accepted.
// Triggered by a Supabase Database Webhook on accepted_quotes INSERT.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = "Prasad's Cleaning Services <onboarding@resend.dev>" // swap once domain is verified

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record // Supabase sends { type, table, record, schema, old_record }

    if (!record?.email) {
      console.error('SCRUM-151: accepted_quotes row missing email, skipping', record)
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    const html = `
      <h2>Your quote has been accepted!</h2>
      <p>Hi ${record.customer_name || 'there'},</p>
      <p>We're confirming your <strong>${record.service}</strong> service at ${record.property}.</p>
      ${record.appointment_date ? `<p><strong>Scheduled:</strong> ${record.appointment_date} ${record.appointment_time || ''}</p>` : ''}
      <p>If anything looks off, just reply to this email.</p>
      <p>— Prasad's Cleaning Services</p>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: record.email,
        subject: 'Your cleaning service quote has been accepted',
        html
      })
    })

    if (!res.ok) {
      // SCRUM-151: log the failure, don't roll anything back — the accept already happened.
      console.error('SCRUM-151: Resend send failed', res.status, await res.text())
      return new Response(JSON.stringify({ sent: false }), { status: 200 })
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200 })
  } catch (err) {
    console.error('SCRUM-151: notify-quote-accepted crashed', err)
    return new Response(JSON.stringify({ sent: false, error: String(err) }), { status: 200 })
  }
})