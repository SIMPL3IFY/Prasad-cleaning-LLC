// SCRUM-184: Called by the Admin Dashboard after an appointment time is saved or cancelled.
// Emails the client and Nigel. (Calendly booking was removed.)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import {
  escapeHtml,
  formatPacific,
  jobDetailsHtml,
  sendEmail,
  type EmailResult,
} from "../_shared/email.ts"


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)


  // SCRUM-184: Only signed-in admins may trigger appointment emails.
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
// SCRUM-199: Can also be "skipped" when the webhook sends the customer email instead
  let clientEmail: EmailResult | { sent: false; skipped: string }
  let adminEmail: EmailResult
  const when = formatPacific(record.appointment_date, record.appointment_time)
  const name = escapeHtml(record.customer_name || "there")
  const service = escapeHtml(record.service)


  if (mode === "schedule") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.appointment_date ?? "") || !/^\d{1,2}:\d{2}/.test(record.appointment_time ?? "")) {
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


    // SCRUM-199: A reschedule = the appointment already had a date AND time before this save.
    // Same rule as notify-appointment-updated, so exactly one of the two functions emails the customer.
    const wasRescheduled = Boolean(previous?.date && previous?.time)
    const previousWhen = wasRescheduled ? formatPacific(previous?.date, previous?.time) : ""


    // SCRUM-199: Reschedules are emailed by notify-appointment-updated (webhook), so only the first confirmation is sent here
    if (wasRescheduled) {
      clientEmail = { sent: false, skipped: "handled by notify-appointment-updated" }
    } else {
      clientEmail = await sendEmail({
        to: record.email,
        replyTo: ADMIN_NOTIFY_EMAIL || undefined,
        subject: "Your cleaning appointment is confirmed",
        html: `
          <h2>Your appointment is confirmed</h2>
          <p>Hi ${name},</p>
          <p>Your <strong>${service}</strong> service is scheduled for <strong>${escapeHtml(when)}</strong>.</p>
          <p><strong>Address:</strong> ${escapeHtml(record.address || record.property)}</p>
          <p>If you need to change anything, just reply to this email.</p>
          <p>— Prasad's Cleaning Services</p>
        `,
      })
    }
    adminEmail = await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      replyTo: record.email,
      subject: `${wasRescheduled ? "Rescheduled" : "Scheduled"}: ${record.customer_name} — ${when}`,
      html: `
        <h2>Appointment ${wasRescheduled ? "rescheduled" : "scheduled"}</h2>
        ${wasRescheduled ? `<p>Previously: ${escapeHtml(previousWhen)}</p>` : ""}
        ${jobDetailsHtml(record)}
      `,
    })
  } else {
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
      `,
    })
  }


  return json({ clientEmail, adminEmail })
})