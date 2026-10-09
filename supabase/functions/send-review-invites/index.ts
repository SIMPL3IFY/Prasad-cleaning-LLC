// SCRUM-211: Invoke hourly with a protected scheduler. The current appointment
// row determines eligibility, so a deleted/cancelled appointment is skipped.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import { escapeHtml } from "../_shared/email.ts"
import { appointmentStart, makeReviewToken, type ReviewAppointment } from "../_shared/review-link.ts"

const env = (name: string) => Deno.env.get(name) || ""
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
})

function pacificDate(now: number): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(now)).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const cronSecret = env("REVIEW_CRON_SECRET")
  if (!cronSecret || req.headers.get("x-review-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401)
  }
  const site = env("REVIEW_SITE_URL").replace(/\/+$/, "")
  const key = env("RESEND_API_KEY")
  const linkSecret = env("REVIEW_LINK_SECRET")
  if (!site || !/^https:\/\//.test(site) || !key || !linkSecret) {
    return json({ error: "Review email configuration is incomplete" }, 500)
  }

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
  const now = Date.now()
  const today = pacificDate(now)
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const { data: appointments, error } = await admin.from("accepted_quotes")
    .select("id,email,customer_name,appointment_date,appointment_time,status,review_invite_claimed_at,review_invite_sent_at")
    .eq("status", "accepted")
    .is("review_invite_sent_at", null)
    .gte("appointment_date", yesterday)
    .lte("appointment_date", today)
    .order("appointment_date", { ascending: false })
    .limit(500)
  if (error) return json({ error: error.message }, 500)

  let sent = 0
  let failed = 0
  for (const record of appointments || []) {
    const start = appointmentStart(record as ReviewAppointment)
    // The job is hourly: invite between three and 24 hours after the start.
    if (!start || now < start + 3 * 3600000 || now > start + 24 * 3600000) continue
    if (!record.email?.trim()) continue
    const previousClaim = record.review_invite_claimed_at
    if (previousClaim && Date.parse(previousClaim) > now - 15 * 60000) continue

    // A conditional claim prevents two overlapping cron runs sending twice.
    let claim = admin.from("accepted_quotes")
      .update({ review_invite_claimed_at: new Date(now).toISOString() })
      .eq("id", record.id).eq("status", "accepted").is("review_invite_sent_at", null)
    claim = previousClaim ? claim.eq("review_invite_claimed_at", previousClaim)
      : claim.is("review_invite_claimed_at", null)
    const { data: claimed, error: claimError } = await claim.select("id")
    if (claimError || claimed?.length !== 1) continue

    try {
      const token = await makeReviewToken(record as ReviewAppointment, linkSecret)
      const url = `${site}/review/${encodeURIComponent(token)}`
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `review-${record.id}-${token.split(".")[1].slice(0, 16)}`,
        },
        body: JSON.stringify({
          from: env("RESEND_FROM_EMAIL") || "Prasad's Cleaning Services <notifications@prasadscleaning.com>",
          to: record.email,
          subject: "How was your cleaning appointment?",
          html: `<p>Hi ${escapeHtml(record.customer_name || "there")},</p>` +
            `<p>Thank you for choosing Prasad's Cleaning Services. We'd love to hear about your experience.</p>` +
            `<p><a href="${escapeHtml(url)}">Leave a review</a></p>` +
            `<p>This link works for 30 days after your appointment and can be used for one review.</p>`,
        }),
      })
      if (!response.ok) throw new Error(`Resend returned ${response.status}`)
      const { error: markError } = await admin.from("accepted_quotes")
        .update({ review_invite_sent_at: new Date().toISOString() })
        .eq("id", record.id)
      if (markError) throw markError
      sent++
    } catch (sendError) {
      failed++
      console.error("SCRUM-211: Review invitation failed", record.id, sendError)
      // The same Resend idempotency key makes an uncertain retry safe for 24h.
      await admin.from("accepted_quotes").update({ review_invite_claimed_at: null })
        .eq("id", record.id).is("review_invite_sent_at", null)
    }
  }
  return json({ inspected: appointments?.length || 0, sent, failed })
})
