// SCRUM-244: Shared setup for the email notification tests. See "Email notification tests" in Testing/README.md.
import { assert, assertEquals, assertStringIncludes } from "@std/assert"
import { type Handler, served } from "./fake_serve.ts"
import { db } from "./fake_supabase.ts"

export { db }

export const ADMIN_EMAIL = "admin@example.com"
export const CUSTOMER_EMAIL = "customer@example.com"
export const CRON_SECRET = "cron-secret"
export const LINK_SECRET = "link-secret"
export const QUOTE_ID = "11111111-1111-4111-8111-111111111111"

const BASE_ENV: Record<string, string> = {
  SUPABASE_URL: "https://fake.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  RESEND_API_KEY: "resend-key",
  ADMIN_NOTIFY_EMAIL: ADMIN_EMAIL,
  REVIEW_CRON_SECRET: CRON_SECRET,
  REVIEW_LINK_SECRET: LINK_SECRET,
  REVIEW_SITE_URL: "https://site.example.com/",
}

const ALL_VARS = [...Object.keys(BASE_ENV), "NIGEL_EMAIL", "RESEND_FROM_EMAIL", "REVIEW_TEST_EMAIL"]

// Function output would bury the test report. Tests check the responses instead.
console.log = () => {}
console.warn = () => {}
console.error = () => {}

// ---- Fake Resend. All fetches land here, and anything but Resend fails the test. ----

export type SentEmail = {
  from: string
  to: string
  subject: string
  html: string
  reply_to?: string
  headers?: Record<string, string>
  attachments?: { filename: string; content: string; content_type?: string }[]
}

export const resend = {
  requests: [] as { headers: Headers; email: SentEmail }[],
  respond: (): Response | Promise<Response> => new Response(JSON.stringify({ id: "email-id" }), { status: 200 }),
  reset() {
    resend.requests = []
    resend.respond = () => new Response(JSON.stringify({ id: "email-id" }), { status: 200 })
  },
  emails: () => resend.requests.map((r) => r.email),
  emailTo: (to: string) => {
    const matches = resend.emails().filter((e) => e.to === to)
    assertEquals(matches.length, 1, `expected exactly one email to ${to}`)
    return matches[0]
  },
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url !== "https://api.resend.com/emails") throw new Error(`Unexpected fetch in a test: ${url}`)
  resend.requests.push({ headers: new Headers(init?.headers), email: JSON.parse(String(init?.body)) })
  return await resend.respond()
}) as typeof fetch

// ---- Loading a function ----

type EnvOverrides = Record<string, string | undefined>

function applyEnv(overrides: EnvOverrides) {
  for (const name of ALL_VARS) Deno.env.delete(name)
  for (const [name, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value !== undefined) Deno.env.set(name, value)
  }
}

let sharedEnv: EnvOverrides = {}
let sharedEmailLoaded = false
let loadCount = 0
const realDateNow = Date.now

// _shared/email.ts reads its settings once on import, and Deno runs each test file separately.
// So a file that needs different shared settings (no Resend key) calls this before anything else.
export function useSharedEnv(overrides: EnvOverrides) {
  if (sharedEmailLoaded) throw new Error("useSharedEnv must run before the first setup()")
  sharedEnv = overrides
}

export type FunctionName =
  | "notify-quote-accepted"
  | "notify-appointment-updated"
  | "sync-appointment"
  | "send-review-invites"

type RequestOptions = { headers?: Record<string, string>; body?: unknown }

// Resets the fakes, sets the environment, then loads a fresh copy of the function so its
// top-level Deno.env reads see that environment. Pass now to freeze Date.now().
export async function setup(name: FunctionName, options: { env?: EnvOverrides; now?: string } = {}) {
  db.reset()
  resend.reset()
  Date.now = options.now ? () => Date.parse(options.now!) : realDateNow

  if (!sharedEmailLoaded) {
    applyEnv(sharedEnv)
    await import("../../supabase/functions/_shared/email.ts")
    sharedEmailLoaded = true
  }

  applyEnv({ ...sharedEnv, ...options.env })
  served.handler = null
  await import(`../../supabase/functions/${name}/index.ts?load=${++loadCount}`)
  const handler = served.handler as Handler | null // TypeScript can't see the import above setting this
  assert(handler, `${name} did not call serve()`)

  return async ({ headers, body }: RequestOptions = {}) => {
    return await handler(new Request(`https://fake.supabase.co/functions/v1/${name}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }))
  }
}

export const readJson = async (res: Response) => await res.json()

// ---- Email content helpers ----

// One payload per field, so a test shows exactly which field went in unescaped
export const dangerous = (field: string) => `<script>${field}("x" & 'y')</script>`
export const dangerousEscaped = (field: string) =>
  `&lt;script&gt;${field}(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;`

export function assertEscaped(html: string, fields: string[]) {
  for (const field of fields) {
    assertStringIncludes(html, dangerousEscaped(field))
    assert(!html.includes(dangerous(field)), `${field} went into the email unescaped`)
  }
  assert(!/<script/i.test(html), "the email body contains a raw <script> tag")
}

// Decodes a Resend .ics attachment into its unfolded lines
export function parseIcs(attachment: { content: string }): string[] {
  const bytes = Uint8Array.from(atob(attachment.content), (c) => c.charCodeAt(0))
  const text = new TextDecoder().decode(bytes)
  assert(text.endsWith("\r\n"), ".ics must end with CRLF")
  return text.replace(/\r\n /g, "").split("\r\n").filter(Boolean)
}

export function icsValue(lines: string[], property: string): string {
  const prefix = `${property}:`
  const line = lines.find((l) => l.startsWith(prefix))
  assert(line, `.ics has no ${property}`)
  return line.slice(prefix.length)
}

// Valid start/end in UTC, 2 hours apart, and the method + status that go together
export function assertIcs(
  attachment: { filename: string; content: string; content_type?: string } | undefined,
  { start, end, cancel = false }: { start: string; end: string; cancel?: boolean },
) {
  assert(attachment, "expected an .ics attachment")
  assertEquals(attachment.filename, cancel ? "cancelled-appointment.ics" : "appointment.ics")
  assertStringIncludes(attachment.content_type ?? "", `method=${cancel ? "CANCEL" : "REQUEST"}`)

  const lines = parseIcs(attachment)
  assertEquals(icsValue(lines, "DTSTART"), start)
  assertEquals(icsValue(lines, "DTEND"), end)
  assert(/^\d{8}T\d{6}Z$/.test(icsValue(lines, "DTSTART")), "DTSTART must be UTC")
  assert(/^\d{8}T\d{6}Z$/.test(icsValue(lines, "DTEND")), "DTEND must be UTC")
  assertEquals(icsValue(lines, "METHOD"), cancel ? "CANCEL" : "REQUEST")
  assertEquals(icsValue(lines, "STATUS"), cancel ? "CANCELLED" : "CONFIRMED")
  return lines
}

// A scheduled appointment: Wednesday October 14, 2026 at 9:30 AM Pacific = 16:30 UTC
export const APPOINTMENT = {
  id: QUOTE_ID,
  customer_name: "Pat Customer",
  email: CUSTOMER_EMAIL,
  phone: "555-555-0100",
  service: "Deep Cleaning",
  property: "House",
  address: "123 Main St, Sacramento, CA",
  appointment_date: "2026-10-14",
  appointment_time: "09:30",
  message: "Please use the side door",
  status: "accepted",
}
export const APPOINTMENT_PACIFIC = "Wednesday, October 14, 2026 at 9:30 AM (Pacific)"
export const APPOINTMENT_UTC = { start: "20261014T163000Z", end: "20261014T183000Z" }
export const CUSTOMER_SUBJECT = "Your Deep Cleaning appointment with Prasad's Cleaning Services"
export const THREAD_REF = `<appointment-${QUOTE_ID}@prasadscleaning.com>`

export const DANGEROUS_APPOINTMENT = {
  ...APPOINTMENT,
  customer_name: dangerous("customer_name"),
  phone: dangerous("phone"),
  service: dangerous("service"),
  property: dangerous("property"),
  address: dangerous("address"),
  message: dangerous("message"),
}
