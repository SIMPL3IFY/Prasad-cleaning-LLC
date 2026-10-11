// SCRUM-151: Sends a client confirmation email via Resend when a quote is accepted.
// Triggered by a Supabase Database Webhook on accepted_quotes INSERT.
// SCRUM-184: The time is confirmed later by sync-appointment, so this email says "time coming soon",
// and Nigel now gets a "New job accepted" email too.
// SCRUM-144: If the quote already has a date/time, show it plus an "Add to Google Calendar" button.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { BUSINESS_TIMEZONE, escapeHtml, formatPacific, jobDetailsHtml, sendEmail } from "../_shared/email.ts"

const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("NIGEL_EMAIL") || ""

// SCRUM-144: No end time is stored, so assume a 2-hour appointment
const APPOINTMENT_HOURS = 2

// SCRUM-144: Builds Google's public pre-filled event link (no API key/OAuth needed, AC #4).
// Returns null when date or time is missing, so the button is left out (AC #3).
function buildGoogleCalendarUrl(record: Record<string, unknown>): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(record.appointment_date ?? ""))
  const t = /^(\d{1,2}):(\d{2})/.exec(String(record.appointment_time ?? ""))
  if (!d || !t) return null

  // Treated as local Pacific time; Google applies the timezone through ctz
  const start = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]))
  const end = new Date(start.getTime() + APPOINTMENT_HOURS * 60 * 60 * 1000)
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, "").slice(0, 15) // YYYYMMDDTHHMMSS

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${record.service || "Cleaning"} - Prasad's Cleaning Services`,
    details: "Your cleaning appointment with Prasad's Cleaning Services.",
    location: String(record.address || record.property || ""),
    ctz: BUSINESS_TIMEZONE,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}&dates=${fmt(start)}/${fmt(end)}`
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record // Supabase sends { type, table, record, schema, old_record }

    if (!record?.email) {
      console.error('SCRUM-151: accepted_quotes row missing email, skipping', record)
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    // SCRUM-144: Scheduled → show the time + calendar button. Not scheduled → keep "time coming soon".
    const calendarUrl = buildGoogleCalendarUrl(record)
    const scheduleHtml = calendarUrl
      ? `
        <p><strong>Scheduled:</strong> ${escapeHtml(formatPacific(record.appointment_date, record.appointment_time))}</p>
        <p><a href="${escapeHtml(calendarUrl)}" style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Add to Google Calendar</a></p>
      `
      : `<p>We'll email you shortly to confirm your appointment date and time.</p>`

    const clientEmail = await sendEmail({
      to: record.email,
      replyTo: ADMIN_NOTIFY_EMAIL || undefined,
      subject: 'Your cleaning service quote has been accepted',
      html: `
        <h2>Your quote has been accepted!</h2>
        <p>Hi ${escapeHtml(record.customer_name || 'there')},</p>
        <p>We're confirming your <strong>${escapeHtml(record.service)}</strong> service at ${escapeHtml(record.property)}.</p>
        ${scheduleHtml}
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
        <p>Set the appointment time in the Admin Dashboard.</p>
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