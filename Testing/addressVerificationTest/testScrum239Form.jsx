// SCRUM-239: Address verification testing
// Automated tests for how the quote form reacts to each result of the address check.

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AddressFields from '../../src/components/AddressFields'
import AddressSuggestion from '../../src/components/AddressSuggestion'
import QuoteForm from '../../src/components/QuoteForm'

// Supabase is mocked so tests never hit the real database or spend a real address lookup.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const STANDARDIZED = '123 Main St, Sacramento, CA 95814'
const AS_TYPED = '123 main street, Sacramento, CA 95814'
const SUCCESS_TEXT = /we've received your quote request/i
const INVALID_TEXT = "We couldn't verify this address. Please check it and try again."

const SUGGESTION = {
  status: 'suggestion',
  standardized: STANDARDIZED,
  parts: { street: '123 Main St', unit: '', city: 'Sacramento', state: 'CA', zip: '95814' },
}

// Helper: fakes the address check and the quotes table
function mockSupabase({
  check = { data: { result: { status: 'verified', standardized: STANDARDIZED } }, error: null },
  insertResult = { error: null },
} = {}) {
  const insert = vi.fn().mockResolvedValue(insertResult)
  supabase.from.mockReturnValue({ insert })
  supabase.functions.invoke.mockResolvedValue(check)
  return { insert }
}

// Helper: the result of a check that ran
function checkResult(result) {
  return { data: { result }, error: null }
}

// Helper: fill every required field (the state defaults to CA)
async function fillQuoteForm(overrides = {}) {
  const values = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9161234567',
    street: '123 main street',
    city: 'Sacramento',
    zip: '95814',
    message: 'Please clean my kitchen.',
    ...overrides,
  }
  await userEvent.type(screen.getByPlaceholderText('Name'), values.name)
  await userEvent.type(screen.getByPlaceholderText('Email'), values.email)
  await userEvent.type(screen.getByPlaceholderText('Phone'), values.phone)
  await userEvent.type(screen.getByPlaceholderText('Street address'), values.street)
  await userEvent.type(screen.getByPlaceholderText('City'), values.city)
  await userEvent.type(screen.getByPlaceholderText('ZIP'), values.zip)
  await userEvent.selectOptions(screen.getByDisplayValue('Select property type'), 'Residential')
  await userEvent.selectOptions(screen.getByDisplayValue('Select service type'), 'Deep Cleaning')
  await userEvent.type(screen.getByPlaceholderText('How can we help?'), values.message)
}

function submitQuoteForm() {
  fireEvent.submit(screen.getByPlaceholderText('Name').closest('form'))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// SCRUM-239 AC: The address fields are required, except the unit.
describe('Required fields', () => {
  it('starts with the state set to CA', () => {
    mockSupabase()
    render(<QuoteForm />)

    expect(screen.getByPlaceholderText('State')).toHaveValue('CA')
  })

  it('enables submit without a unit and disables it without a street', async () => {
    mockSupabase()
    render(<QuoteForm />)
    const button = screen.getByRole('button', { name: /get my free quote/i })

    expect(button).toBeDisabled()

    await fillQuoteForm()
    expect(button).toBeEnabled()

    await userEvent.clear(screen.getByPlaceholderText('Street address'))
    expect(button).toBeDisabled()
  })

  it('checks the fields before spending a lookup: bad ZIP', async () => {
    const { insert } = mockSupabase()
    render(<QuoteForm />)

    await fillQuoteForm({ zip: '958' })
    submitQuoteForm()

    expect(await screen.findByText('Please enter a 5-digit ZIP code.')).toBeInTheDocument()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('checks the fields before spending a lookup: bad state', async () => {
    const { insert } = mockSupabase()
    render(<QuoteForm />)

    await fillQuoteForm()
    await userEvent.clear(screen.getByPlaceholderText('State'))
    await userEvent.type(screen.getByPlaceholderText('State'), 'ZZ')
    submitQuoteForm()

    expect(await screen.findByText('Please enter the 2-letter state (for example CA).')).toBeInTheDocument()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })
})

// SCRUM-239 AC: A verified address is saved in the standardized format.
describe('Verified address', () => {
  it('sends the typed address to be checked', async () => {
    mockSupabase()
    render(<QuoteForm />)

    await fillQuoteForm()
    await userEvent.type(screen.getByPlaceholderText('Apt, suite, unit (optional)'), 'Apt 4')
    submitQuoteForm()

    await screen.findByText(SUCCESS_TEXT)
    expect(supabase.functions.invoke).toHaveBeenCalledWith('validate-address', {
      body: {
        address: { street: '123 main street', unit: 'Apt 4', city: 'Sacramento', state: 'CA', zip: '95814' },
        website: '',
      },
    })
  })

  it('saves the standardized address and resets the form', async () => {
    const { insert } = mockSupabase()
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: STANDARDIZED, status: 'pending' }))
    expect(screen.getByPlaceholderText('Street address')).toHaveValue('')
  })

  it('saves what was typed if no standardized address came back', async () => {
    const { insert } = mockSupabase({ check: checkResult({ status: 'verified' }) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    await screen.findByText(SUCCESS_TEXT)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: AS_TYPED }))
  })

  it('shows an error and keeps the input if saving fails', async () => {
    mockSupabase({ insertResult: { error: { message: 'db down' } } })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(/something went wrong submitting your quote/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Street address')).toHaveValue('123 main street')
  })
})

// SCRUM-239 AC: An address spelled differently prompts "Did you mean ...?" and the customer decides.
describe('Suggested address', () => {
  it('shows the suggestion and saves nothing yet', async () => {
    const { insert } = mockSupabase({ check: checkResult(SUGGESTION) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByRole('alert')).toHaveTextContent(`Did you mean: ${STANDARDIZED}?`)
    expect(insert).not.toHaveBeenCalled()
  })

  it('"Use this address" saves the suggestion without a second lookup', async () => {
    const { insert } = mockSupabase({ check: checkResult(SUGGESTION) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Use this address' }))

    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: STANDARDIZED }))
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Use this address" fills the form with the suggestion', async () => {
    // Saving fails on purpose, because a successful save would reset the form
    mockSupabase({ check: checkResult(SUGGESTION), insertResult: { error: { message: 'db down' } } })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Use this address' }))

    await screen.findByText(/something went wrong submitting your quote/i)
    expect(screen.getByPlaceholderText('Street address')).toHaveValue('123 Main St')
  })

  it('"Edit my address" closes the suggestion and keeps what was typed', async () => {
    const { insert } = mockSupabase({ check: checkResult(SUGGESTION) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit my address' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Street address')).toHaveValue('123 main street')
    expect(insert).not.toHaveBeenCalled()
  })

  it('editing the address closes the suggestion', async () => {
    mockSupabase({ check: checkResult(SUGGESTION) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()
    await screen.findByRole('alert')
    await userEvent.type(screen.getByPlaceholderText('City'), 'x')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('checks the address again when it is resubmitted after editing', async () => {
    mockSupabase({ check: checkResult(SUGGESTION) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit my address' }))
    submitQuoteForm()

    await screen.findByRole('alert')
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
  })
})

// SCRUM-239 AC: An address that can't be verified blocks the quote.
describe('Invalid address', () => {
  it.each(['not_found', 'low_accuracy', 'po_box'])('blocks the quote when the reason is %s', async (reason) => {
    const { insert } = mockSupabase({ check: checkResult({ status: 'invalid', reason }) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(INVALID_TEXT)).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('Street address')).toHaveValue('123 main street')
  })
})

// SCRUM-239 AC: If the address check is down, the customer can still send a quote.
describe('Address check is down', () => {
  it('saves what was typed when the geocoder is unavailable', async () => {
    const { insert } = mockSupabase({ check: checkResult({ status: 'unavailable', reason: 'service_down' }) })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: AS_TYPED }))
  })

  it('saves what was typed when the function cannot be reached', async () => {
    const { insert } = mockSupabase()
    supabase.functions.invoke.mockRejectedValue(new Error('network down'))
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: AS_TYPED }))
  })

  it('saves what was typed when the function crashes', async () => {
    const { insert } = mockSupabase({
      check: { data: null, error: { name: 'FunctionsHttpError', context: { status: 500, json: async () => ({}) } } },
    })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: AS_TYPED }))
  })
})

// SCRUM-239 AC: Too many tries are refused, and the customer is told why.
describe('Rate limit', () => {
  it('shows the message and saves nothing', async () => {
    const message = 'Too many requests. Please wait a minute and try again.'
    const { insert } = mockSupabase({
      check: { data: null, error: { name: 'FunctionsHttpError', context: { status: 429, json: async () => ({ error: message }) } } },
    })
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
  })
})

// SCRUM-239 AC: Bots that fill the hidden field get no lookup and no saved quote.
describe('Honeypot', () => {
  it('pretends to succeed but checks and saves nothing', async () => {
    const { insert } = mockSupabase()
    render(<QuoteForm />)

    await fillQuoteForm()
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'https://spam.example' } })
    submitQuoteForm()

    expect(await screen.findByText(SUCCESS_TEXT)).toBeInTheDocument()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })
})

// SCRUM-239 AC: The form shows the check is running and can't be submitted twice.
describe('While the address is being checked', () => {
  it('shows the status, locks the form and ignores a second submit', async () => {
    const { insert } = mockSupabase()
    supabase.functions.invoke.mockReturnValue(new Promise(() => {}))
    render(<QuoteForm />)

    await fillQuoteForm()
    submitQuoteForm()

    expect(await screen.findByRole('button', { name: 'Verifying address...' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Street address')).toBeDisabled()
    expect(screen.getByPlaceholderText('Name')).toBeDisabled()

    submitQuoteForm()

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
  })
})

// SCRUM-239 AC: The address is collected in separate fields.
describe('AddressFields', () => {
  const VALUE = { street: '', unit: '', city: '', state: 'CA', zip: '' }

  it.each([
    'Street address',
    'Apartment, suite or unit (optional)',
    'City',
    'State',
    'ZIP code',
  ])('renders the %s input', (name) => {
    render(<AddressFields value={VALUE} onChange={() => {}} />)

    expect(screen.getByRole('textbox', { name })).toBeInTheDocument()
  })

  it('limits the state to 2 characters and the ZIP to 5', () => {
    render(<AddressFields value={VALUE} onChange={() => {}} />)

    expect(screen.getByRole('textbox', { name: 'State' })).toHaveAttribute('maxlength', '2')
    expect(screen.getByRole('textbox', { name: 'ZIP code' })).toHaveAttribute('maxlength', '5')
  })

  it.each([
    ['Street address', 'street'],
    ['Apartment, suite or unit (optional)', 'unit'],
    ['City', 'city'],
    ['ZIP code', 'zip'],
  ])('reports a change to %s without losing the other fields', async (name, field) => {
    const onChange = vi.fn()
    render(<AddressFields value={VALUE} onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox', { name }), '9')

    expect(onChange).toHaveBeenCalledWith({ ...VALUE, [field]: '9' })
  })

  it('disables every input when disabled', () => {
    render(<AddressFields value={VALUE} onChange={() => {}} disabled />)

    screen.getAllByRole('textbox').forEach((input) => expect(input).toBeDisabled())
  })
})

// SCRUM-239 AC: The "Did you mean ...?" box gives the customer two choices.
describe('AddressSuggestion', () => {
  it('renders nothing without a suggestion', () => {
    const { container } = render(<AddressSuggestion suggestion={null} loading={false} onAccept={() => {}} onEdit={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('calls the matching handler for each button', async () => {
    const onAccept = vi.fn()
    const onEdit = vi.fn()
    render(<AddressSuggestion suggestion={SUGGESTION} loading={false} onAccept={onAccept} onEdit={onEdit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Use this address' }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Edit my address' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons while loading', () => {
    render(<AddressSuggestion suggestion={SUGGESTION} loading onAccept={() => {}} onEdit={() => {}} />)

    expect(screen.getByRole('button', { name: 'Use this address' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit my address' })).toBeDisabled()
  })
})
