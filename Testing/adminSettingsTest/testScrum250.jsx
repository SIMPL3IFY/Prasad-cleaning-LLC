// SCRUM-250: Settings page testing
// Automated tests for the Settings page so changes don't stop an admin from updating their email, phone number, address or password.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Settings from '../../src/pages/Settings'

// Supabase is mocked so tests never hit the real database or auth server and stay deterministic.
const { supabase, upsert, maybeSingle } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
  },
  upsert: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

// The delete-account section has its own tests, so keep it out of these
vi.mock('../../src/components/DeleteAccount', () => ({
  default: () => <div />,
}))

const MOCK_USER = { id: 'user-123', email: 'admin@example.com' }
const SAVED_SETTINGS = { phone_number: '5551234567', address: '1 Old Road' }

// Helper: fakes from('settings').select().eq().maybeSingle() for loading, and from('settings').upsert() for saving.
function mockSupabase({
  user = MOCK_USER,
  settings = SAVED_SETTINGS,
  upsertResult = { error: null },
  updateUserResult = { data: { user: MOCK_USER }, error: null },
} = {}) {
  supabase.auth.getUser.mockResolvedValue({ data: { user }, error: null })
  supabase.auth.updateUser.mockResolvedValue(updateUserResult)
  maybeSingle.mockResolvedValue({ data: settings, error: null })
  upsert.mockResolvedValue(upsertResult)

  const query = { select: () => query, eq: () => query, maybeSingle, upsert }
  supabase.from.mockReturnValue(query)
}

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/portal" element={<p>Customer Portal</p>} />
      </Routes>
    </MemoryRouter>
  )
}

// The Save button reads "Saving..." and is disabled until the saved values have loaded
async function renderLoadedSettings() {
  renderSettings()
  await waitFor(() => expect(saveButton()).toBeEnabled())
}

const saveButton = () => screen.getByRole('button', { name: 'Save' })
const emailField = () => screen.getByLabelText('Email Address')
const phoneField = () => screen.getByLabelText('Change Phone Number')
const addressField = () => screen.getByLabelText('Change Business or Residential Address')
const passwordField = () => screen.getByLabelText('Change Password')
const confirmField = () => screen.getByLabelText('Re-Enter New Password')

// Helper: opens the email field for editing and types a new address
async function typeNewEmail(email) {
  await userEvent.click(emailField())
  await userEvent.clear(emailField())
  await userEvent.type(emailField(), email)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// SCRUM-250 AC: The page shows the heading, every field, a Save button and a Cancel link to the portal.
describe('Page layout', () => {
  it('shows the heading, every field, Save and Cancel', async () => {
    mockSupabase()
    await renderLoadedSettings()

    expect(screen.getByRole('heading', { name: 'Change User Settings' })).toBeInTheDocument()
    expect(emailField()).toBeInTheDocument()
    expect(phoneField()).toBeInTheDocument()
    expect(addressField()).toBeInTheDocument()
    expect(passwordField()).toBeInTheDocument()
    expect(confirmField()).toBeInTheDocument()
    expect(saveButton()).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/portal')
  })

  it('Cancel goes back to the portal', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }))

    expect(screen.getByText('Customer Portal')).toBeInTheDocument()
  })
})

// SCRUM-250 AC: On load, the signed-in user's email, phone number and address fill the form.
describe('Loading the saved settings', () => {
  it('fills the form with the saved email, phone number and address', async () => {
    mockSupabase()
    await renderLoadedSettings()

    expect(emailField()).toHaveValue('admin@example.com')
    expect(phoneField()).toHaveValue('5551234567')
    expect(addressField()).toHaveValue('1 Old Road')
    expect(supabase.from).toHaveBeenCalledWith('settings')
  })

  it('leaves the phone number and address empty when nothing is saved yet', async () => {
    mockSupabase({ settings: null })
    await renderLoadedSettings()

    expect(emailField()).toHaveValue('admin@example.com')
    expect(phoneField()).toHaveValue('')
    expect(addressField()).toHaveValue('')
  })

  it('starts with the password fields empty', async () => {
    mockSupabase()
    await renderLoadedSettings()

    expect(passwordField()).toHaveValue('')
    expect(confirmField()).toHaveValue('')
  })
})

// SCRUM-250 AC: If nobody is signed in, the page says so.
describe('Signed out', () => {
  it('shows "You must be signed in to change your settings."', async () => {
    mockSupabase({ user: null })
    renderSettings()

    expect(await screen.findByText('You must be signed in to change your settings.')).toBeInTheDocument()
  })
})

// SCRUM-250 AC: Save with nothing changed asks for a change and does not call Supabase.
describe('Saving with no changes', () => {
  it('shows "Make a change before saving." and sends nothing', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.click(saveButton())

    expect(screen.getByText('Make a change before saving.')).toBeInTheDocument()
    expect(upsert).not.toHaveBeenCalled()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })
})

// SCRUM-250 AC: The email is read-only until clicked, and "Cancel email edit" puts it back.
describe('Editing the email', () => {
  it('is read-only until it is clicked', async () => {
    mockSupabase()
    await renderLoadedSettings()

    expect(emailField()).toHaveAttribute('readonly')

    await userEvent.click(emailField())

    expect(emailField()).not.toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Cancel email edit' })).toBeInTheDocument()
  })

  it('"Cancel email edit" restores the original email and makes it read-only again', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await typeNewEmail('changed@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel email edit' }))

    expect(emailField()).toHaveValue('admin@example.com')
    expect(emailField()).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Cancel email edit' })).not.toBeInTheDocument()
  })
})

// SCRUM-250 AC: A changed email goes to Supabase Auth, trimmed, and the page says what happens next.
describe('Saving a new email', () => {
  it('sends the trimmed email and shows "Email address updated successfully."', async () => {
    mockSupabase({ updateUserResult: { data: { user: { ...MOCK_USER, email: 'new@example.com' } }, error: null } })
    await renderLoadedSettings()

    await typeNewEmail('  new@example.com  ')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Email address updated successfully.')).toBeInTheDocument()
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1)
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' })
  })

  it('says a confirmation link was sent when the login email has not changed yet', async () => {
    // Supabase still returns the old email until the customer confirms the new one
    mockSupabase()
    await renderLoadedSettings()

    await typeNewEmail('new@example.com')
    await userEvent.click(saveButton())

    expect(await screen.findByText(
      'A confirmation link was sent to new@example.com. Your login email will change after confirmation.'
    )).toBeInTheDocument()
  })

  it('shows the error from Supabase when the email cannot be changed', async () => {
    mockSupabase({ updateUserResult: { data: null, error: { message: 'Email already in use.' } } })
    await renderLoadedSettings()

    await typeNewEmail('taken@example.com')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Email already in use.')).toBeInTheDocument()
  })

  it('shows "Email is required." for an empty email and sends nothing', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.click(emailField())
    await userEvent.clear(emailField())
    await userEvent.click(saveButton())

    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('shows "Please enter a valid email address." for an invalid email and sends nothing', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await typeNewEmail('not-an-email')
    await userEvent.click(saveButton())

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })
})

// SCRUM-250 AC: A phone number is saved as digits only, with a message and the "Account Updated!" popup.
describe('Saving a phone number', () => {
  it('saves digits only and shows "Phone number updated." and the popup', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.clear(phoneField())
    await userEvent.type(phoneField(), '(555) 987-6543')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Phone number updated.')).toBeInTheDocument()
    expect(screen.getByText('Account Updated!')).toBeInTheDocument()
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', phone_number: '5559876543' }),
      { onConflict: 'user_id' }
    )
  })

  it('saves only the phone number, not the address or login details', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.clear(phoneField())
    await userEvent.type(phoneField(), '5559876543')
    await userEvent.click(saveButton())

    await screen.findByText('Phone number updated.')
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('address')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects a phone number without 10 digits and does not save it', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.clear(phoneField())
    await userEvent.type(phoneField(), '12345')
    await userEvent.click(saveButton())

    expect(screen.getByText('Enter a valid 10-digit US phone number.')).toBeInTheDocument()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('shows the error from Supabase and no success message when saving fails', async () => {
    mockSupabase({ upsertResult: { error: { message: 'Could not save settings.' } } })
    await renderLoadedSettings()

    await userEvent.clear(phoneField())
    await userEvent.type(phoneField(), '5559876543')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Could not save settings.')).toBeInTheDocument()
    expect(screen.queryByText('Phone number updated.')).not.toBeInTheDocument()
    expect(screen.queryByText('Account Updated!')).not.toBeInTheDocument()
  })
})

// SCRUM-250 AC: A changed address is saved trimmed, with a message.
describe('Saving an address', () => {
  it('saves the trimmed address and shows "Address updated."', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.clear(addressField())
    await userEvent.type(addressField(), '  22 New Street, Springfield  ')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Address updated.')).toBeInTheDocument()
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', address: '22 New Street, Springfield' }),
      { onConflict: 'user_id' }
    )
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('phone_number')
  })

  it('shows the error from Supabase and no success message when saving fails', async () => {
    mockSupabase({ upsertResult: { error: { message: 'Could not save address.' } } })
    await renderLoadedSettings()

    await userEvent.clear(addressField())
    await userEvent.type(addressField(), '22 New Street')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Could not save address.')).toBeInTheDocument()
    expect(screen.queryByText('Address updated.')).not.toBeInTheDocument()
  })
})

// SCRUM-250 AC: A new password is saved when both fields match, and the page says so.
describe('Saving a new password', () => {
  it('saves the password and shows "Password updated." when both fields match', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.type(passwordField(), 'NewPass123!')
    await userEvent.type(confirmField(), 'NewPass123!')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Password updated.')).toBeInTheDocument()
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1)
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPass123!' })
  })

  it('shows "Passwords do not match." and does not save when the fields differ', async () => {
    mockSupabase()
    await renderLoadedSettings()

    await userEvent.type(passwordField(), 'NewPass123!')
    await userEvent.type(confirmField(), 'Different456!')
    await userEvent.click(saveButton())

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('shows the error from Supabase and no success message when saving fails', async () => {
    mockSupabase({ updateUserResult: { data: null, error: { message: 'Password is too weak.' } } })
    await renderLoadedSettings()

    await userEvent.type(passwordField(), 'abc')
    await userEvent.type(confirmField(), 'abc')
    await userEvent.click(saveButton())

    expect(await screen.findByText('Password is too weak.')).toBeInTheDocument()
    expect(screen.queryByText('Password updated.')).not.toBeInTheDocument()
  })
})

// SCRUM-250 AC: Each eye button shows or hides its own password field.
describe('Show and hide password', () => {
  it('shows and hides each password field with its own eye button', async () => {
    mockSupabase()
    await renderLoadedSettings()

    expect(passwordField()).toHaveAttribute('type', 'password')
    expect(confirmField()).toHaveAttribute('type', 'password')

    const [passwordToggle, confirmToggle] = screen.getAllByRole('button', { name: 'Show password' })

    // Only the field whose button was clicked changes
    await userEvent.click(passwordToggle)
    expect(passwordField()).toHaveAttribute('type', 'text')
    expect(confirmField()).toHaveAttribute('type', 'password')
    expect(screen.getAllByRole('button', { name: 'Hide password' })).toHaveLength(1)

    await userEvent.click(confirmToggle)
    expect(confirmField()).toHaveAttribute('type', 'text')
    expect(screen.getAllByRole('button', { name: 'Hide password' })).toHaveLength(2)

    await userEvent.click(screen.getAllByRole('button', { name: 'Hide password' })[0])
    expect(passwordField()).toHaveAttribute('type', 'password')
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(1)
  })
})

// SCRUM-250 AC: While saving, the button reads "Saving..." and is disabled.
describe('While saving', () => {
  it('disables the button and shows "Saving..." until the save finishes', async () => {
    mockSupabase()
    // A save that finishes when the test says so
    let finishSave
    upsert.mockReturnValue(new Promise((resolve) => { finishSave = resolve }))
    await renderLoadedSettings()

    await userEvent.clear(phoneField())
    await userEvent.type(phoneField(), '5559876543')
    await userEvent.click(saveButton())

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled()

    finishSave({ error: null })
    expect(await screen.findByText('Phone number updated.')).toBeInTheDocument()
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})
