// SCRUM-244: Emails from notify-appointment-updated (database webhook on accepted_quotes UPDATE)
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
  DANGEROUS_APPOINTMENT,
  readJson,
  resend,
  setup,
  THREAD_REF,
} from "./helpers.ts"

const FN = "notify-appointment-updated"
const OLD = { ...APPOINTMENT, appointment_date: "2026-10-10", appointment_time: "14:00" }
const OLD_PACIFIC = "Saturday, October 10, 2026 at 2:00 PM (Pacific)"
const update = (record: unknown, old_record: unknown = OLD) => ({ body: { type: "UPDATE", record, old_record } })

// Each of these has another email covering it, or nothing the customer needs to hear about
const noEmailCases: [string, { body: unknown }, string][] = [
  ["an INSERT event", { body: { type: "INSERT", record: APPOINTMENT, old_record: OLD } }, "not an UPDATE"],
  ["an unwatched field changing", update({ ...OLD, phone: "555-0000" }), "no relevant changes"],
  ["null becoming an empty string", update({ ...OLD, address: "" }, { ...OLD, address: null }), "no relevant changes"],
  ["the first booking", update(APPOINTMENT, { ...OLD, appointment_date: null, appointment_time: null }), "first booking"],
  ["the date being cleared", update({ ...OLD, appointment_date: null }), "not scheduled"],
  ["a row with no email", update({ ...APPOINTMENT, email: null }), "no email"],
]
for (const [name, options, reason] of noEmailCases) {
  Deno.test(`sends no email for ${name}`, async () => {
    const call = await setup(FN)
    const res = await call(options)
    assertEquals(await readJson(res), { skipped: reason })
    assertEquals(resend.requests.length, 0)
  })
}

Deno.test("a reschedule emails only the customer, with before and after in Pacific time", async () => {
  const call = await setup(FN)
  const res = await call(update(APPOINTMENT))
  assertEquals(res.status, 200)
  assertEquals(await readJson(res), {
    changed: ["appointment_date", "appointment_time"],
    clientEmail: { sent: true },
  })

  assertEquals(resend.emails().map((e) => e.to), [CUSTOMER_EMAIL])
  const email = resend.emailTo(CUSTOMER_EMAIL)
  assertEquals(email.subject, CUSTOMER_SUBJECT)
  assertEquals(email.reply_to, ADMIN_EMAIL)
  assertEquals(email.headers, { "In-Reply-To": THREAD_REF, "References": THREAD_REF })
  assertStringIncludes(email.html, "Your appointment has been updated")
  assertStringIncludes(email.html, OLD_PACIFIC)
  assertStringIncludes(email.html, APPOINTMENT_PACIFIC)
})

Deno.test("the .ics attachment has the new time in UTC", async () => {
  const call = await setup(FN)
  await call(update(APPOINTMENT))

  const lines = assertIcs(resend.emailTo(CUSTOMER_EMAIL).attachments?.[0], APPOINTMENT_UTC)
  assert(lines.includes(`UID:appointment-${APPOINTMENT.id}@prasadscleaning.com`), "same event id, so the calendar updates")
  assert(lines.some((l) => l.endsWith(`mailto:${CUSTOMER_EMAIL}`) && l.startsWith("ATTENDEE")))
})

Deno.test("an address change alone sends an email showing the old and new address", async () => {
  const call = await setup(FN)
  const res = await call(update({ ...OLD, address: "9 New Rd" }))
  assertEquals((await readJson(res)).changed, ["address"])

  const { html } = resend.emailTo(CUSTOMER_EMAIL)
  assertStringIncludes(html, "123 Main St, Sacramento, CA")
  assertStringIncludes(html, "9 New Rd")
})

Deno.test("customer-supplied text is HTML-escaped", async () => {
  const call = await setup(FN)
  await call(update(DANGEROUS_APPOINTMENT, { ...OLD, address: "<script>address_old('x')</script>" }))

  const { html } = resend.emailTo(CUSTOMER_EMAIL)
  assertEscaped(html, ["customer_name", "service", "address"])
  assertStringIncludes(html, "&lt;script&gt;address_old(&#39;x&#39;)&lt;/script&gt;")
})

Deno.test("a Resend error is reported, and the webhook still gets 200", async () => {
  const call = await setup(FN)
  resend.respond = () => new Response("bad gateway", { status: 502 })
  const res = await call(update(APPOINTMENT))
  assertEquals(res.status, 200)
  assertEquals((await readJson(res)).clientEmail, { sent: false, error: "Resend 502: bad gateway" })
})
