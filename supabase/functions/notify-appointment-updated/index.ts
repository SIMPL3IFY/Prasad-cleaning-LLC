// SCRUM-199: Emails the customer when an admin changes an accepted appointment's date, time, or address.
// Triggered by a Supabase Database Webhook on accepted_quotes UPDATE (separate from the INSERT webhook).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { escapeHtml, formatPacific, sendEmail } from "../_shared/email.ts"

const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("NIGEL_EMAIL") || ""

// SCRUM-199: Only these columns count as a customer-facing change (AC #2)
const WATCHED_FIELDS = ["appointment_date", "appointment_time", "address"] as const

// SCRUM-199: null, undefined and "" all mean "empty", so null -> "" isn't counted as a change
const norm = (v: unknown) => String(v ?? "").trim()

// SCRUM-199: An appointment counts as scheduled once it has both a date and a time
const isScheduled = (r: Record<string, unknown>) =>
  Boolean(norm(r.appointment_date) && norm(r.appointment_time))

// SCRUM-199: One row of the before/after table; changed rows are highlighted (AC #3)
function changeRow(label: string, before: string, after: string): string {
  const cell = "padding:8px 12px;border:1px solid #ddd;"
  const highlight = before !== after ? "background:#fff4e5;font-weight:bold;" : ""
  return `
    <tr style="${highlight}">
      <td style="${cell}">${escapeHtml(label)}</td>
      <td style="${cell}">${escapeHtml(before)}</td>
      <td style="${cell}">${escapeHtml(after)}</td>
    </tr>`
}

serve(async (req) => {
  try {
    const payload = await req.json()
    // On UPDATE, Supabase sends { type, table, record, old_record, schema }
    const record = payload.record
    const oldRecord = payload.old_record

    if (payload.type !== "UPDATE" || !record || !oldRecord) {
      return new Response(JSON.stringify({ skipped: "not an UPDATE" }), { status: 200 })
    }

    // SCRUM-199: Compare old vs new for just the watched fields
    const changed = WATCHED_FIELDS.filter((f) => norm(oldRecord[f]) !== norm(record[f]))

    if (changed.length === 0) {
      console.log("SCRUM-199: no watched fields changed, skipping", record.id)
      return new Response(JSON.stringify({ skipped: "no relevant changes" }), { status: 200 })
    }

    // SCRUM-199: First booking (no date/time before) — sync-appointment sends the "confirmed" email
    if (!isScheduled(oldRecord)) {
      console.log("SCRUM-199: first-time scheduling, sync-appointment handles it", record.id)
      return new Response(JSON.stringify({ skipped: "first booking" }), { status: 200 })
    }

    // SCRUM-199: Date/time cleared — treated as a cancellation, sync-appointment handles it
    if (!isScheduled(record)) {
      console.log("SCRUM-199: appointment no longer scheduled, skipping", record.id)
      return new Response(JSON.stringify({ skipped: "not scheduled" }), { status: 200 })
    }

    if (!record.email) {
      console.error("SCRUM-199: accepted_quotes row missing email, skipping", record.id)
      return new Response(JSON.stringify({ skipped: "no email" }), { status: 200 })
    }

    console.log("SCRUM-199: changed fields", record.id, changed)

    // SCRUM-199: Old vs new values for the email (AC #3)
    const oldWhen = formatPacific(oldRecord.appointment_date, oldRecord.appointment_time)
    const newWhen = formatPacific(record.appointment_date, record.appointment_time)
    const oldAddress = norm(oldRecord.address) || "Not provided"
    const newAddress = norm(record.address) || "Not provided"

    const clientEmail = await sendEmail({
      to: record.email,
      replyTo: ADMIN_NOTIFY_EMAIL || undefined,
      subject: "Your cleaning appointment details have changed",
      html: `
        <h2>Your appointment has been updated</h2>
        <p>Hi ${escapeHtml(record.customer_name || "there")},</p>
        <p>We've made changes to your <strong>${escapeHtml(record.service)}</strong> appointment. What changed is highlighted below.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr>
            <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;"></th>
            <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Before</th>
            <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Now</th>
          </tr>
          ${changeRow("Date & time", oldWhen, newWhen)}
          ${changeRow("Address", oldAddress, newAddress)}
        </table>
        <p>If anything looks off, just reply to this email.</p>
        <p>— Prasad's Cleaning Services</p>
      `,
    })

    // SCRUM-199: Log the send result; a failed send is logged, never rolled back (AC #4)
    console.log("SCRUM-199: update email result", record.id, clientEmail)
    return new Response(JSON.stringify({ changed, clientEmail }), { status: 200 })
  } catch (err) {
    // SCRUM-199: Always 200, same as SCRUM-151 — the edit already happened, failures are only logged (AC #4)
    console.error("SCRUM-199: notify-appointment-updated crashed", err)
    return new Response(JSON.stringify({ sent: false, error: String(err) }), { status: 200 })
  }
})