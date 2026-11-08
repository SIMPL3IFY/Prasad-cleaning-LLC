// SCRUM-244: Emails from send-review-invites (hourly protected scheduler)
import { assert, assertEquals, assertStringIncludes } from "@std/assert"
import { validReviewToken } from "../../supabase/functions/_shared/review-link.ts"
import {
  ADMIN_EMAIL,
  APPOINTMENT,
  assertEscaped,
  CRON_SECRET,
  CUSTOMER_EMAIL,
  dangerous,
  db,
  LINK_SECRET,
  QUOTE_ID,
  readJson,
  resend,
  setup,
} from "./helpers.ts"
import type { Query, Result } from "./fake_supabase.ts"

const FN = "send-review-invites"
const AUTH = { "x-review-cron-secret": CRON_SECRET }

// Appointment started 16:30 UTC, so this is 7.5 hours later and inside the invite window.
const NOW = "2026-10-15T00:00:00.000Z"
const ROW = { ...APPOINTMENT, review_invite_claimed_at: null, review_invite_sent_at: null }

// Fake accepted_quotes: the select returns rows, and a claim wins unless told otherwise
function table(rows: unknown[], claim: Result = { data: [{ id: QUOTE_ID }], error: null }) {
  db.respond = (q: Query): Result => {
    if (q.op === "select") return { data: rows, error: null }
    const values = q.values as Record<string, unknown>
    return values.review_invite_claimed_at ? claim : { data: null, error: null }
  }
}

Deno.test("sends the invite to the customer with subject, reply-to and a signed link", async () => {
  const call = await setup(FN, { now: NOW })
  table([ROW])
  const res = await call({ headers: AUTH })
  assertEquals(await readJson(res), { inspected: 1, sent: 1, failed: 0 })

  assertEquals(resend.emails().map((e) => e.to), [CUSTOMER_EMAIL])
  const email = resend.emailTo(CUSTOMER_EMAIL)
  assertEquals(email.subject, "How was your cleaning appointment?")
  assertEquals(email.reply_to, ADMIN_EMAIL)
  assertStringIncludes(email.html, "Hi Pat Customer,")

  const link = /https:\/\/site\.example\.com\/review\/([^"]+)"/.exec(email.html)
  assert(link, "expected a review link with the trailing slash trimmed from the site URL")
  assert(await validReviewToken(decodeURIComponent(link[1]), ROW, LINK_SECRET), "the link must carry a valid token")

  const { headers } = resend.requests[0]
  assertEquals(headers.get("Authorization"), "Bearer resend-key")
  assert(headers.get("Idempotency-Key")?.startsWith(`review-${QUOTE_ID}-`))
})

Deno.test("customer-supplied text is HTML-escaped", async () => {
  const call = await setup(FN, { now: NOW })
  table([{ ...ROW, customer_name: dangerous("customer_name") }])
  await call({ headers: AUTH })
  assertEscaped(resend.emailTo(CUSTOMER_EMAIL).html, ["customer_name"])
})

const notInvited: [string, Record<string, unknown>][] = [
  ["an appointment that hasn't started", { appointment_time: "21:30" }], // 04:30 UTC on the 15th
  ["just under 3 hours after the start", { appointment_time: "14:01" }], // 2h59m earlier
  ["more than 24 hours after the start", { appointment_date: "2026-10-13", appointment_time: "16:59" }], // 24h01m earlier
  ["a free-text date", { appointment_date: "next Tuesday" }],
  ["no email", { email: "  " }],
  ["claimed in the last 15 minutes", { review_invite_claimed_at: "2026-10-14T23:50:00.000Z" }],
]
for (const [name, change] of notInvited) {
  Deno.test(`sends no invite for ${name}`, async () => {
    const call = await setup(FN, { now: NOW })
    table([{ ...ROW, ...change }])
    const res = await call({ headers: AUTH })
    assertEquals(await readJson(res), { inspected: 1, sent: 0, failed: 0 })
    assertEquals(resend.requests.length, 0)
  })
}

const invited: [string, Record<string, unknown>][] = [
  ["exactly 3 hours after the start", { appointment_time: "14:00" }],
  ["exactly 24 hours after the start", { appointment_date: "2026-10-13", appointment_time: "17:00" }],
]
for (const [name, change] of invited) {
  Deno.test(`sends the invite ${name}`, async () => {
    const call = await setup(FN, { now: NOW })
    table([{ ...ROW, ...change }])
    const res = await call({ headers: AUTH })
    assertEquals((await readJson(res)).sent, 1)
    resend.emailTo(CUSTOMER_EMAIL)
  })
}

Deno.test("sends nothing when another run already claimed the invite, so customers don't get two", async () => {
  const call = await setup(FN, { now: NOW })
  table([ROW], { data: [], error: null })
  const res = await call({ headers: AUTH })
  assertEquals(await readJson(res), { inspected: 1, sent: 0, failed: 0 })
  assertEquals(resend.requests.length, 0)
})

Deno.test("a Resend error is counted as failed and reported", async () => {
  const call = await setup(FN, { now: NOW })
  table([ROW])
  resend.respond = () => new Response("server error", { status: 500 })
  const res = await call({ headers: AUTH })
  assertEquals(res.status, 200)
  assertEquals(await readJson(res), { inspected: 1, sent: 0, failed: 1 })
})

Deno.test("one failed invite doesn't stop the rest", async () => {
  const call = await setup(FN, { now: NOW })
  table([ROW, { ...ROW, email: "second@example.com" }])
  let requests = 0
  resend.respond = () => ++requests === 1
    ? new Response("server error", { status: 500 })
    : new Response("{}", { status: 200 })
  const res = await call({ headers: AUTH })
  assertEquals(await readJson(res), { inspected: 2, sent: 1, failed: 1 })
  assertEquals(resend.emails().map((e) => e.to), [CUSTOMER_EMAIL, "second@example.com"])
})

Deno.test("test mode won't email a real customer", async () => {
  const call = await setup(FN, { now: NOW, env: { REVIEW_TEST_EMAIL: "tester@example.com" } })
  table([ROW])
  const res = await call({ headers: AUTH, body: { testQuoteId: QUOTE_ID } })
  assertEquals(res.status, 403)
  await res.body?.cancel()
  assertEquals(resend.requests.length, 0)
})

Deno.test("test mode sends to the test address", async () => {
  const call = await setup(FN, { now: NOW, env: { REVIEW_TEST_EMAIL: "Tester@Example.com " } })
  table([{ ...ROW, email: "tester@example.com" }])
  const res = await call({ headers: AUTH, body: { testQuoteId: QUOTE_ID } })
  assertEquals((await readJson(res)).sent, 1)
  assertEquals(resend.emails().map((e) => e.to), ["tester@example.com"])
})
