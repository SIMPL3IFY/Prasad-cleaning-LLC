// SCRUM-184: Shared Resend helpers used by notify-quote-accepted and sync-appointment.
// SCRUM-137: Also builds the .ics calendar invites attached to Nigel's appointment emails.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ||
  "Prasad's Cleaning Services <notifications@prasadscleaning.com>"

export const BUSINESS_TIMEZONE = "America/Los_Angeles"

export type EmailResult = { sent: boolean; skipped?: boolean; error?: string }

// SCRUM-137: Resend attachment; content is base64
export type EmailAttachment = { filename: string; content: string; content_type?: string }

// SCRUM-184: Never throws, so an email failure can't undo a saved appointment.
export async function sendEmail(
  { to, subject, html, replyTo, attachments }: {
    to: string
    subject: string
    html: string
    replyTo?: string
    attachments?: (EmailAttachment | null)[] // SCRUM-137: e.g. the .ics invite; nulls are dropped
  },
): Promise<EmailResult> {
  const files = (attachments ?? []).filter((a): a is EmailAttachment => Boolean(a))
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
        ...(files.length ? { attachments: files } : {}),
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

// SCRUM-137: No end time is stored, so invites assume a 2-hour appointment (same as SCRUM-144's Google link)
const APPOINTMENT_HOURS = 2

// SCRUM-137: How far a timezone is from UTC (ms) at a given instant, e.g. -7h for PDT.
function tzOffsetMs(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - instant
}

// SCRUM-137: "2026-10-14" + "09:30" Pacific -> real UTC instant, or null for old free-text rows.
// Two passes so dates right next to a DST switch use the offset in effect at that moment.
function pacificToUtc(date: unknown, time: unknown): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""))
  const t = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ""))
  if (!d || !t) return null
  const wallClock = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2])
  let utc = wallClock - tzOffsetMs(wallClock, BUSINESS_TIMEZONE)
  utc = wallClock - tzOffsetMs(utc, BUSINESS_TIMEZONE)
  return new Date(utc)
}

// SCRUM-137: UTC date in .ics form, e.g. 20261014T163000Z
const icsDate = (x: Date) => x.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"

// SCRUM-137: Escapes text for an .ics property value (RFC 5545 3.3.11).
function icsText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
}

// SCRUM-137: .ics lines must be folded at 75 characters.
function icsFold(line: string): string {
  if (line.length <= 75) return line
  return [line.slice(0, 75), ...(line.slice(75).match(/.{1,74}/g) ?? [])].join("\r\n ")
}

// SCRUM-137: Bare sender address, used as the invite's organizer.
const FROM_ADDRESS = /<([^>]+)>/.exec(FROM_EMAIL)?.[1] ?? FROM_EMAIL

// SCRUM-137: Builds an .ics invite that works in Google, Outlook and Apple Calendar.
// The UID comes from the appointment id, so a new time updates the same event and a cancel removes it.
// SEQUENCE is the send time in seconds, so the latest email always wins.
// Returns null when the appointment has no date/time (sendEmail just skips it).
export function buildIcsAttachment(
  record: Record<string, unknown>,
  { attendee, title, cancel = false }: { attendee: string; title: string; cancel?: boolean },
): EmailAttachment | null {
  const start = pacificToUtc(record.appointment_date, record.appointment_time)
  if (!start || !record.id) return null

  const end = new Date(start.getTime() + APPOINTMENT_HOURS * 60 * 60 * 1000)
  const now = new Date()
  const method = cancel ? "CANCEL" : "REQUEST"
  const description = [
    record.customer_name && `Customer: ${record.customer_name}`,
    record.phone && `Phone: ${record.phone}`,
    record.email && `Email: ${record.email}`,
    record.property && `Property: ${record.property}`,
    record.message && `Message: ${record.message}`,
  ].filter(Boolean).join("\n")

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Prasad's Cleaning Services//Appointments//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:appointment-${record.id}@prasadscleaning.com`,
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`,
    `LOCATION:${icsText(record.address || record.property)}`,
    `DESCRIPTION:${icsText(description)}`,
    `ORGANIZER;CN=Prasad's Cleaning Services:mailto:${FROM_ADDRESS}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${attendee}`,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(icsFold).join("\r\n") + "\r\n"

  return {
    filename: cancel ? "cancelled-appointment.ics" : "appointment.ics",
    content: btoa(String.fromCharCode(...new TextEncoder().encode(ics))),
    content_type: `text/calendar; charset=utf-8; method=${method}`,
  }
}

// SCRUM-137: "Add to Google Calendar" button (same pre-filled Google link as SCRUM-144, no API key/OAuth),
// now in both the customer's and Nigel's appointment emails. Returns "" when there's no date/time yet.
function calendarButtonHtml(record: Record<string, unknown>, title: string, details: string): string {
  const start = pacificToUtc(record.appointment_date, record.appointment_time)
  if (!start) return ""
  const end = new Date(start.getTime() + APPOINTMENT_HOURS * 60 * 60 * 1000)

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details,
    location: String(record.address || record.property || ""),
    ctz: BUSINESS_TIMEZONE,
  })
  const url = `https://calendar.google.com/calendar/render?${params.toString()}&dates=${icsDate(start)}/${icsDate(end)}`
  return `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Add to Google Calendar</a></p>`
}

// SCRUM-137: Calendar title for the customer's invite, same wording as SCRUM-144's
export const clientEventTitle = (r: Record<string, unknown>) =>
  `${r.service || "Cleaning"} - Prasad's Cleaning Services`

// SCRUM-137: Customer's button, same wording as SCRUM-144's
export const clientCalendarButtonHtml = (r: Record<string, unknown>) =>
  calendarButtonHtml(r, clientEventTitle(r), "Your cleaning appointment with Prasad's Cleaning Services.")

// SCRUM-137: Nigel's button, with the customer's contact details in the event
export const adminCalendarButtonHtml = (r: Record<string, unknown>) =>
  calendarButtonHtml(r, adminEventTitle(r), [
    r.customer_name && `Customer: ${r.customer_name}`,
    r.phone && `Phone: ${r.phone}`,
    r.email && `Email: ${r.email}`,
    r.message && `Message: ${r.message}`,
  ].filter(Boolean).join("\n"))

// SCRUM-137: Calendar title for Nigel's invite
export const adminEventTitle = (r: Record<string, unknown>) =>
  `${r.service || "Cleaning"} - ${r.customer_name || r.email || "Customer"}`
