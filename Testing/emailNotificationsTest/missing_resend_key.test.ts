// SCRUM-244: With no RESEND_API_KEY, no email function sends anything or crashes.
// This is its own file because _shared/email.ts reads the key once on import.
import { assertEquals } from "@std/assert"
import { APPOINTMENT, CRON_SECRET, db, QUOTE_ID, readJson, resend, setup, useSharedEnv } from "./helpers.ts"

useSharedEnv({ RESEND_API_KEY: undefined })

const SKIPPED = { sent: false, skipped: true, error: "RESEND_API_KEY not set" }

Deno.test("notify-quote-accepted skips both emails and returns 200", async () => {
  const call = await setup("notify-quote-accepted")
  const res = await call({ body: { record: APPOINTMENT } })
  assertEquals(res.status, 200)
  assertEquals(await readJson(res), { clientEmail: SKIPPED, adminEmail: SKIPPED })
  assertEquals(resend.requests.length, 0)
})

Deno.test("notify-appointment-updated skips the email and returns 200", async () => {
  const call = await setup("notify-appointment-updated")
  const res = await call({
    body: { type: "UPDATE", record: APPOINTMENT, old_record: { ...APPOINTMENT, appointment_time: "14:00" } },
  })
  assertEquals(res.status, 200)
  assertEquals((await readJson(res)).clientEmail, SKIPPED)
  assertEquals(resend.requests.length, 0)
})

Deno.test("sync-appointment skips both emails and returns 200", async () => {
  const call = await setup("sync-appointment")
  db.sessions["admin-token"] = { id: "admin-user" }
  db.respond = (q) => q.table === "profiles"
    ? { data: { is_admin: true }, error: null }
    : { data: APPOINTMENT, error: null }
  const res = await call({
    headers: { Authorization: "Bearer admin-token" },
    body: { quoteId: QUOTE_ID, mode: "schedule" },
  })
  assertEquals(res.status, 200)
  assertEquals(await readJson(res), { clientEmail: SKIPPED, adminEmail: SKIPPED })
  assertEquals(resend.requests.length, 0)
})

Deno.test("send-review-invites stops before claiming anything, so invites can still go out later", async () => {
  const call = await setup("send-review-invites")
  const res = await call({ headers: { "x-review-cron-secret": CRON_SECRET } })
  assertEquals(res.status, 500)
  assertEquals(await readJson(res), { error: "Review email configuration is incomplete" })
  assertEquals(resend.requests.length, 0)
  assertEquals(db.queries.length, 0)
})
