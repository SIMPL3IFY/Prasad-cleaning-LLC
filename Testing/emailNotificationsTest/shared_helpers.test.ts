// SCRUM-244: _shared/email.ts on its own
import { assert, assertEquals, assertStringIncludes } from "@std/assert"
import {
  ADMIN_EMAIL,
  APPOINTMENT,
  assertIcs,
  icsValue,
  parseIcs,
  QUOTE_ID,
  resend,
  setup,
} from "./helpers.ts"

// Importing through setup() gives email.ts the test environment
async function email() {
  await setup("notify-quote-accepted")
  return await import("../../supabase/functions/_shared/email.ts")
}

Deno.test("escapeHtml escapes all five HTML characters, ampersands first", async () => {
  const { escapeHtml } = await email()
  assertEquals(escapeHtml(`<a href="x" title='y'>&amp;</a>`),
    "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;amp;&lt;/a&gt;")
})

Deno.test("escapeHtml turns null and undefined into an empty string", async () => {
  const { escapeHtml } = await email()
  assertEquals(escapeHtml(null), "")
  assertEquals(escapeHtml(undefined), "")
  assertEquals(escapeHtml(0), "0")
})

const pacificCases: [string | null, string | null, string][] = [
  ["2026-10-14", "09:30", "Wednesday, October 14, 2026 at 9:30 AM (Pacific)"],
  ["2026-10-14", "00:05", "Wednesday, October 14, 2026 at 12:05 AM (Pacific)"],
  ["2026-10-14", "12:00", "Wednesday, October 14, 2026 at 12:00 PM (Pacific)"],
  ["2026-10-14", "17:45:00", "Wednesday, October 14, 2026 at 5:45 PM (Pacific)"],
  ["2026-10-14", null, "2026-10-14"],
  ["next Tuesday", "morning", "next Tuesday morning"],
  [null, null, "TBD"],
]
for (const [date, time, expected] of pacificCases) {
  Deno.test(`formatPacific(${date}, ${time}) gives "${expected}"`, async () => {
    const { formatPacific } = await email()
    assertEquals(formatPacific(date, time), expected)
  })
}

// UTC offset is -7 in daylight time and -8 in standard time. 2026 switches: March 8 and November 1.
const utcCases: [string, string, string, string, string][] = [
  ["daylight time", "2026-10-14", "09:30", "20261014T163000Z", "20261014T183000Z"],
  ["standard time", "2026-01-14", "09:30", "20260114T173000Z", "20260114T193000Z"],
  ["the day daylight time starts", "2026-03-08", "09:00", "20260308T160000Z", "20260308T180000Z"],
  ["the day daylight time ends", "2026-11-01", "09:00", "20261101T170000Z", "20261101T190000Z"],
  ["an evening that crosses midnight UTC", "2026-10-14", "20:00", "20261015T030000Z", "20261015T050000Z"],
]
for (const [name, date, time, start, end] of utcCases) {
  Deno.test(`.ics start and end are correct in UTC on ${name}`, async () => {
    const { buildIcsAttachment } = await email()
    const attachment = buildIcsAttachment(
      { ...APPOINTMENT, appointment_date: date, appointment_time: time },
      { attendee: "a@example.com", title: "Cleaning" },
    )
    assertIcs(attachment ?? undefined, { start, end })
  })
}

Deno.test("the .ics event id comes from the appointment, so updates replace the same event", async () => {
  const { buildIcsAttachment } = await email()
  const lines = parseIcs(buildIcsAttachment(APPOINTMENT, { attendee: "a@example.com", title: "x" })!)
  assertEquals(icsValue(lines, "UID"), `appointment-${QUOTE_ID}@prasadscleaning.com`)
  assertEquals(lines[0], "BEGIN:VCALENDAR")
  assertEquals(lines.at(-1), "END:VCALENDAR")
})

Deno.test("no .ics without a usable date, time or id", async () => {
  const { buildIcsAttachment } = await email()
  const options = { attendee: "a@example.com", title: "x" }
  assertEquals(buildIcsAttachment({ ...APPOINTMENT, appointment_date: null }, options), null)
  assertEquals(buildIcsAttachment({ ...APPOINTMENT, appointment_time: "morning" }, options), null)
  assertEquals(buildIcsAttachment({ ...APPOINTMENT, id: null }, options), null)
})

Deno.test(".ics text is escaped, so customer text can't add calendar properties", async () => {
  const { buildIcsAttachment } = await email()
  const attachment = buildIcsAttachment(
    { ...APPOINTMENT, message: "Hi\nDTSTART:19990101T000000Z", address: "1 Main St, Apt; 2" },
    { attendee: "a@example.com", title: "x" },
  )!
  const lines = parseIcs(attachment)
  assertEquals(lines.filter((l) => l.startsWith("DTSTART")).length, 1)
  assertEquals(icsValue(lines, "LOCATION"), "1 Main St\\, Apt\\; 2")
  assertStringIncludes(icsValue(lines, "DESCRIPTION"), "Hi\\nDTSTART")
})

Deno.test(".ics lines are folded at 75 characters and unfold back to the original", async () => {
  const { buildIcsAttachment } = await email()
  const long = "x".repeat(300)
  const attachment = buildIcsAttachment(
    { ...APPOINTMENT, message: long },
    { attendee: "a@example.com", title: "x" },
  )!
  const raw = new TextDecoder().decode(Uint8Array.from(atob(attachment.content), (c) => c.charCodeAt(0)))
  for (const line of raw.split("\r\n")) assert(line.length <= 75, `line too long: ${line.length}`)
  assertStringIncludes(icsValue(parseIcs(attachment), "DESCRIPTION"), long)
})

Deno.test("non-English text survives the .ics base64 encoding", async () => {
  const { buildIcsAttachment } = await email()
  const attachment = buildIcsAttachment(
    { ...APPOINTMENT, customer_name: "José Nguyễn" },
    { attendee: "a@example.com", title: "x" },
  )!
  assertStringIncludes(icsValue(parseIcs(attachment), "DESCRIPTION"), "José Nguyễn")
})

Deno.test("sendEmail posts to Resend with the API key and drops empty attachments", async () => {
  const { sendEmail } = await email()
  const result = await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>Hi</p>", attachments: [null] })
  assertEquals(result, { sent: true })

  const { headers, email: sent } = resend.requests[0]
  assertEquals(headers.get("Authorization"), "Bearer resend-key")
  assertEquals(sent.reply_to, ADMIN_EMAIL)
  assertEquals(sent.attachments, undefined)
  assertEquals(sent.headers, undefined)
  assertEquals(sent.from, "Prasad's Cleaning Services <notifications@prasadscleaning.com>")
})

Deno.test("sendEmail skips an empty recipient without calling Resend", async () => {
  const { sendEmail } = await email()
  assertEquals(await sendEmail({ to: "", subject: "Hi", html: "" }), { sent: false, skipped: true, error: "no recipient" })
  assertEquals(resend.requests.length, 0)
})

Deno.test("sendEmail reports Resend errors and network failures instead of throwing", async () => {
  const { sendEmail } = await email()
  resend.respond = () => new Response("nope", { status: 422 })
  assertEquals(await sendEmail({ to: "a@example.com", subject: "Hi", html: "" }), { sent: false, error: "Resend 422: nope" })

  resend.respond = () => Promise.reject(new Error("offline"))
  const crashed = await sendEmail({ to: "a@example.com", subject: "Hi", html: "" })
  assertEquals(crashed.sent, false)
  assertStringIncludes(crashed.error ?? "", "offline")
})

