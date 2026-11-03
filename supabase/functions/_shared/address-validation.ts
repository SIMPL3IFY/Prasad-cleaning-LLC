// SCRUM-239: Pure address-validation logic (no Deno, network or secrets) so it can be unit tested
// and imported by the React app. Turns a geocoder response into one of four results:
//   verified    the address was found precisely and matches what the customer typed
//   suggestion  the address was found but spelled differently: offer "Did you mean ...?"
//   invalid     not found, or only found roughly (street, city, ZIP): block the quote
//   unavailable the geocoder couldn't answer (timeout, outage, quota): never block the customer
// Keep the geocoder's URL and key name out of this file: the website bundles it.

export type AddressStatus = 'verified' | 'suggestion' | 'invalid' | 'unavailable'

export interface AddressParts {
  street: string
  unit: string
  city: string
  state: string
  zip: string
}

export interface AddressResult {
  status: AddressStatus
  // Why it wasn't verified: 'not_found' | 'low_accuracy' | 'po_box' | 'service_down'
  reason?: string
  // "123 Main St, Apt 4, Sacramento, CA 95814"
  standardized?: string
  // The standardized address split into fields (fills the form when a suggestion is accepted)
  parts?: AddressParts
  accuracy?: number
  accuracyType?: string
}

export const EMPTY_ADDRESS: AddressParts = { street: '', unit: '', city: '', state: 'CA', zip: '' }

export const INVALID_MESSAGE = "We couldn't verify this address. Please check it and try again."

// A match is only trusted when it is this precise: an exact building (rooftop / point) or a house
// number placed on a known street range. Anything rougher (nearest_rooftop_match, intersection,
// street_center, place, county, state) means the house number itself wasn't found.
export const MIN_ACCURACY = 0.9
export const VERIFIED_ACCURACY_TYPES = ['rooftop', 'point', 'range_interpolation']

const US_STATES = new Set(('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE '
  + 'NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR').split(' '))

// "123 Main St, Apt 4, Sacramento, CA 95814"
export function formatAddress(parts: Partial<AddressParts>): string {
  const tail = [parts.state, parts.zip].map((v) => (v ?? '').trim()).filter(Boolean).join(' ')
  return [parts.street, parts.unit, parts.city].map((v) => (v ?? '').trim()).concat(tail).filter(Boolean).join(', ')
}

// Message for the first missing/invalid field, or '' when the address is ready to check
export function addressError(parts: Partial<AddressParts>): string {
  if (!(parts.street ?? '').trim()) return 'Please enter your street address.'
  if (!(parts.city ?? '').trim()) return 'Please enter your city.'
  if (!US_STATES.has((parts.state ?? '').trim().toUpperCase())) return 'Please enter the 2-letter state (for example CA).'
  if (!/^\d{5}$/.test((parts.zip ?? '').trim())) return 'Please enter a 5-digit ZIP code.'
  return ''
}

// Trims and size-caps whatever the browser sent; null when it isn't a usable address
// deno-lint-ignore no-explicit-any
export function cleanParts(raw: any): AddressParts | null {
  if (!raw || typeof raw !== 'object') return null
  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
  const parts = {
    street: text(raw.street, 100),
    unit: text(raw.unit, 30),
    city: text(raw.city, 60),
    state: text(raw.state, 2).toUpperCase(),
    zip: text(raw.zip, 5),
  }
  return addressError(parts) ? null : parts
}

export function isPoBox(street: string): boolean {
  return /^\s*(p\.?\s*o\.?|post\s+office)\s*box\b/i.test(street ?? '')
}

// Spelled-out words → postal abbreviations, so "123 Main Street" matches "123 Main St"
const ABBREVIATIONS: Record<string, string> = {
  street: 'st', avenue: 'ave', av: 'ave', boulevard: 'blvd', drive: 'dr', road: 'rd', lane: 'ln',
  court: 'ct', circle: 'cir', place: 'pl', parkway: 'pkwy', highway: 'hwy', terrace: 'ter',
  trail: 'trl', square: 'sq', expressway: 'expy', freeway: 'fwy',
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
}

// Lowercase, no punctuation, abbreviations applied: "123 N. Main Street" → "123 n main st"
export function normalizeText(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ABBREVIATIONS[token] ?? token)
    .join(' ')
}

// True when the geocoder found what the customer typed (apart from casing, punctuation and
// abbreviations). The unit isn't compared: geocoders often drop it, and it's kept as typed.
export function isSameAddress(input: AddressParts, found: AddressParts): boolean {
  return normalizeText(input.street) === normalizeText(found.street)
    && normalizeText(input.city) === normalizeText(found.city)
    && input.state.toUpperCase() === found.state.toUpperCase()
    && input.zip.slice(0, 5) === found.zip.slice(0, 5)
}

// address_components → our fields. The customer's unit is kept when the geocoder returns none.
// deno-lint-ignore no-explicit-any
export function partsFromComponents(components: any, input: AddressParts): AddressParts {
  const c = components ?? {}
  const streetName = c.formatted_street
    ?? [c.predirectional, c.street, c.suffix, c.postdirectional].filter(Boolean).join(' ')
  const unit = [c.unit_type, c.unit_number].filter(Boolean).join(' ')
  return {
    street: [c.number, streetName].filter(Boolean).join(' '),
    unit: unit || input.unit,
    city: c.city ?? '',
    state: c.state_province ?? c.state ?? '',
    zip: c.postal_code ?? c.zip ?? '',
  }
}

export function unavailableResult(): AddressResult {
  return { status: 'unavailable', reason: 'service_down' }
}

export function invalidResult(reason = 'not_found'): AddressResult {
  return { status: 'invalid', reason }
}

// Successful (200) geocode response → result
// deno-lint-ignore no-explicit-any
export function classifyGeocodeResponse(response: any, input: AddressParts): AddressResult {
  // A cleaner can't go to a PO box
  if (isPoBox(input.street)) return invalidResult('po_box')

  const best = response?.results?.[0]
  if (!best) return invalidResult('not_found')

  const accuracy = Number(best.accuracy ?? 0)
  const accuracyType = String(best.accuracy_type ?? '')
  if (accuracy < MIN_ACCURACY || !VERIFIED_ACCURACY_TYPES.includes(accuracyType)) {
    return { ...invalidResult('low_accuracy'), accuracy, accuracyType }
  }

  const parts = partsFromComponents(best.address_components, input)
  return {
    status: isSameAddress(input, parts) ? 'verified' : 'suggestion',
    standardized: formatAddress(parts),
    parts,
    accuracy,
    accuracyType,
  }
}

// Failed geocode response → result. 422 means the geocoder couldn't parse or find the address
// (the customer's problem). Everything else (bad/missing key 401/403, daily free limit used up 403,
// rate limit 429, server errors 5xx) is on our side, so the customer is never blocked by it.
export function classifyGeocodeError(status: number): AddressResult {
  return status === 422 ? invalidResult('not_found') : unavailableResult()
}
