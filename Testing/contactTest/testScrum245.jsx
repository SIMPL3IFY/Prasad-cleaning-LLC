// SCRUM-245: Request a quote / Contact page testing
// Automated tests for the Contact page so changes don't stop customers from requesting a quote.

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Contact from '../../src/pages/Contact'

// Supabase is mocked so tests never hit the real database and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    // The quote form checks the address with the validate-address Edge Function
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const SUCCESS_MESSAGE = "Thanks! We've received your quote request and will be in touch shortly."
const SAVE_ERROR_MESSAGE = 'Something went wrong submitting your quote. Please try again.'
const INVALID_ADDRESS_MESSAGE = "We couldn't verify this address. Please check it and try again."
const STANDARDIZED_ADDRESS = '123 Main St, Sacramento, CA 95814'

// Helper: fakes from('quotes').insert() and the address check (which confirms the address by default).
function mockSupabase({
  insertResult = { error: null },
  addressResult = { data: { result: { status: 'verified', standardized: STANDARDIZED_ADDRESS } }, error: null },
} = {}) {
  const insert = vi.fn().mockResolvedValue(insertResult)

  // from('quotes').insert({...})
  supabase.from.mockReturnValue({ insert })
  supabase.functions.invoke.mockResolvedValue(addressResult)

  return { insert }
}

function renderContact() {
  return render(
    <MemoryRouter initialEntries={['/contact']}>
      <Routes>
        <Route path="/contact" element={<Contact />} />
        <Route path="/service-area" element={<p>Service Area Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// Helper: fill every quote field (the button stays disabled until all are filled). The unit is optional.
async function fillQuoteForm(overrides = {}) {
  const values = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9161234567',
    street: '123 Main St',
    city: 'Sacramento',
    zip: '95814',
    property: 'Residential',
    service: 'Deep Cleaning',
    message: 'Please clean my kitchen.',
    ...overrides,
  }
  await userEvent.type(screen.getByPlaceholderText('Name'), values.name)
  await userEvent.type(screen.getByPlaceholderText('Email'), values.email)
  await userEvent.type(screen.getByPlaceholderText('Phone'), values.phone)
  await userEvent.type(screen.getByPlaceholderText('Street address'), values.street)
  await userEvent.type(screen.getByPlaceholderText('City'), values.city)
  await userEvent.type(screen.getByPlaceholderText('ZIP'), values.zip)
  await userEvent.selectOptions(screen.getByDisplayValue('Select property type'), values.property)
  await userEvent.selectOptions(screen.getByDisplayValue('Select service type'), values.service)
  // Typed last, and skipped when empty (userEvent can't type an empty string)
  if (values.message) await userEvent.type(screen.getByPlaceholderText('How can we help?'), values.message)
}

const submitButton = () => screen.getByRole('button', { name: /get my free quote|verifying address|submitting/i })

// The browser blocks the submit when a field is empty or not an email, so tests of our own messages submit the form directly.
function submitQuoteForm() {
  fireEvent.submit(submitButton().closest('form'))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// SCRUM-245 AC: The page shows the heading, the form title and the "all fields are required" note.
describe('Page header', () => {
  it('shows the heading, the form title and the required-fields note', () => {
    mockSupabase()
    renderContact()

    expect(screen.getByRole('heading', { name: "Let's get your space sparkling" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Request your free quote' })).toBeInTheDocument()
    expect(screen.getByText('All fields are required.')).toBeInTheDocument()
  })
})

// SCRUM-245 AC: The info cards show the 3 steps and the services, and link to the service area page.
describe('Info cards', () => {
  it('shows all 3 "How it works" steps', () => {
    mockSupabase()
    renderContact()

    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tell us about your space' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'We review your request' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Get scheduled' })).toBeInTheDocument()
  })

  it('lists the services we offer', () => {
    mockSupabase()
    renderContact()

    expect(screen.getByRole('heading', { name: 'What we offer' })).toBeInTheDocument()
    for (const service of ['Standard Cleaning', 'Deep Cleaning', 'Move-in / Move-Out', 'Custom Requests']) {
      // Each service is also an option in the form's dropdown, so look only at the list items
      expect(screen.getByText(service, { selector: 'li' })).toBeInTheDocument()
    }
  })

  it('links to the service area page', async () => {
    mockSupabase()
    renderContact()

    await userEvent.click(screen.getByRole('link', { name: /see the cities we serve/i }))

    expect(screen.getByText('Service Area Page')).toBeInTheDocument()
  })
})

// SCRUM-245 AC: The form shows every field, and the dropdowns start on their placeholder.
describe('Form fields', () => {
  it('shows every field', () => {
    mockSupabase()
    renderContact()

    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Phone')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Street address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Apt, suite, unit (optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('City')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('State')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ZIP')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('How can we help?')).toBeInTheDocument()
  })

  it('starts both dropdowns on their placeholder and the state on CA', () => {
    mockSupabase()
    renderContact()

    expect(screen.getByDisplayValue('Select property type')).toHaveValue('')
    expect(screen.getByDisplayValue('Select service type')).toHaveValue('')
    expect(screen.getByPlaceholderText('State')).toHaveValue('CA')
  })

  it('offers Residential and Commercial as property types', () => {
    mockSupabase()
    renderContact()

    const options = Array.from(screen.getByDisplayValue('Select property type').querySelectorAll('option'))

    expect(options.map((option) => option.textContent)).toEqual(['Select property type', 'Residential', 'Commercial'])
  })

  it('offers the four services as service types', () => {
    mockSupabase()
    renderContact()

    const options = Array.from(screen.getByDisplayValue('Select service type').querySelectorAll('option'))

    expect(options.map((option) => option.textContent)).toEqual([
      'Select service type',
      'Standard Cleaning',
      'Deep Cleaning',
      'Move-in / Move-Out',
      'Custom Requests',
    ])
  })
})

// SCRUM-245 AC: The "Get My Free Quote" button is disabled until every field has a value.
describe('Submit button', () => {
  it('is disabled while the form is empty', () => {
    mockSupabase()
    renderContact()

    expect(submitButton()).toBeDisabled()
  })

  it('is disabled while one field is still empty', async () => {
    mockSupabase()
    renderContact()

    await fillQuoteForm({ message: '' })

    expect(submitButton()).toBeDisabled()
  })

  it('is enabled once every field is filled, without a unit', async () => {
    mockSupabase()
    renderContact()

    await fillQuoteForm()

    expect(submitButton()).toBeEnabled()
  })
})

// SCRUM-245 AC: Invalid details show a message and nothing is sent to Supabase.
describe('Validation', () => {
  it('rejects an email without a domain ending', async () => {
    const { insert } = mockSupabase()
    renderContact()

    await fillQuoteForm({ email: 'name@example' })
    await userEvent.click(submitButton())

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('rejects a phone number that does not have 10 digits', async () => {
    const { insert } = mockSupabase()
    renderContact()

    await fillQuoteForm({ phone: '555123456' })
    await userEvent.click(submitButton())

    expect(await screen.findByText('Please enter a valid 10-digit phone number.')).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('accepts a formatted phone number', async () => {
    const { insert } = mockSupabase()
    renderContact()

    await fillQuoteForm({ phone: '(555) 123-4567' })
    await userEvent.click(submitButton())

    expect(await screen.findByText(SUCCESS_MESSAGE)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ phone: '(555) 123-4567' }))
  })

  it('rejects a message that is only spaces', async () => {
    const { insert } = mockSupabase()
    renderContact()

    await fillQuoteForm({ message: '   ' })
    submitQuoteForm()

    expect(await screen.findByText('Please tell us how we can help.')).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('rejects a ZIP code that does not have 5 digits', async () => {
    const { insert } = mockSupabase()
    renderContact()

    await fillQuoteForm({ zip: '958' })
    submitQuoteForm()

    expect(await screen.findByText('Please enter a 5-digit ZIP code.')).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
  })
})

// SCRUM-245 AC: A valid quote is saved to the quotes table with trimmed values and a "pending" status.
describe('Saving a quote', () => {
  it('saves the quote once, with trimmed values and a pending status', async () => {
    const { insert } = mockSupabase()
    renderContact()

    await fillQuoteForm({ name: '  Jane Doe  ', phone: ' 9161234567 ', message: '  Please clean my kitchen.  ' })
    await userEvent.click(submitButton())

    expect(await screen.findByText(SUCCESS_MESSAGE)).toBeInTheDocument()
    expect(supabase.from).toHaveBeenCalledWith('quotes')
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith({
      customer_name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '9161234567',
      // Saved in the standardized format the address check sends back
      address: STANDARDIZED_ADDRESS,
      property: 'Residential',
      service: 'Deep Cleaning',
      message: 'Please clean my kitchen.',
      status: 'pending',
    })
  })

  it('sends the typed address to the address check', async () => {
    mockSupabase()
    renderContact()

    await fillQuoteForm()
    await userEvent.click(submitButton())

    await screen.findByText(SUCCESS_MESSAGE)
    expect(supabase.functions.invoke).toHaveBeenCalledWith('validate-address', {
      body: { address: { street: '123 Main St', unit: '', city: 'Sacramento', state: 'CA', zip: '95814' }, website: '' },
    })
  })

  it('saves what was typed if the address check is down', async () => {
    const { insert } = mockSupabase({ addressResult: { data: null, error: new Error('network down') } })
    renderContact()

    await fillQuoteForm()
    await userEvent.click(submitButton())

    expect(await screen.findByText(SUCCESS_MESSAGE)).toBeInTheDocument()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: '123 Main St, Sacramento, CA 95814' }))
  })

  it('does not save an address that cannot be verified', async () => {
    const { insert } = mockSupabase({ addressResult: { data: { result: { status: 'invalid' } }, error: null } })
    renderContact()

    await fillQuoteForm()
    await userEvent.click(submitButton())

    expect(await screen.findByText(INVALID_ADDRESS_MESSAGE)).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Jane Doe')
  })
})

// SCRUM-245 AC: After a successful submit the form shows a thank-you message and clears every field.
describe('After a successful submit', () => {
  it('shows the thank-you message and clears the form', async () => {
    mockSupabase()
    renderContact()

    await fillQuoteForm()
    await userEvent.click(submitButton())

    expect(await screen.findByText(SUCCESS_MESSAGE)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name')).toHaveValue('')
    expect(screen.getByPlaceholderText('Email')).toHaveValue('')
    expect(screen.getByPlaceholderText('Phone')).toHaveValue('')
    expect(screen.getByPlaceholderText('Street address')).toHaveValue('')
    expect(screen.getByPlaceholderText('City')).toHaveValue('')
    expect(screen.getByPlaceholderText('State')).toHaveValue('CA')
    expect(screen.getByPlaceholderText('ZIP')).toHaveValue('')
    expect(screen.getByDisplayValue('Select property type')).toHaveValue('')
    expect(screen.getByDisplayValue('Select service type')).toHaveValue('')
    expect(screen.getByPlaceholderText('How can we help?')).toHaveValue('')
    expect(submitButton()).toBeDisabled()
  })
})

// SCRUM-245 AC: If saving fails, an error is shown and the customer's input is kept.
describe('Save failure', () => {
  it('shows an error and keeps the input if saving fails', async () => {
    mockSupabase({ insertResult: { error: { message: 'db down' } } })
    renderContact()

    await fillQuoteForm()
    await userEvent.click(submitButton())

    expect(await screen.findByText(SAVE_ERROR_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText(SUCCESS_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByPlaceholderText('Email')).toHaveValue('jane@example.com')
    expect(screen.getByPlaceholderText('How can we help?')).toHaveValue('Please clean my kitchen.')
  })
})

// SCRUM-245 AC: While the quote is being saved the button reads "Submitting..." and is disabled.
describe('While submitting', () => {
  it('disables the button and shows "Submitting..." until the quote is saved', async () => {
    const { insert } = mockSupabase()
    // A save that finishes when the test says so
    let finishSave
    insert.mockReturnValue(new Promise((resolve) => { finishSave = resolve }))
    renderContact()

    await fillQuoteForm()
    await userEvent.click(submitButton())

    const button = await screen.findByRole('button', { name: 'Submitting...' })
    expect(button).toBeDisabled()

    // A second submit while saving is ignored
    submitQuoteForm()
    expect(insert).toHaveBeenCalledTimes(1)

    finishSave({ error: null })
    expect(await screen.findByText(SUCCESS_MESSAGE)).toBeInTheDocument()
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
  })
})
