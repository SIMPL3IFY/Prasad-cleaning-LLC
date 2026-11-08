// SCRUM-244: Emails from sync-appointment (called by the Admin Dashboard)
import { assert, assertEquals, assertStringIncludes } from "@std/assert"
import {
  ADMIN_EMAIL,
  APPOINTMENT,
  APPOINTMENT_PACIFIC,
  APPOINTMENT_UTC,
  assertEscaped,
  assertIcs,
  CUSTOMER_EMAIL,
  CUSTOMER_SUBJECT,
  dangerous,
  DANGEROUS_APPOINTMENT,
  db,
  QUOTE_ID,
  readJson,
  resend,
  setup,
  THREAD_REF,
} from "./helpers.ts"

// A signed-in admin, and the given row in accepted_quotes, so each test reaches the email code
async function signedIn(record: unknown = APPOINTMENT) {
  const call = await setup("sync-appointment")
  db.sessions["admin-token"] = { id: "admin-user" }
  db.respond = (q) => q.table === "profiles"
    ? { data: { is_admin: true }, error: null }
    : { data: record, error: null }
  return (body: unknown) => call({ headers: { Authorization: "Bearer admin-token" }, body })
}

Deno.test("first schedule emails the customer and the admin with Pacific time", async () => {
  const send = await signedIn()
  const res = await send({ quoteId: QUOTE_ID, mode: "schedule" })
  assertEquals(res.status, 200)
  assertEquals(await readJson(res), { clientEmail: { sent: true }, adminEmail: { sent: true } })
  assertEquals(resend.requests.length, 2)

  const customer = resend.emailTo(CUSTOMER_EMAIL)
  assertEquals(customer.subject, CUSTOMER_SUBJECT)
  assertEquals(customer.reply_to, ADMIN_EMAIL)
  assertEquals(customer.headers, { "In-Reply-To": THREAD_REF, "References": THREAD_REF })
  assertStringIncludes(customer.html, "Your appointment is confirmed")
  assertStringIncludes(customer.html, APPOINTMENT_PACIFIC)
  assertStringIncludes(customer.html, "Add to Google Calendar")

  const admin = resend.emailTo(ADMIN_EMAIL)
  assertEquals(admin.subject, `Scheduled: Pat Customer — ${APPOINTMENT_PACIFIC}`)
  assertEquals(admin.reply_to, CUSTOMER_EMAIL)
  assertStringIncludes(admin.html, APPOINTMENT_PACIFIC)
})

Deno.test("first schedule attaches a UTC .ics invite to each email", async () => {
  const send = await signedIn()
  await send({ quoteId: QUOTE_ID, mode: "schedule" })

  const customer = assertIcs(resend.emailTo(CUSTOMER_EMAIL).attachments?.[0], APPOINTMENT_UTC)
  assert(customer.some((l) => l.startsWith("ATTENDEE") && l.endsWith(`mailto:${CUSTOMER_EMAIL}`)))
  assert(customer.includes("SUMMARY:Deep Cleaning - Prasad's Cleaning Services"))

  const admin = assertIcs(resend.emailTo(ADMIN_EMAIL).attachments?.[0], APPOINTMENT_UTC)
  assert(admin.some((l) => l.startsWith("ATTENDEE") && l.endsWith(`mailto:${ADMIN_EMAIL}`)))
  assert(admin.includes("SUMMARY:Deep Cleaning - Pat Customer"))
})

Deno.test("a reschedule emails only the admin, because the webhook emails the customer", async () => {
  const send = await signedIn()
  const res = await send({
    quoteId: QUOTE_ID,
    mode: "schedule",
    previous: { date: "2026-10-10", time: "14:00" },
  })
  assertEquals(await readJson(res), {
    clientEmail: { sent: false, skipped: "handled by notify-appointment-updated" },
    adminEmail: { sent: true },
  })

  assertEquals(resend.emails().map((e) => e.to), [ADMIN_EMAIL])
  const admin = resend.emailTo(ADMIN_EMAIL)
  assertEquals(admin.subject, `Rescheduled: Pat Customer — ${APPOINTMENT_PACIFIC}`)
  assertEquals(admin.reply_to, CUSTOMER_EMAIL)
  assertStringIncludes(admin.html, "Previously: Saturday, October 10, 2026 at 2:00 PM (Pacific)")
  assertIcs(admin.attachments?.[0], APPOINTMENT_UTC)
})

Deno.test("a cancel emails both, with a cancelling .ics and the reason for the admin", async () => {
  const send = await signedIn()
  const res = await send({ quoteId: QUOTE_ID, mode: "cancel", reason: "Customer moved" })
  assertEquals(res.status, 200)

  const customer = resend.emailTo(CUSTOMER_EMAIL)
  assertEquals(customer.subject, CUSTOMER_SUBJECT)
  assertEquals(customer.reply_to, ADMIN_EMAIL)
  assertStringIncludes(customer.html, "Your appointment has been cancelled")
  assertStringIncludes(customer.html, APPOINTMENT_PACIFIC)
  assert(!customer.html.includes("Customer moved"), "the admin's reason stays internal")
  assertIcs(customer.attachments?.[0], { ...APPOINTMENT_UTC, cancel: true })

  const admin = resend.emailTo(ADMIN_EMAIL)
  assertEquals(admin.subject, `Cancelled: Pat Customer — ${APPOINTMENT_PACIFIC}`)
  assertEquals(admin.reply_to, CUSTOMER_EMAIL)
  assertStringIncludes(admin.html, "Customer moved")
  assertIcs(admin.attachments?.[0], { ...APPOINTMENT_UTC, cancel: true })
})

Deno.test("cancelling an unscheduled appointment has no date and no .ics", async () => {
  const send = await signedIn({ ...APPOINTMENT, appointment_date: null, appointment_time: null })
  await send({ quoteId: QUOTE_ID, mode: "cancel" })

  const customer = resend.emailTo(CUSTOMER_EMAIL)
  assertEquals(customer.attachments, undefined)
  assert(!customer.html.includes("(Pacific)"))

  const admin = resend.emailTo(ADMIN_EMAIL)
  assertEquals(admin.subject, "Cancelled: Pat Customer")
  assertEquals(admin.attachments, undefined)
  assertStringIncludes(admin.html, "No reason given")
})

Deno.test("customer-supplied text is HTML-escaped when scheduling", async () => {
  const send = await signedIn(DANGEROUS_APPOINTMENT)
  await send({ quoteId: QUOTE_ID, mode: "schedule" })

  assertEscaped(resend.emailTo(CUSTOMER_EMAIL).html, ["customer_name", "service", "address"])
  assertEscaped(resend.emailTo(ADMIN_EMAIL).html, ["customer_name", "phone", "service", "property", "address", "message"])
})

Deno.test("customer-supplied text and the reason are HTML-escaped when cancelling", async () => {
  const send = await signedIn(DANGEROUS_APPOINTMENT)
  await send({ quoteId: QUOTE_ID, mode: "cancel", reason: dangerous("reason") })

  assertEscaped(resend.emailTo(CUSTOMER_EMAIL).html, ["customer_name", "service"])
  assertEscaped(resend.emailTo(ADMIN_EMAIL).html, ["reason", "customer_name", "message"])
})

Deno.test("the previous time is HTML-escaped on a reschedule", async () => {
  const send = await signedIn()
  await send({ quoteId: QUOTE_ID, mode: "schedule", previous: { date: dangerous("previous"), time: "14:00" } })
  assertEscaped(resend.emailTo(ADMIN_EMAIL).html, ["previous"])
})

Deno.test("a Resend error is reported per email, and the request still succeeds", async () => {
  const send = await signedIn()
  resend.respond = () => new Response("invalid api key", { status: 401 })
  const res = await send({ quoteId: QUOTE_ID, mode: "schedule" })
  assertEquals(res.status, 200)
  const expected = { sent: false, error: "Resend 401: invalid api key" }
  assertEquals(await readJson(res), { clientEmail: expected, adminEmail: expected })
})

Deno.test("test mode emails only the admin a sample invite", async () => {
  const send = await signedIn()
  const res = await send({ test: true })
  assertEquals(await readJson(res), { adminEmail: { sent: true } })

  assertEquals(resend.emails().map((e) => e.to), [ADMIN_EMAIL])
  const admin = resend.emailTo(ADMIN_EMAIL)
  assert(admin.subject.startsWith("[TEST] Scheduled: Test Customer"))
  assertStringIncludes(admin.subject, "at 10:00 AM (Pacific)")
  assert(admin.attachments?.[0], "expected an .ics attachment")
})
