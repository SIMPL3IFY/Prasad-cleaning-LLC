// SCRUM-184: Shared Resend helpers used by notify-quote-accepted and sync-appointment.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ||
  "Prasad's Cleaning Services <notifications@prasadscleaning.com>" // swap once domain is verified

export const BUSINESS_TIMEZONE = "America/Los_Angeles"

export type EmailResult = { sent: boolean; skipped?: boolean; error?: string }

// SCRUM-184: Never throws, so an email failure can't undo a saved appointment.
export async function sendEmail(
  { to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string },
): Promise<EmailResult> {
  if (!to) return { sent: false, skipped: true, error: "no recipient" }
  if (!RESEND_API_KEY) {
    console.warn("SCRUM-184: RESEND_API_KEY not set, skipping email to", to)
    return { sent: false, skipped: true, error: "RESEND_API_KEY not set" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("SCRUM-184: Resend send failed", res.status, text)
      return { sent: false, error: `Resend ${res.status}: ${text}` }
    }
    return { sent: true }
  } catch (err) {
    console.error("SCRUM-184: Resend request crashed", err)
    return { sent: false, error: String(err) }
  }
}

// SCRUM-184: Customer-entered text goes into HTML emails, so escape it first.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// SCRUM-184: "2026-10-14" + "09:30" -> "Wednesday, October 14, 2026 at 9:30 AM (Pacific)".
// Falls back to the raw values for old free-text rows.
export function formatPacific(date?: string | null, time?: string | null): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "")
  const t = /^(\d{1,2}):(\d{2})/.exec(time ?? "")
  if (!d || !t) return [date, time].filter(Boolean).join(" ") || "TBD"

  // Noon UTC keeps the calendar date stable when formatting the weekday.
  const day = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], 12))
  const datePart = day.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  })
  const hour = +t[1]
  const timePart = `${hour % 12 || 12}:${t[2]} ${hour < 12 ? "AM" : "PM"}`
  return `${datePart} at ${timePart} (Pacific)`
}

// SCRUM-184: Job summary block for Nigel's emails.
export function jobDetailsHtml(record: Record<string, unknown>): string {
  const rows: [string, unknown][] = [
    ["Customer", record.customer_name],
    ["Email", record.email],
    ["Phone", record.phone],
    ["Service", record.service],
    ["Property", record.property],
    ["Address", record.address],
    ["Appointment", record.appointment_date
      ? formatPacific(record.appointment_date as string, record.appointment_time as string)
      : "Not scheduled yet"],
    ["Message", record.message],
  ]
  return `<table cellpadding="4" style="border-collapse:collapse">${
    rows
      .filter(([, value]) => value)
      .map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${escapeHtml(value)}</td></tr>`)
      .join("")
  }</table>`
}
