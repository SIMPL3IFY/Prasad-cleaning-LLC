// SCRUM-184: Called by the Admin Dashboard after an appointment time is saved or cancelled.
// Books/cancels the slot on Nigel's Calendly and emails the client and Nigel.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import {
  BUSINESS_TIMEZONE,
  escapeHtml,
  formatPacific,
  jobDetailsHtml,
  sendEmail,
  type EmailResult,
} from "../_shared/email.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// Accepts either secret name; the project already has CALENDLY_PAT and NIGEL_EMAIL set.
const CALENDLY_API_TOKEN = Deno.env.get("CALENDLY_API_TOKEN") || Deno.env.get("CALENDLY_PAT")
const CALENDLY_EVENT_TYPE_URI = Deno.env.get("CALENDLY_EVENT_TYPE_URI")
const CALENDLY_LOCATION_KIND = Deno.env.get("CALENDLY_LOCATION_KIND") || "ask_invitee"
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("NIGEL_EMAIL") || ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// SCRUM-184: How far a timezone is from UTC (ms) at a given instant, e.g. -7h for PDT.
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

// SCRUM-184: "2026-10-14" + "09:30" in Pacific time -> UTC ISO string for Calendly.
export function pacificToUtcIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "")
  const t = /^(\d{1,2}):(\d{2})/.exec(time ?? "")
  if (!d || !t) return null
  const wallClock = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2])
  // Two passes so dates right next to a DST switch use the offset in effect at that moment.
  let utc = wallClock - tzOffsetMs(wallClock, BUSINESS_TIMEZONE)
  utc = wallClock - tzOffsetMs(utc, BUSINESS_TIMEZONE)
  return new Date(utc).toISOString()
}

async function calendly(path: string, body: unknown) {
  const url = path.startsWith("http") ? path : `https://api.calendly.com${path}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${CALENDLY_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (res.status === 429) {
    // Trial accounts may only create a few bookings per day; tell the admin when they can try again
    const resetSeconds = Number(res.headers.get("X-RateLimit-Reset"))
    const wait = resetSeconds ? ` Try again in about ${Math.ceil(resetSeconds / 60)} minute(s).` : ""
    throw new Error(`Calendly rate limit reached.${wait}`)
  }
  if (!res.ok) throw new Error(`Calendly ${res.status}: ${text}`)
  return text ? JSON.parse(text) : {}
}

async function cancelCalendlyEvent(eventUri: string, reason: string) {
  try {
    await calendly(`${eventUri}/cancellation`, { reason })
  } catch (err) {
    // Already-cancelled events come back as 403/404; treat those as done.
    if (/Calendly (403|404)/.test(String(err))) return
    throw err
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  // SCRUM-184: Only signed-in admins may trigger bookings and emails.
  const authHeader = req.headers.get("Authorization") ?? ""
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: "Not signed in" }, 401)

  const { data: profile } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_admin) return json({ error: "Admins only" }, 403)

  let body: { quoteId?: string; mode?: string; previous?: { date?: string; time?: string }; reason?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  const { quoteId, mode, previous, reason } = body
  if (!quoteId || (mode !== "schedule" && mode !== "cancel")) {
    return json({ error: "quoteId and mode ('schedule' | 'cancel') are required" }, 400)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: record, error: loadError } = await admin
    .from("accepted_quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle()
  if (loadError) return json({ error: loadError.message }, 500)
  if (!record) return json({ error: "Appointment not found" }, 404)

  const calendlyConfigured = Boolean(CALENDLY_API_TOKEN && CALENDLY_EVENT_TYPE_URI)
  let calendar: { ok: boolean; skipped?: boolean; error?: string } = { ok: true }
  let clientEmail: EmailResult
  let adminEmail: EmailResult
  const when = formatPacific(record.appointment_date, record.appointment_time)
  const name = escapeHtml(record.customer_name || "there")
  const service = escapeHtml(record.service)

  if (mode === "schedule") {
    const startTime = pacificToUtcIso(record.appointment_date, record.appointment_time)
    if (!startTime) {
      return json({ error: "Appointment date/time must be YYYY-MM-DD and HH:MM" }, 400)
    }

    if (!calendlyConfigured) {
      calendar = { ok: false, skipped: true, error: "Calendly secrets not set" }
    } else {
      try {
        if (record.calendly_event_uri) {
          await cancelCalendlyEvent(record.calendly_event_uri, "Rescheduled by Prasad's Cleaning Services")
        }
        const created = await calendly("/invitees", {
          event_type: CALENDLY_EVENT_TYPE_URI,
          start_time: startTime,
          invitee: {
            name: record.customer_name || record.email,
            email: record.email,
            timezone: BUSINESS_TIMEZONE,
          },
          location: { kind: CALENDLY_LOCATION_KIND, location: record.address || record.property || "" },
        })
        const eventUri = created?.resource?.event ?? null
        await admin
          .from("accepted_quotes")
          .update({ calendly_event_uri: eventUri, calendar_synced_at: new Date().toISOString() })
          .eq("id", quoteId)
      } catch (err) {
        console.error("SCRUM-184: Calendly booking failed", err)
        calendar = { ok: false, error: String(err) }
      }
    }

    // Only a reschedule if this appointment was already booked and confirmed before.
    const wasRescheduled = Boolean(record.calendly_event_uri && (previous?.date || previous?.time))
    const previousWhen = wasRescheduled ? formatPacific(previous?.date, previous?.time) : ""

    clientEmail = await sendEmail({
      to: record.email,
      replyTo: ADMIN_NOTIFY_EMAIL || undefined,
      subject: wasRescheduled ? "Your cleaning appointment has been rescheduled" : "Your cleaning appointment is confirmed",
      html: `
        <h2>${wasRescheduled ? "Your appointment has been rescheduled" : "Your appointment is confirmed"}</h2>
        <p>Hi ${name},</p>
        <p>Your <strong>${service}</strong> service is scheduled for <strong>${escapeHtml(when)}</strong>
        ${wasRescheduled ? ` (previously ${escapeHtml(previousWhen)})` : ""}.</p>
        <p><strong>Address:</strong> ${escapeHtml(record.address || record.property)}</p>
        <p>If you need to change anything, just reply to this email.</p>
        <p>— Prasad's Cleaning Services</p>
      `,
    })
    adminEmail = await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      replyTo: record.email,
      subject: `${wasRescheduled ? "Rescheduled" : "Scheduled"}: ${record.customer_name} — ${when}`,
      html: `
        <h2>Appointment ${wasRescheduled ? "rescheduled" : "scheduled"}</h2>
        ${wasRescheduled ? `<p>Previously: ${escapeHtml(previousWhen)}</p>` : ""}
        ${jobDetailsHtml(record)}
        ${calendar.ok ? "" : `<p style="color:#b00020"><strong>Calendly was not updated:</strong> ${escapeHtml(calendar.error)}</p>`}
      `,
    })
  } else {
    if (record.calendly_event_uri && calendlyConfigured) {
      try {
        await cancelCalendlyEvent(record.calendly_event_uri, reason || "Cancelled by Prasad's Cleaning Services")
      } catch (err) {
        console.error("SCRUM-184: Calendly cancellation failed", err)
        calendar = { ok: false, error: String(err) }
      }
    } else if (record.calendly_event_uri) {
      calendar = { ok: false, skipped: true, error: "Calendly secrets not set" }
    }

    clientEmail = await sendEmail({
      to: record.email,
      replyTo: ADMIN_NOTIFY_EMAIL || undefined,
      subject: "Your cleaning appointment has been cancelled",
      html: `
        <h2>Your appointment has been cancelled</h2>
        <p>Hi ${name},</p>
        <p>Your <strong>${service}</strong> appointment${record.appointment_date ? ` on <strong>${escapeHtml(when)}</strong>` : ""} has been cancelled.</p>
        <p>If you have questions or want to book again, just reply to this email.</p>
        <p>— Prasad's Cleaning Services</p>
      `,
    })
    adminEmail = await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      replyTo: record.email,
      subject: `Cancelled: ${record.customer_name}${record.appointment_date ? ` — ${when}` : ""}`,
      html: `
        <h2>Appointment cancelled</h2>
        <p><strong>Reason:</strong> ${escapeHtml(reason || "No reason given")}</p>
        ${jobDetailsHtml(record)}
        ${calendar.ok ? "" : `<p style="color:#b00020"><strong>Calendly booking may still exist:</strong> ${escapeHtml(calendar.error)}</p>`}
      `,
    })
  }

  return json({ calendar, clientEmail, adminEmail })
})
