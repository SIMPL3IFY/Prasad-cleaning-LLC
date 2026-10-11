// SCRUM-211: A signed, time-limited link permits one review for an appointment.
// The visitor is not given database credentials or a general sign-in session.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import { appointmentStart, validReviewToken, type ReviewAppointment } from "../_shared/review-link.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
})

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  const secret = Deno.env.get("REVIEW_LINK_SECRET")
  if (!secret) return json({ error: "Review form is temporarily unavailable." }, 500)

  let body: { token?: unknown; action?: unknown; customerName?: unknown; rating?: unknown; review?: unknown }
  try { body = await req.json() } catch { return json({ error: "Invalid request." }) }
  const { token, action, customerName, rating, review } = body
  if (typeof token !== "string" || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(token)) {
    return json({ error: "This review link is invalid or expired." })
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const quoteId = token.slice(0, 36)
  const { data: record, error: loadError } = await admin.from("accepted_quotes")
    .select("id,email,appointment_date,appointment_time,status,review_invite_sent_at")
    .eq("id", quoteId).maybeSingle()
  if (loadError) return json({ error: "Please try again later." }, 500)
  const start = record && appointmentStart(record as ReviewAppointment)
  const now = Date.now()
  if (!record || record.status !== "accepted" || !record.review_invite_sent_at || !start ||
      now < start + 3 * 3600000 || now > start + 30 * 86400000 ||
      !await validReviewToken(token, record as ReviewAppointment, secret)) {
    return json({ error: "This review link is invalid or expired." })
  }

  const { data: existing, error: existingError } = await admin.from("customer_reviews")
    .select("id").eq("accepted_quote_id", record.id).maybeSingle()
  if (existingError) return json({ error: "Please try again later." }, 500)
  if (existing) return json({ error: "A review was already submitted for this appointment." })
  if (action === "validate") return json({ valid: true })

  const name = typeof customerName === "string" ? customerName.trim() : ""
  const text = typeof review === "string" ? review.trim() : ""
  if (!name || name.length > 120 || !text || text.length > 2000 ||
      !Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    return json({ error: "Enter your name, a rating from 1 to 5, and a review." })
  }

  const { error: insertError } = await admin.from("customer_reviews").insert({
    user_id: null,
    accepted_quote_id: record.id,
    customer_name: name,
    review: text,
    rating,
    approved: rating === 5,
  })
  if (insertError?.code === "23505") return json({ error: "A review was already submitted for this appointment." })
  if (insertError) {
    console.error("SCRUM-211: Review insert failed", record.id, insertError)
    return json({ error: "Unable to save your review. Please try again later." }, 500)
  }
  return json({ submitted: true })
})
