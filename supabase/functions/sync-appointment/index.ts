// SCRUM-184: Called by the Admin Dashboard after an appointment time is saved or cancelled.
// Emails the client and Nigel.
// SCRUM-137: When Nigel first sets the time, the customer and Nigel each get one calendar invite
// (.ics attachment + "Add to Google Calendar" button). A reschedule sends each of them an updated .ics
// for the same event, so their calendar moves to the new time and the old time is gone (the customer's
// copy comes from notify-appointment-updated). A cancel sends each a cancel .ics that removes the event.
// { test: true } emails Nigel a sample invite without touching the database.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import {
  escapeHtml,
  emailHeading,
  formatPacific,
  adminCalendarButtonHtml,
  adminEventTitle,
  buildIcsAttachment,
  clientCalendarButtonHtml,
  clientEventTitle,
  customerSubject,
  jobDetailsHtml,
  renderEmailLayout,
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


// SCRUM-137: Sample appointment for test mode: tomorrow at 10:00 Pacific
function sampleRecord(): Record<string, unknown> {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return {
    id: "test",
    customer_name: "Test Customer",
    email: "test.customer@example.com",
    phone: "555-555-0100",
    service: "Deep Cleaning",
    property: "House",
    address: "123 Example St, Sacramento, CA",
    appointment_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(tomorrow),
    appointment_time: "10:00",
    message: "This is a test appointment.",
  }
}


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


  let body: { quoteId?: string; mode?: string; previous?: { date?: string; time?: string }; reason?: string; test?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  const { quoteId, mode, previous, reason, test } = body


  // SCRUM-137: Test mode — sample invite to Nigel only
  if (test) {
    const sample = sampleRecord()
    const adminEmail = await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      subject: `[TEST] Scheduled: ${sample.customer_name} — ${formatPacific(sample.appointment_date as string, sample.appointment_time as string)}`,
      html: `
        <h2>Test appointment invite</h2>
        <p>Use the button or open the attached invite, and check it lands in your calendar at the right time.</p>
        ${adminCalendarButtonHtml(sample)}
        ${jobDetailsHtml(sample)}
      `,
      attachments: [buildIcsAttachment(sample, { attendee: ADMIN_NOTIFY_EMAIL, title: `[TEST] ${adminEventTitle(sample)}` })],
    })
    return json({ adminEmail })
  }
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
        // SCRUM-205: Shared subject + thread id; replies go to the admin by default
        subject: customerSubject(record),
        threadId: record.id,
      // SCRUM-217: Same body as before, now inside the branded layout
        html: renderEmailLayout({
          title: "Your appointment is confirmed",
          preheader: `Your ${record.service || "cleaning"} service is scheduled for ${when}.`,
          bodyHtml: `
            ${emailHeading("Your appointment is confirmed")}
            <p>Hi ${name},</p>
            <p>Your <strong>${service}</strong> service is scheduled for <strong>${escapeHtml(when)}</strong>.</p>
            <p><strong>Address:</strong> ${escapeHtml(record.address || record.property)}</p>
            <p>Add it to your calendar with the button, or open the attached invite.</p>
            ${clientCalendarButtonHtml(record)}
            <p>If you need to change anything, just reply to this email.</p>
            <p>— Prasad's Cleaning Services</p>
          `,
        }),
        attachments: [buildIcsAttachment(record, { attendee: record.email, title: clientEventTitle(record) })],
      })
    }
    adminEmail = await sendEmail({
      to: ADMIN_NOTIFY_EMAIL,
      replyTo: record.email,
      subject: `${wasRescheduled ? "Rescheduled" : "Scheduled"}: ${record.customer_name} — ${when}`,
      html: `
        <h2>Appointment ${wasRescheduled ? "rescheduled" : "scheduled"}</h2>
        ${wasRescheduled ? `<p>Previously: ${escapeHtml(previousWhen)}</p>` : ""}
        ${wasRescheduled
          ? `<p>Open the attached invite to move the event in your calendar to the new time. It replaces the old time.</p>`
          : `<p>Add it to your calendar with the button, or open the attached invite.</p>
        ${adminCalendarButtonHtml(record)}`}
        ${jobDetailsHtml(record)}
      `,
      // SCRUM-137: Same event id every time, so a reschedule updates the event instead of adding a second one
      attachments: [buildIcsAttachment(record, { attendee: ADMIN_NOTIFY_EMAIL, title: adminEventTitle(record) })],
    })
  } else {
    clientEmail = await sendEmail({
      to: record.email,
      // SCRUM-205: Shared subject + thread id; replies go to the admin by default
      subject: customerSubject(record),
      threadId: record.id,
      // SCRUM-217: Same body as before, now inside the branded layout
      html: renderEmailLayout({
        title: "Your appointment has been cancelled",
        preheader: `Your ${record.service || "cleaning"} appointment has been cancelled.`,
        bodyHtml: `
          ${emailHeading("Your appointment has been cancelled")}
          <p>Hi ${name},</p>
          <p>Your <strong>${service}</strong> appointment${record.appointment_date ? ` on <strong>${escapeHtml(when)}</strong>` : ""} has been cancelled.</p>
          <p>If you have questions or want to book again, just reply to this email.</p>
          <p>— Prasad's Cleaning Services</p>
        `,
      }),
      // SCRUM-137: Removes the event from the customer's calendar (skipped if it never had a date/time)
      attachments: [buildIcsAttachment(record, { attendee: record.email, title: clientEventTitle(record), cancel: true })],
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
      // SCRUM-137: Removes the event from Nigel's calendar (skipped if it never had a date/time)
      attachments: [buildIcsAttachment(record, { attendee: ADMIN_NOTIFY_EMAIL, title: adminEventTitle(record), cancel: true })],
    })
  }


  return json({ clientEmail, adminEmail })
})