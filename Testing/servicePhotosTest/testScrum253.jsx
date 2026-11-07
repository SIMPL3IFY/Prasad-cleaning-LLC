import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ServicePhotosManager from '../../src/components/ServicePhotosManager'

// Supabase is mocked so tests never touch the real database or photo storage.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const ADMIN_ERROR = 'Please make sure you are signed in as an admin.'

const MOCK_SERVICES = [
  { id: 's1', name: 'Deep Cleaning', image_path: 'deep-old.jpg', sort_order: 2, is_active: true, description: 'Top to bottom.' },
  { id: 's2', name: 'Window Cleaning', image_path: 'window.jpg', sort_order: 5, is_active: false, description: null },
]

// Helper: each option is what that Supabase call returns. `calls` records the order they ran in.
function mockSupabase({
  fetchResult = { data: MOCK_SERVICES, error: null },
  updateResult = { data: [{ id: 's1' }], error: null },
  deleteResult = { data: [{ id: 's1' }], error: null },
  insertResult = {
    data: [{ id: 's3', name: 'Floor Waxing', image_path: 'floor-waxing.png', sort_order: 6, is_active: true, description: null }],
    error: null,
  },
  uploadResult = { error: null },
  removeResult = { error: null },
} = {}) {
  const calls = []
  const track = (name, result) => vi.fn(() => {
    calls.push(name)
    return result
  })

  const update = vi.fn(() => ({ eq: updateEq }))
  const updateEq = vi.fn(() => ({ select: track('update', updateResult) }))
  const del = vi.fn(() => ({ eq: deleteEq }))
  const deleteEq = vi.fn(() => ({ select: track('delete', deleteResult) }))
  const insert = vi.fn(() => ({ select: track('insert', insertResult) }))
  const order = vi.fn(() => fetchResult)
  const select = vi.fn(() => ({ order }))
  const upload = track('upload', uploadResult)
  const remove = track('remove', removeResult)

  supabase.from.mockReturnValue({ select, update, delete: del, insert })
  supabase.storage.from.mockReturnValue({
    upload,
    remove,
    getPublicUrl: (path) => ({ data: { publicUrl: `https://example.com/${path}` } }),
  })

  return { calls, update, updateEq, del, deleteEq, insert, order, upload, remove }
}

function renderManager(onClose = vi.fn()) {
  render(<ServicePhotosManager onClose={onClose} />)
  return onClose
}

// The card (list item) for one service, so buttons are found for the right service
async function findCard(name) {
  const heading = await screen.findByText(name, { selector: 'strong' })
  return within(heading.closest('li'))
}

function imageFile(name = 'new.png', type = 'image/png') {
  return new File(['photo'], name, { type })
}

function oversizedFile() {
  const file = imageFile('huge.png')
  Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 })
  return file
}

// applyAccept is off so tests can pick a file type the real file dialog would hide
const setupUser = () => userEvent.setup({ applyAccept: false })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // jsdom doesn't implement these
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

describe('Loading the list', () => {
  it('shows a loading message while services load', () => {
    mockSupabase({ fetchResult: new Promise(() => {}) })
    renderManager()
    expect(screen.getByText('Loading services...')).toBeInTheDocument()
  })

  it('asks for every service in sort order and shows each one', async () => {
    const { order } = mockSupabase()
    renderManager()

    const deep = await findCard('Deep Cleaning')
    const windows = await findCard('Window Cleaning')

    expect(supabase.from).toHaveBeenCalledWith('services')
    expect(order).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(deep.getByText('Visible')).toBeInTheDocument()
    expect(windows.getByText('Hidden')).toBeInTheDocument()
    expect(deep.getByRole('img', { name: 'Deep Cleaning' })).toHaveAttribute('src', 'https://example.com/deep-old.jpg')
    expect(deep.getByLabelText('Description')).toHaveValue('Top to bottom.')
    expect(windows.getByLabelText('Description')).toHaveValue('')
  })

  it('shows an error when services cannot be loaded', async () => {
    mockSupabase({ fetchResult: { data: null, error: { message: 'db down' } } })
    renderManager()
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load services.')
  })

  it('shows a message when there are no services', async () => {
    mockSupabase({ fetchResult: { data: [], error: null } })
    renderManager()
    expect(await screen.findByText('No services found.')).toBeInTheDocument()
  })

  it('calls onClose from the close button', async () => {
    mockSupabase()
    const user = setupUser()
    const onClose = renderManager()
    await findCard('Deep Cleaning')

    await user.click(screen.getByRole('button', { name: /close edit services/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Replacing a photo', () => {
  async function chooseFile(user, file = imageFile()) {
    const card = await findCard('Deep Cleaning')
    await user.upload(card.getByLabelText('New photo for Deep Cleaning'), file)
    return card
  }

  it('keeps Save photo disabled until a file is chosen', async () => {
    mockSupabase()
    renderManager()
    const card = await findCard('Deep Cleaning')
    expect(card.getByRole('button', { name: 'Save photo' })).toBeDisabled()
  })

  it('rejects a file that is not a JPG, PNG, or WebP', async () => {
    const { upload } = mockSupabase()
    const user = setupUser()
    renderManager()

    const card = await chooseFile(user, imageFile('notes.pdf', 'application/pdf'))

    expect(screen.getByRole('alert')).toHaveTextContent('Please choose a JPG, PNG, or WebP image.')
    expect(card.getByRole('button', { name: 'Save photo' })).toBeDisabled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects a file larger than 5 MB', async () => {
    mockSupabase()
    const user = setupUser()
    renderManager()

    const card = await chooseFile(user, oversizedFile())

    expect(screen.getByRole('alert')).toHaveTextContent('Please choose an image smaller than 5 MB.')
    expect(card.getByRole('button', { name: 'Save photo' })).toBeDisabled()
  })

  it('clears a rejected file so the same file can be picked again', async () => {
    mockSupabase()
    const user = setupUser()
    renderManager()

    const card = await chooseFile(user, imageFile('notes.pdf', 'application/pdf'))

    expect(card.getByLabelText('New photo for Deep Cleaning').files).toHaveLength(0)
  })

  it('previews the chosen file before anything is saved', async () => {
    const { upload } = mockSupabase()
    const user = setupUser()
    renderManager()

    const card = await chooseFile(user)

    expect(card.getByRole('img', { name: 'Deep Cleaning' })).toHaveAttribute('src', 'blob:preview')
    expect(card.getByText('new.png')).toBeInTheDocument()
    expect(card.getByRole('button', { name: 'Save photo' })).toBeEnabled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads the new photo, updates the service, then removes the old photo', async () => {
    const { calls, upload, update, updateEq, remove } = mockSupabase()
    const user = setupUser()
    renderManager()

    const file = imageFile()
    const card = await chooseFile(user, file)
    await user.click(card.getByRole('button', { name: 'Save photo' }))

    expect(await screen.findByText('Deep Cleaning photo updated.')).toBeInTheDocument()
    expect(calls).toEqual(['upload', 'update', 'remove'])

    const newPath = upload.mock.calls[0][0]
    expect(newPath).toMatch(/^deep-cleaning-\d+\.png$/)
    expect(upload).toHaveBeenCalledWith(newPath, file, { contentType: 'image/png' })
    expect(update).toHaveBeenCalledWith({ image_path: newPath })
    expect(updateEq).toHaveBeenCalledWith('id', 's1')
    expect(remove).toHaveBeenCalledWith(['deep-old.jpg'])

    expect(card.getByRole('img', { name: 'Deep Cleaning' })).toHaveAttribute('src', `https://example.com/${newPath}`)
    expect(card.getByText('No file chosen')).toBeInTheDocument()
  })

  it('stops if the upload fails and keeps the old photo', async () => {
    const { calls } = mockSupabase({ uploadResult: { error: { message: 'bucket full' } } })
    const user = setupUser()
    renderManager()

    const card = await chooseFile(user)
    await user.click(card.getByRole('button', { name: 'Save photo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not upload the photo: bucket full')
    expect(calls).toEqual(['upload'])
  })

  it('removes the new upload when the update is blocked (0 rows, no error)', async () => {
    const { calls, upload, remove } = mockSupabase({ updateResult: { data: [], error: null } })
    const user = setupUser()
    renderManager()

    const card = await chooseFile(user)
    await user.click(card.getByRole('button', { name: 'Save photo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(`Could not save the new photo. ${ADMIN_ERROR}`)
    expect(calls).toEqual(['upload', 'update', 'remove'])
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]])
    expect(remove).not.toHaveBeenCalledWith(['deep-old.jpg'])
  })

  it('still reports success if only removing the old photo fails', async () => {
    mockSupabase({ removeResult: { error: { message: 'not found' } } })
    const user = setupUser()
    renderManager()

    const card = await chooseFile(user)
    await user.click(card.getByRole('button', { name: 'Save photo' }))

    expect(await screen.findByText('Deep Cleaning photo updated.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Showing and hiding a service', () => {
  it('hides a visible service', async () => {
    const { update, updateEq } = mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.click(card.getByRole('button', { name: 'Hide' }))

    expect(await screen.findByText('Deep Cleaning is now hidden from the site.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ is_active: false })
    expect(updateEq).toHaveBeenCalledWith('id', 's1')
    expect(card.getByText('Hidden')).toBeInTheDocument()
    expect(card.getByRole('button', { name: 'Show' })).toBeInTheDocument()
  })

  it('shows a hidden service', async () => {
    const { update } = mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Window Cleaning')

    await user.click(card.getByRole('button', { name: 'Show' }))

    expect(await screen.findByText('Window Cleaning is now shown on the site.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ is_active: true })
    expect(card.getByText('Visible')).toBeInTheDocument()
  })

  it('keeps the badge and shows an error when the update is blocked', async () => {
    mockSupabase({ updateResult: { data: [], error: null } })
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.click(card.getByRole('button', { name: 'Hide' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(`Could not update Deep Cleaning. ${ADMIN_ERROR}`)
    expect(card.getByText('Visible')).toBeInTheDocument()
  })

  it('disables every action while a save is running', async () => {
    mockSupabase({ updateResult: new Promise(() => {}) })
    const user = setupUser()
    renderManager()
    const deep = await findCard('Deep Cleaning')
    const windows = await findCard('Window Cleaning')

    await user.click(deep.getByRole('button', { name: 'Hide' }))

    expect(await deep.findByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(deep.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(windows.getByRole('button', { name: 'Show' })).toBeDisabled()
    expect(windows.getByLabelText('Description')).toBeDisabled()
    expect(windows.getByLabelText('New photo for Window Cleaning')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add service' })).toBeDisabled()
  })
})

describe('Editing a description', () => {
  const saveButton = (card) => card.getByRole('button', { name: 'Save description' })

  it('only enables Save description after a real change', async () => {
    mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')
    const description = card.getByLabelText('Description')

    expect(saveButton(card)).toBeDisabled()

    await user.type(description, '   ')
    expect(saveButton(card)).toBeDisabled() // extra spaces alone aren't a change

    await user.type(description, 'More')
    expect(saveButton(card)).toBeEnabled()
  })

  it('limits a description to 300 characters', async () => {
    mockSupabase()
    renderManager()
    const card = await findCard('Deep Cleaning')
    expect(card.getByLabelText('Description')).toHaveAttribute('maxlength', '300')
  })

  it('saves the trimmed text', async () => {
    const { update, updateEq } = mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')
    const description = card.getByLabelText('Description')

    await user.clear(description)
    await user.type(description, '  Every corner.  ')
    await user.click(saveButton(card))

    expect(await screen.findByText('Deep Cleaning description updated.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ description: 'Every corner.' })
    expect(updateEq).toHaveBeenCalledWith('id', 's1')
    expect(description).toHaveValue('Every corner.')
    expect(saveButton(card)).toBeDisabled()
  })

  it('saves an emptied description as null so the default text is used', async () => {
    const { update } = mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.clear(card.getByLabelText('Description'))
    await user.click(saveButton(card))

    expect(await screen.findByText('Deep Cleaning description updated.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ description: null })
  })

  it('keeps the typed text when saving fails', async () => {
    mockSupabase({ updateResult: { data: null, error: { message: 'db down' } } })
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')
    const description = card.getByLabelText('Description')

    await user.clear(description)
    await user.type(description, 'Keep me')
    await user.click(saveButton(card))

    expect(await screen.findByRole('alert')).toHaveTextContent(`Could not save the description for Deep Cleaning. ${ADMIN_ERROR}`)
    expect(description).toHaveValue('Keep me')
    expect(saveButton(card)).toBeEnabled()
  })
})

describe('Deleting a service', () => {
  it('asks for confirmation before deleting anything', async () => {
    const { del } = mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.click(card.getByRole('button', { name: 'Delete' }))

    expect(card.getByText('Delete Deep Cleaning?')).toBeInTheDocument()
    expect(del).not.toHaveBeenCalled()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const { del } = mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.click(card.getByRole('button', { name: 'Delete' }))
    await user.click(card.getByRole('button', { name: 'Cancel' }))

    expect(card.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(del).not.toHaveBeenCalled()
  })

  it('deletes the row first, then its photo', async () => {
    const { calls, deleteEq, remove } = mockSupabase()
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.click(card.getByRole('button', { name: 'Delete' }))
    await user.click(card.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByText('Deep Cleaning was deleted.')).toBeInTheDocument()
    expect(calls).toEqual(['delete', 'remove'])
    expect(deleteEq).toHaveBeenCalledWith('id', 's1')
    expect(remove).toHaveBeenCalledWith(['deep-old.jpg'])
    expect(screen.queryByText('Deep Cleaning', { selector: 'strong' })).not.toBeInTheDocument()
    expect(screen.getByText('Window Cleaning', { selector: 'strong' })).toBeInTheDocument()
  })

  it('keeps the service and its photo when the delete is blocked', async () => {
    const { remove } = mockSupabase({ deleteResult: { data: [], error: null } })
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.click(card.getByRole('button', { name: 'Delete' }))
    await user.click(card.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(`Could not delete Deep Cleaning. ${ADMIN_ERROR}`)
    expect(remove).not.toHaveBeenCalled()
    expect(screen.getByText('Deep Cleaning', { selector: 'strong' })).toBeInTheDocument()
  })

  it('still removes the service from the list if only removing its photo fails', async () => {
    mockSupabase({ removeResult: { error: { message: 'not found' } } })
    const user = setupUser()
    renderManager()
    const card = await findCard('Deep Cleaning')

    await user.click(card.getByRole('button', { name: 'Delete' }))
    await user.click(card.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByText('Deep Cleaning was deleted.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Adding a service', () => {
  const addButton = () => screen.getByRole('button', { name: 'Add service' })
  const nameField = () => screen.getByLabelText('Service name')
  const photoField = () => screen.getByLabelText('Photo')

  it('requires a name', async () => {
    const { upload } = mockSupabase()
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), '   ')
    await user.click(addButton())

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a service name.')
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects a name that already exists, ignoring capitals', async () => {
    const { upload } = mockSupabase()
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), 'DEEP cleaning')
    await user.upload(photoField(), imageFile())
    await user.click(addButton())

    expect(screen.getByRole('alert')).toHaveTextContent('A service named "DEEP cleaning" already exists.')
    expect(upload).not.toHaveBeenCalled()
  })

  it('requires a photo', async () => {
    const { upload } = mockSupabase()
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), 'Floor Waxing')
    await user.click(addButton())

    expect(screen.getByRole('alert')).toHaveTextContent('Please choose a photo for the new service.')
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects a bad photo and clears the file', async () => {
    mockSupabase()
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.upload(photoField(), imageFile('notes.pdf', 'application/pdf'))

    expect(screen.getByRole('alert')).toHaveTextContent('Please choose a JPG, PNG, or WebP image.')
    expect(screen.queryByAltText('New service preview')).not.toBeInTheDocument()
    expect(photoField().files).toHaveLength(0)
  })

  it('uploads the photo, adds the service last, and clears the form', async () => {
    const { calls, upload, insert } = mockSupabase()
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), '  Floor Waxing  ')
    await user.type(screen.getByLabelText('Description (optional)'), '  Shiny floors.  ')
    await user.upload(photoField(), imageFile('Shine.PNG'))
    expect(screen.getByAltText('New service preview')).toHaveAttribute('src', 'blob:preview')
    await user.click(addButton())

    expect(await screen.findByText('Floor Waxing was added.')).toBeInTheDocument()
    expect(calls).toEqual(['upload', 'insert'])

    const newPath = upload.mock.calls[0][0]
    expect(newPath).toMatch(/^floor-waxing-\d+\.png$/)
    expect(insert).toHaveBeenCalledWith({
      name: 'Floor Waxing',
      image_path: newPath,
      sort_order: 6, // one after the highest existing sort_order, not the row count
      description: 'Shiny floors.',
    })

    expect(screen.getByText('Floor Waxing', { selector: 'strong' })).toBeInTheDocument()
    expect(nameField()).toHaveValue('')
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('')
    expect(screen.queryByAltText('New service preview')).not.toBeInTheDocument()
    expect(photoField().files).toHaveLength(0)
  })

  it('replaces the previous success message when the next attempt is invalid', async () => {
    mockSupabase()
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), 'Floor Waxing')
    await user.upload(photoField(), imageFile())
    await user.click(addButton())
    await screen.findByText('Floor Waxing was added.')

    await user.click(addButton())

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a service name.')
    expect(screen.queryByText('Floor Waxing was added.')).not.toBeInTheDocument()
  })

  it('saves a blank description as null', async () => {
    const { insert } = mockSupabase()
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), 'Floor Waxing')
    await user.upload(photoField(), imageFile())
    await user.click(addButton())

    await screen.findByText('Floor Waxing was added.')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ description: null }))
  })

  it('stops if the upload fails and adds nothing', async () => {
    const { insert } = mockSupabase({ uploadResult: { error: { message: 'bucket full' } } })
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), 'Floor Waxing')
    await user.upload(photoField(), imageFile())
    await user.click(addButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not upload the photo: bucket full')
    expect(insert).not.toHaveBeenCalled()
  })

  it('removes the upload and reports a duplicate when another admin just added the name', async () => {
    const { upload, remove } = mockSupabase({ insertResult: { data: null, error: { code: '23505', message: 'duplicate' } } })
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), 'Floor Waxing')
    await user.upload(photoField(), imageFile())
    await user.click(addButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('A service named "Floor Waxing" already exists.')
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]])
  })

  it('removes the upload and keeps the typed name when the insert is blocked', async () => {
    const { upload, remove } = mockSupabase({ insertResult: { data: [], error: null } })
    const user = setupUser()
    renderManager()
    await findCard('Deep Cleaning')

    await user.type(nameField(), 'Floor Waxing')
    await user.upload(photoField(), imageFile())
    await user.click(addButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(`Could not add the service. ${ADMIN_ERROR}`)
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]])
    expect(nameField()).toHaveValue('Floor Waxing')
  })
})
