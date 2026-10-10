// SCRUM-211: A link is valid for only one accepted appointment and for 30 days
// after its current scheduled start. Rescheduling does not break an emailed link.
const encoder = new TextEncoder()
const TIMEZONE = "America/Los_Angeles"


function bytesBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

export type ReviewAppointment = {
  id: string
  appointment_date: string | null
  appointment_time: string | null
  email: string
  status: string
}

function offsetAt(instant: number): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant)).map(({ type, value }) => [type, value]))
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
    +parts.hour, +parts.minute, +parts.second)
  return wall - instant
}

export function appointmentStart(record: ReviewAppointment): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(record.appointment_date || "")
  const t = /^(\d{1,2}):(\d{2})/.exec(record.appointment_time || "")
  if (!d || !t || +t[1] > 23 || +t[2] > 59) return null
  const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2])
  let utc = wall - offsetAt(wall)
  utc = wall - offsetAt(utc)
  return utc
}

async function key(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", bytesBuffer(encoder.encode(secret)),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

function payload(record: ReviewAppointment): ArrayBuffer {
  return bytesBuffer(encoder.encode(`scrum-211:${record.id}:${record.email.trim().toLowerCase()}`))
}

export async function makeReviewToken(record: ReviewAppointment, secret: string): Promise<string> {
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), payload(record)))
  const encoded = btoa(String.fromCharCode(...signature)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return `${record.id}.${encoded}`
}

export async function validReviewToken(token: string, record: ReviewAppointment, secret: string): Promise<boolean> {
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!match || match[1] !== record.id) return false
  try {
    const raw = atob(match[2].replace(/-/g, "+").replace(/_/g, "/") + "=")
    const signature = Uint8Array.from(Array.from(raw, (character) => character.charCodeAt(0)))
    return await crypto.subtle.verify("HMAC", await key(secret), bytesBuffer(signature), payload(record))
  } catch {
    return false
  }
}