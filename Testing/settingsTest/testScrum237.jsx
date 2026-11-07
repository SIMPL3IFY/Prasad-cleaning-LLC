import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Settings from '../../src/pages/Settings'

// Supabase is mocked so tests never hit the real database and stay deterministic.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

// Mock DeleteAccount component so it doesn't interfere with Settings tests
vi.mock('../../src/components/DeleteAccount', () => ({
  default: () => <div />,
}))

const MOCK_USER = { id: 'user-123', email: 'test@example.com' }

// Helper: mock supabase.auth.getUser to return a signed-in user
function mockSignedInUser() {
  supabase.auth.getUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null })
}

// Helper: mock supabase.auth.getUser to return no user (unauthenticated)
function mockSignedOutUser() {
  supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
}

// Helper: mock supabase.from('settings').select().eq().maybeSingle()
function mockSettingsData(data = null, error = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  supabase.from.mockReturnValue({ select, upsert: vi.fn().mockResolvedValue({ error: null }) })
  return { select, eq, maybeSingle }
}

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/portal" element={<p>Customer Portal</p>} />
        <Route path="/" element={<p>Home Page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// SCRUM-237 Test 1: Settings form loads and prefills with saved data
describe('Settings form loads', () => {
  it('prefills email, phone, and address from saved data', async () => {
    mockSignedInUser()
    mockSettingsData({ phone_number: '9161234567', address: '123 Main St' })

    renderSettings()

    await waitFor(() => {
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('9161234567')).toBeInTheDocument()
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument()
    })
  })
})

// SCRUM-237 Test 2: Valid phone number saves successfully and shows popup
describe('Phone number validation', () => {
  it('shows Account Updated popup when a valid 10-digit phone is saved', async () => {
    mockSignedInUser()
    mockSettingsData({ phone_number: '9161234567', address: '123 Main St' })

    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { phone_number: '9161234567', address: '123 Main St' },
            error: null,
          }),
        })),
      })),
      upsert: upsertMock,
    })

    renderSettings()

    await waitFor(() => screen.getByDisplayValue('9161234567'))

    const phoneInput = screen.getByLabelText(/change phone number/i)
    await userEvent.clear(phoneInput)
    await userEvent.type(phoneInput, '9169876543')

    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Account Updated!')).toBeInTheDocument()
    })
  })

  // SCRUM-237 Test 3: Invalid phone number shows validation error
  it('shows error for an invalid phone number', async () => {
    mockSignedInUser()
    mockSettingsData({ phone_number: '', address: '' })

    renderSettings()

    await waitFor(() => screen.getByLabelText(/change phone number/i))

    const phoneInput = screen.getByLabelText(/change phone number/i)
    await userEvent.type(phoneInput, '123')

    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid 10-digit US phone number.')).toBeInTheDocument()
    })
  })
})

// SCRUM-237 Test 4: Valid address saves successfully
describe('Address saving', () => {
  it('saves a valid address successfully', async () => {
    mockSignedInUser()

    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { phone_number: '', address: '' },
            error: null,
          }),
        })),
      })),
      upsert: upsertMock,
    })

    renderSettings()

    await waitFor(() => screen.getByLabelText(/change business or residential address/i))

    const addressInput = screen.getByLabelText(/change business or residential address/i)
    await userEvent.type(addressInput, '456 Oak Ave, Sacramento, CA 95814')

    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form'))

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalled()
    })
  })
})

// SCRUM-237 Test 5: Password and confirm password must match
describe('Password validation', () => {
  it('shows error when passwords do not match', async () => {
    mockSignedInUser()
    mockSettingsData({ phone_number: '', address: '' })

    renderSettings()

    await waitFor(() => screen.getByLabelText(/change password/i))

    await userEvent.type(screen.getByLabelText(/^change password$/i), 'password123')
    await userEvent.type(screen.getByLabelText(/re-enter new password/i), 'different456')

    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    })
  })
})

// SCRUM-237 Test 6: Unauthenticated users see an error (page handles no user gracefully)
describe('Unauthenticated access', () => {
  it('shows a signed-in error message when no user is found', async () => {
    mockSignedOutUser()
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })

    renderSettings()

    await waitFor(() => {
      expect(
        screen.getByText('You must be signed in to change your settings.')
      ).toBeInTheDocument()
    })
  })
})
