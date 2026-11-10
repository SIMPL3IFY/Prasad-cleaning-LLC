// Security fix: notify-quote-accepted and notify-appointment-updated only accept calls that
// carry the database webhook's secret, so nobody else can make them send customer emails.
import { assertEquals } from "@std/assert"
import { APPOINTMENT, readJson, resend, setup, type FunctionName } from "./helpers.ts"

const CASES: { fn: FunctionName; body: unknown }[] = [
  { fn: "notify-quote-accepted", body: { type: "INSERT", record: APPOINTMENT } },
  {
    fn: "notify-appointment-updated",
    body: { type: "UPDATE", record: APPOINTMENT, old_record: { ...APPOINTMENT, appointment_time: "14:00" } },
  },
]

for (const { fn, body } of CASES) {
  Deno.test(`${fn} rejects a call with no webhook secret and sends nothing`, async () => {
    const call = await setup(fn)
    const res = await call({ headers: { "x-webhook-secret": "" }, body })
    assertEquals(res.status, 401)
    assertEquals(await readJson(res), { error: "Unauthorized" })
    assertEquals(resend.requests.length, 0)
  })

  Deno.test(`${fn} rejects a wrong webhook secret and sends nothing`, async () => {
    const call = await setup(fn)
    const res = await call({ headers: { "x-webhook-secret": "wrong" }, body })
    assertEquals(res.status, 401)
    assertEquals(resend.requests.length, 0)
  })

  Deno.test(`${fn} rejects every call when WEBHOOK_SECRET isn't configured`, async () => {
    const call = await setup(fn, { env: { WEBHOOK_SECRET: undefined } })
    const res = await call({ body })
    assertEquals(res.status, 401)
    assertEquals(resend.requests.length, 0)
  })
}

Deno.test("a list of recipients is refused, so one call can't email many people", async () => {
  const call = await setup("notify-quote-accepted")
  const res = await call({ body: { record: { ...APPOINTMENT, email: ["a@example.com", "b@example.com"] } } })
  assertEquals(res.status, 200)
  assertEquals((await readJson(res)).clientEmail, { sent: false, skipped: true, error: "invalid recipient" })
  assertEquals(resend.emails().some((e) => Array.isArray(e.to)), false)
})
