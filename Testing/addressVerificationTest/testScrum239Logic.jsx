// SCRUM-239: Address verification testing
// Automated tests for the shared rules that decide whether an address is real.
// This logic is pure (no network or database), so nothing is mocked here.

import { describe, it, expect } from 'vitest'
import {
  addressError,
  classifyGeocodeError,
  classifyGeocodeResponse,
  cleanParts,
  formatAddress,
  isPoBox,
  isSameAddress,
  normalizeText,
  partsFromComponents,
} from '../../supabase/functions/_shared/address-validation.ts'

const ADDRESS = { street: '123 Main St', unit: '', city: 'Sacramento', state: 'CA', zip: '95814' }

// Helper: a successful geocoder response with one result, close to what Geocodio sends back
function geocodeResponse(overrides = {}, components = {}) {
  return {
    results: [{
      accuracy: 1,
      accuracy_type: 'rooftop',
      address_components: {
        number: '123',
        formatted_street: 'Main St',
        city: 'Sacramento',
        state: 'CA',
        zip: '95814',
        ...components,
      },
      ...overrides,
    }],
  }
}

// SCRUM-239 AC: Addresses are saved in one consistent format.
describe('formatAddress', () => {
  it('joins every part of the address', () => {
    expect(formatAddress({ ...ADDRESS, unit: 'Apt 4' })).toBe('123 Main St, Apt 4, Sacramento, CA 95814')
  })

  it('leaves out an empty unit', () => {
    expect(formatAddress(ADDRESS)).toBe('123 Main St, Sacramento, CA 95814')
  })

  it('trims extra spaces around each part', () => {
    expect(formatAddress({ ...ADDRESS, street: '  123 Main St  ', city: ' Sacramento ' })).toBe('123 Main St, Sacramento, CA 95814')
  })
})

// SCRUM-239 AC: Incomplete addresses are caught before any lookup is made.
describe('addressError', () => {
  it('accepts a complete address', () => {
    expect(addressError(ADDRESS)).toBe('')
  })

  it.each([
    ['street', { street: '   ' }, 'Please enter your street address.'],
    ['city', { city: '' }, 'Please enter your city.'],
    ['state', { state: 'ZZ' }, 'Please enter the 2-letter state (for example CA).'],
    ['short ZIP', { zip: '9581' }, 'Please enter a 5-digit ZIP code.'],
    ['long ZIP', { zip: '958141' }, 'Please enter a 5-digit ZIP code.'],
    ['ZIP with letters', { zip: '9581a' }, 'Please enter a 5-digit ZIP code.'],
  ])('rejects a bad %s', (_label, change, message) => {
    expect(addressError({ ...ADDRESS, ...change })).toBe(message)
  })

  it.each(['CA', 'ca', 'DC', 'PR'])('accepts the state %s', (state) => {
    expect(addressError({ ...ADDRESS, state })).toBe('')
  })
})

// SCRUM-239 AC: The server only looks up clean, size-limited input.
describe('cleanParts', () => {
  it.each([
    ['null', null],
    ['a string', '123 Main St'],
    ['an empty object', {}],
  ])('returns null for %s', (_label, raw) => {
    expect(cleanParts(raw)).toBeNull()
  })

  it('returns null when a field is invalid', () => {
    expect(cleanParts({ ...ADDRESS, zip: 'abc' })).toBeNull()
  })

  it('trims and collapses whitespace', () => {
    expect(cleanParts({ ...ADDRESS, street: '  123   Main  St ', city: ' Sacramento ' })).toEqual(ADDRESS)
  })

  it('uppercases the state', () => {
    expect(cleanParts({ ...ADDRESS, state: 'ca' }).state).toBe('CA')
  })

  it('caps the length of each field', () => {
    const parts = cleanParts({
      street: 'a'.repeat(150),
      unit: 'b'.repeat(50),
      city: 'c'.repeat(100),
      state: 'CAL',
      zip: '958141234',
    })

    expect(parts.street).toHaveLength(100)
    expect(parts.unit).toHaveLength(30)
    expect(parts.city).toHaveLength(60)
    expect(parts.state).toBe('CA')
    expect(parts.zip).toBe('95814')
  })
})

// SCRUM-239 AC: PO boxes are rejected because a cleaner can't go to one.
describe('isPoBox', () => {
  it.each(['PO Box 12', 'po box 12', 'P.O. Box 12', 'P O Box 12', 'Post Office Box 12'])('detects "%s"', (street) => {
    expect(isPoBox(street)).toBe(true)
  })

  it.each(['123 Box Elder Rd', '123 Main St', ''])('does not flag "%s"', (street) => {
    expect(isPoBox(street)).toBe(false)
  })
})

// SCRUM-239 AC: Small spelling differences don't count as a different address.
describe('normalizeText', () => {
  it('lowercases, removes punctuation and applies abbreviations', () => {
    expect(normalizeText('123 N. Main Street')).toBe('123 n main st')
  })

  it('handles a missing value', () => {
    expect(normalizeText(null)).toBe('')
  })
})

describe('isSameAddress', () => {
  it.each([
    ['spelled-out street type', { street: '123 Main Street' }],
    ['different casing', { street: '123 MAIN ST', city: 'SACRAMENTO', state: 'ca' }],
    ['a unit the geocoder dropped', { unit: 'Apt 4' }],
  ])('matches with %s', (_label, change) => {
    expect(isSameAddress({ ...ADDRESS, ...change }, ADDRESS)).toBe(true)
  })

  it('matches a spelled-out direction', () => {
    expect(isSameAddress({ ...ADDRESS, street: '123 North Main St' }, { ...ADDRESS, street: '123 N Main St' })).toBe(true)
  })

  it('compares only the first 5 digits of the ZIP', () => {
    expect(isSameAddress(ADDRESS, { ...ADDRESS, zip: '95814-1234' })).toBe(true)
  })

  it.each([
    ['street', { street: '124 Main St' }],
    ['city', { city: 'Davis' }],
    ['state', { state: 'NV' }],
    ['ZIP', { zip: '95815' }],
  ])('does not match a different %s', (_label, change) => {
    expect(isSameAddress(ADDRESS, { ...ADDRESS, ...change })).toBe(false)
  })
})

// SCRUM-239 AC: The geocoder's answer is mapped onto the form's address fields.
describe('partsFromComponents', () => {
  it('prefers formatted_street', () => {
    const parts = partsFromComponents({ number: '123', formatted_street: 'N Main St', street: 'Ignored' }, ADDRESS)

    expect(parts.street).toBe('123 N Main St')
  })

  it('builds the street from its pieces when formatted_street is missing', () => {
    const parts = partsFromComponents({ number: '123', predirectional: 'N', street: 'Main', suffix: 'St', postdirectional: 'W' }, ADDRESS)

    expect(parts.street).toBe('123 N Main St W')
  })

  it('reads state_province and postal_code as well as state and zip', () => {
    const parts = partsFromComponents({ state_province: 'CA', postal_code: '95814' }, ADDRESS)

    expect(parts.state).toBe('CA')
    expect(parts.zip).toBe('95814')
  })

  it('uses the unit from the geocoder when it returns one', () => {
    const parts = partsFromComponents({ unit_type: 'Apt', unit_number: '4' }, { ...ADDRESS, unit: 'Unit 9' })

    expect(parts.unit).toBe('Apt 4')
  })

  it('keeps the unit the customer typed when the geocoder returns none', () => {
    const parts = partsFromComponents({ number: '123' }, { ...ADDRESS, unit: 'Apt 4' })

    expect(parts.unit).toBe('Apt 4')
  })

  it('does not crash when the components are missing', () => {
    expect(partsFromComponents(null, { ...ADDRESS, unit: 'Apt 4' })).toEqual({
      street: '',
      unit: 'Apt 4',
      city: '',
      state: '',
      zip: '',
    })
  })
})

// SCRUM-239 AC: Only an address found precisely counts as real.
describe('classifyGeocodeResponse', () => {
  it.each(['rooftop', 'point', 'range_interpolation'])('verifies a matching %s result', (accuracyType) => {
    const result = classifyGeocodeResponse(geocodeResponse({ accuracy_type: accuracyType }), ADDRESS)

    expect(result).toMatchObject({
      status: 'verified',
      standardized: '123 Main St, Sacramento, CA 95814',
      accuracy: 1,
      accuracyType,
    })
  })

  it('accepts an accuracy of exactly 0.9', () => {
    expect(classifyGeocodeResponse(geocodeResponse({ accuracy: 0.9 }), ADDRESS).status).toBe('verified')
  })

  it('verifies when only the spelling style differs', () => {
    const result = classifyGeocodeResponse(geocodeResponse(), { ...ADDRESS, street: '123 Main Street' })

    expect(result.status).toBe('verified')
    expect(result.standardized).toBe('123 Main St, Sacramento, CA 95814')
  })

  it('suggests the corrected address when it is spelled differently', () => {
    const result = classifyGeocodeResponse(geocodeResponse(), { ...ADDRESS, street: '123 Mian St' })

    expect(result.status).toBe('suggestion')
    expect(result.standardized).toBe('123 Main St, Sacramento, CA 95814')
    expect(result.parts).toEqual(ADDRESS)
  })

  it('suggests the corrected address when the ZIP is different', () => {
    const result = classifyGeocodeResponse(geocodeResponse(), { ...ADDRESS, zip: '95815' })

    expect(result.status).toBe('suggestion')
    expect(result.parts.zip).toBe('95814')
  })

  it('keeps the customer\'s unit in the standardized address', () => {
    const result = classifyGeocodeResponse(geocodeResponse(), { ...ADDRESS, unit: 'Apt 4' })

    expect(result.standardized).toBe('123 Main St, Apt 4, Sacramento, CA 95814')
  })

  it('rejects a PO box even when the geocoder finds it', () => {
    const result = classifyGeocodeResponse(geocodeResponse(), { ...ADDRESS, street: 'PO Box 12' })

    expect(result).toEqual({ status: 'invalid', reason: 'po_box' })
  })

  it.each([
    ['no results', { results: [] }],
    ['an empty response', null],
  ])('rejects %s as not found', (_label, response) => {
    expect(classifyGeocodeResponse(response, ADDRESS)).toEqual({ status: 'invalid', reason: 'not_found' })
  })

  it('rejects an accuracy just under 0.9', () => {
    expect(classifyGeocodeResponse(geocodeResponse({ accuracy: 0.89 }), ADDRESS)).toEqual({
      status: 'invalid',
      reason: 'low_accuracy',
      accuracy: 0.89,
      accuracyType: 'rooftop',
    })
  })

  it.each(['nearest_rooftop_match', 'intersection', 'street_center', 'place', 'county', 'state'])('rejects a rough %s match', (accuracyType) => {
    const result = classifyGeocodeResponse(geocodeResponse({ accuracy_type: accuracyType }), ADDRESS)

    expect(result).toMatchObject({ status: 'invalid', reason: 'low_accuracy', accuracyType })
  })

  it('rejects a result with no accuracy details', () => {
    const result = classifyGeocodeResponse(geocodeResponse({ accuracy: undefined, accuracy_type: undefined }), ADDRESS)

    expect(result).toMatchObject({ status: 'invalid', reason: 'low_accuracy', accuracy: 0 })
  })
})

// SCRUM-239 AC: A geocoder problem on our side never blocks the customer.
describe('classifyGeocodeError', () => {
  it('treats a 422 as an address that was not found', () => {
    expect(classifyGeocodeError(422)).toEqual({ status: 'invalid', reason: 'not_found' })
  })

  it.each([401, 403, 429, 500, 503])('treats a %i as the service being unavailable', (status) => {
    expect(classifyGeocodeError(status)).toEqual({ status: 'unavailable', reason: 'service_down' })
  })
})
