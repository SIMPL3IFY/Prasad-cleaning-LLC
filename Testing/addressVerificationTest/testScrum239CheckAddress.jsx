// SCRUM-239: Address verification testing
// Automated tests for checkAddress, the browser's call to the validate-address Edge Function.

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { checkAddress, INVALID_MESSAGE } from '../../src/lib/addressValidation'

// Supabase is mocked because the Edge Function would otherwise spend a real address lookup.
const { supabase } = vi.hoisted(() => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const ADDRESS = { street: '123 Main St', unit: '', city: 'Sacramento', state: 'CA', zip: '95814' }

// Helper: the error supabase-js returns when the function answers with a failing status
function httpError(status, json = async () => ({})) {
  return { data: null, error: { name: 'FunctionsHttpError', context: { status, json } } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// SCRUM-239 AC: The address is sent to the Edge Function for checking.
describe('Sending the address', () => {
  it('sends the address parts and the honeypot value', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { result: { status: 'verified' } }, error: null })

    await checkAddress(ADDRESS, 'bot-value')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('validate-address', {
      body: { address: ADDRESS, website: 'bot-value' },
    })
  })

  it('sends an empty honeypot by default', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { result: { status: 'verified' } }, error: null })

    await checkAddress(ADDRESS)

    expect(supabase.functions.invoke).toHaveBeenCalledWith('validate-address', {
      body: { address: ADDRESS, website: '' },
    })
  })

  it('returns the result of the check', async () => {
    const result = { status: 'suggestion', standardized: '123 Main St, Sacramento, CA 95814' }
    supabase.functions.invoke.mockResolvedValue({ data: { result }, error: null })

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ result })
  })
})

// SCRUM-239 AC: If the check can't run, the caller is told it is an outage so the customer isn't blocked.
describe('Outages', () => {
  it('reports an outage when the call throws', async () => {
    supabase.functions.invoke.mockRejectedValue(new Error('network down'))

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ outage: true })
  })

  it('reports an outage when the response has no result', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null })

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ outage: true })
  })

  it('reports an outage for a fetch or relay error', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', context: {} } })

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ outage: true })
  })

  it('reports an outage when an HTTP error has no response', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError' } })

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ outage: true })
  })

  it.each([404, 500, 503])('reports an outage for a %i', async (status) => {
    supabase.functions.invoke.mockResolvedValue(httpError(status))

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ outage: true })
  })
})

// SCRUM-239 AC: If the function refuses the request, the customer sees a message.
describe('Refused requests', () => {
  it('shows the server\'s message for a 429', async () => {
    const message = 'Too many requests. Please wait a minute and try again.'
    supabase.functions.invoke.mockResolvedValue(httpError(429, async () => ({ error: message })))

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ error: message })
  })

  it('falls back to the standard message for a 429 with no message', async () => {
    supabase.functions.invoke.mockResolvedValue(httpError(429))

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ error: INVALID_MESSAGE })
  })

  it('shows the standard message for a 400, not the server\'s wording', async () => {
    supabase.functions.invoke.mockResolvedValue(httpError(400, async () => ({ error: 'Invalid address' })))

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ error: INVALID_MESSAGE })
  })

  it('shows the standard message when the response body is not JSON', async () => {
    supabase.functions.invoke.mockResolvedValue(httpError(400, async () => {
      throw new SyntaxError('Unexpected token')
    }))

    await expect(checkAddress(ADDRESS)).resolves.toEqual({ error: INVALID_MESSAGE })
  })
})
