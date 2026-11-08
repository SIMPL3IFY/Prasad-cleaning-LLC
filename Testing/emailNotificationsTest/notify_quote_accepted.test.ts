// SCRUM-244: Emails from notify-quote-accepted (database webhook on accepted_quotes INSERT)
import { assert, assertEquals, assertStringIncludes } from "@std/assert"
import {
  ADMIN_EMAIL,
  APPOINTMENT,
  APPOINTMENT_PACIFIC,
  assertEscaped,
  CUSTOMER_EMAIL,
  CUSTOMER_SUBJECT,
  DANGEROUS_APPOINTMENT,
  readJson,
  resend,
  setup,
  THREAD_REF,
} from "./helpers.ts"

const FN = "notify-quote-accepted"
const UNSCHEDULED = { ...APPOINTMENT, appointment_date: null, appointment_time: null }

Deno.test("a row with no email sends nothing", async () => {
  const call = await setup(FN)
  const res = await call({ body: { record: { ...APPOINTMENT, email: null } } })
  assertEquals(await readJson(res), { skipped: true })
  assertEquals(resend.requests.length, 0)
})

Deno.test("an unscheduled quote emails the customer and the admin", async () => {
  const call = await setup(FN)
  const res = await call({ body: { type: "INSERT", record: UNSCHEDULED } })
  assertEquals(res.status, 200)
  assertEquals(await readJson(res), { clientEmail: { sent: true }, adminEmail: { sent: true } })
  assertEquals(resend.requests.length, 2)

  const customer = resend.emailTo(CUSTOMER_EMAIL)
  assertEquals(customer.subject, CUSTOMER_SUBJECT)
  assertEquals(customer.reply_to, ADMIN_EMAIL)
  assertEquals(customer.headers, { "In-Reply-To": THREAD_REF, "References": THREAD_REF })
  assertStringIncludes(customer.html, "Your quote has been accepted!")
  assertStringIncludes(customer.html, "Hi Pat Customer,")
  assertStringIncludes(customer.html, "We'll email you shortly to confirm")
  assert(!customer.html.includes("(Pacific)"))
  assert(!customer.html.includes("Add to Google Calendar"))

  const admin = resend.emailTo(ADMIN_EMAIL)
  assertEquals(admin.subject, "New job accepted: Pat Customer")
  assertEquals(admin.reply_to, CUSTOMER_EMAIL)
  assertStringIncludes(admin.html, "Not scheduled yet")
  assertStringIncludes(admin.html, "555-555-0100")
})

Deno.test("a scheduled quote shows the Pacific date/time and a calendar link", async () => {
  const call = await setup(FN)
  await call({ body: { record: APPOINTMENT } })

  const customer = resend.emailTo(CUSTOMER_EMAIL)
  assertStringIncludes(customer.html, `<strong>Scheduled:</strong> ${APPOINTMENT_PACIFIC}`)
  assertStringIncludes(customer.html, "Add to Google Calendar")
  assertStringIncludes(customer.html, "dates=20261014T093000/20261014T113000")
  assertStringIncludes(customer.html, "ctz=America%2FLos_Angeles")
  assert(!customer.html.includes("We'll email you shortly"))

  assertStringIncludes(resend.emailTo(ADMIN_EMAIL).html, APPOINTMENT_PACIFIC)
})

Deno.test("customer-supplied text is HTML-escaped in both emails", async () => {
  const call = await setup(FN)
  await call({ body: { record: DANGEROUS_APPOINTMENT } })

  assertEscaped(resend.emailTo(CUSTOMER_EMAIL).html, ["customer_name", "service", "property"])
  assertEscaped(resend.emailTo(ADMIN_EMAIL).html, ["customer_name", "phone", "service", "property", "address", "message"])
})

Deno.test("a missing admin address skips only the admin email", async () => {
  const call = await setup(FN, { env: { ADMIN_NOTIFY_EMAIL: undefined } })
  const res = await call({ body: { record: APPOINTMENT } })
  assertEquals(await readJson(res), {
    clientEmail: { sent: true },
    adminEmail: { sent: false, skipped: true, error: "no recipient" },
  })
  assertEquals(resend.emails().map((e) => e.to), [CUSTOMER_EMAIL])
})

Deno.test("NIGEL_EMAIL is the fallback admin address", async () => {
  const call = await setup(FN, { env: { ADMIN_NOTIFY_EMAIL: undefined, NIGEL_EMAIL: "nigel@example.com" } })
  await call({ body: { record: APPOINTMENT } })
  resend.emailTo("nigel@example.com")
})

Deno.test("a Resend error is reported, and the webhook still gets 200", async () => {
  const call = await setup(FN)
  resend.respond = () => new Response("rate limited", { status: 429 })
  const res = await call({ body: { record: APPOINTMENT } })
  assertEquals(res.status, 200)
  const expected = { sent: false, error: "Resend 429: rate limited" }
  assertEquals(await readJson(res), { clientEmail: expected, adminEmail: expected })
})

Deno.test("a Resend network failure is reported without crashing", async () => {
  const call = await setup(FN)
  resend.respond = () => Promise.reject(new Error("connection reset"))
  const res = await call({ body: { record: APPOINTMENT } })
  assertEquals(res.status, 200)
  const body = await readJson(res)
  assertEquals(body.clientEmail.sent, false)
  assertStringIncludes(body.clientEmail.error, "connection reset")
})
