// SCRUM-239: Checks a customer's address for the quote form with Geocodio. It only answers
// "is this address real?" and never reads or writes the database (the quote form saves the quote).
// The Geocodio key lives only in the GEOCODIO_API_KEY Supabase secret: it is never sent to the
// browser or logged, and full addresses are never logged either.
//
// POST body: { address: { street, unit, city, state, zip }, website: '' }   (website = honeypot)
// Answer:    { result: { status, reason?, standardized?, parts?, accuracy?, accuracyType? } }
//   status: verified | suggestion ("Did you mean ...?") | invalid (block) | unavailable (save anyway)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import {
  classifyGeocodeError,
  classifyGeocodeResponse,
  cleanParts,
  unavailableResult,
  type AddressParts,
  type AddressResult,
} from "../_shared/address-validation.ts"

const GEOCODIO_URL = "https://api.geocod.io/v2.1/geocode"
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean)

const TIMEOUT_MS = 5000
// Best-effort limit per IP, kept in memory (resets when Supabase restarts the function).
// Protects the free 2,500 lookups/day from someone hammering the form.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000
const callsByIp = new Map<string, number[]>()

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? ""
  const allow = ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  })
}

function overRateLimit(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
  const now = Date.now()
  const recent = (callsByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  callsByIp.set(ip, recent)
  return false
}

async function geocode(parts: AddressParts): Promise<AddressResult> {
  const apiKey = Deno.env.get("GEOCODIO_API_KEY") ?? ""
  if (!apiKey) {
    console.error("SCRUM-239: GEOCODIO_API_KEY secret is not set")
    return unavailableResult()
  }

  const params = new URLSearchParams({
    street: parts.street,
    city: parts.city,
    state_province: parts.state,
    postal_code: parts.zip,
    country: "US",
    limit: "1",
  })
  if (parts.unit) params.set("street2", parts.unit)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // Key goes in a header, not the URL, so it can't end up in any URL log
    const res = await fetch(`${GEOCODIO_URL}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: controller.signal,
    })
    if (!res.ok) {
      // Status only: the error body can echo the address back
      console.error("SCRUM-239: Geocodio responded", res.status)
      return classifyGeocodeError(res.status)
    }
    return classifyGeocodeResponse(await res.json(), parts)
  } catch (err) {
    console.error("SCRUM-239: Geocodio call failed", err instanceof Error ? err.name : "unknown")
    return unavailableResult()
  } finally {
    clearTimeout(timer)
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) })
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405)

  try {
    const body = await req.json()
    // Honeypot: a hidden field people never see, so only bots fill it in
    if (typeof body.website === "string" && body.website.trim()) return json(req, { error: "Invalid request" }, 400)
    const parts = cleanParts(body.address)
    if (!parts) return json(req, { error: "Invalid address" }, 400)
    if (overRateLimit(req)) return json(req, { error: "Too many requests. Please wait a minute and try again." }, 429)

    return json(req, { result: await geocode(parts) })
  } catch (err) {
    console.error("SCRUM-239: validate-address crashed", err instanceof Error ? err.name : "unknown")
    return json(req, { error: "Server error" }, 500)
  }
})
