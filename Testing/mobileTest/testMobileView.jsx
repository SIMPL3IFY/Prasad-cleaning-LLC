import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Header from '../../src/components/Header'

// Fake AuthContext state
const mockAuth = {
  user: null,
  loading: false,
}

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

// Fake Supabase client. The menu only asks for the account role when Dashboard is clicked.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: { signOut: vi.fn() },
    from: vi.fn(),
  },
}))

vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

const ROOT = path.resolve(__dirname, '../..')
const css = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8')
const indexHtml = readFileSync(path.join(ROOT, 'index.html'), 'utf8')

// Returns the text inside every `@media (<query>) { ... }` block, matching braces so nested rules are kept
function mediaBlocks(query) {
  const blocks = []
  const start = `@media (${query}) {`
  let from = 0
  while (true) {
    const at = css.indexOf(start, from)
    if (at === -1) break
    let depth = 1
    let i = at + start.length
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++
      if (css[i] === '}') depth--
      i++
    }
    blocks.push(css.slice(at + start.length, i - 1))
    from = i
  }
  return blocks
}

// Returns the declarations of the first rule with exactly this selector, or null if there isn't one
function ruleBody(text, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : null
}

const phoneRules = mediaBlocks('max-width: 768px').join('\n')

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/services" element={<div>Services Page</div>} />
        <Route path="/signin" element={<div>Sign In Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Phone menu (mobile view)', () => {
  beforeEach(() => {
    mockAuth.user = null
    mockAuth.loading = false
    vi.clearAllMocks()
  })

  it('starts closed, with the hamburger offering to open it', () => {
    renderHeader()

    const hamburger = screen.getByRole('button', { name: 'Open menu' })
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('navigation', { name: 'Main' })).not.toHaveClass('nav-open')
  })

  it('opens the menu and switches the hamburger to "Close menu"', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass('nav-open')
    const hamburger = screen.getByRole('button', { name: 'Close menu' })
    expect(hamburger).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes the menu when the hamburger is clicked again', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(screen.getByRole('navigation', { name: 'Main' })).not.toHaveClass('nav-open')
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('lists every page link in the open menu', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const label of ['Services', 'About', 'Testimonials', 'Service Areas', 'Contact']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('closes the menu after a page link is clicked', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Services' }))

    expect(screen.getByText('Services Page')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).not.toHaveClass('nav-open')
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument()
  })

  it('only shows the account buttons in the menu while it is open', async () => {
    const user = userEvent.setup()
    renderHeader()
    const nav = screen.getByRole('navigation', { name: 'Main' })

    expect(within(nav).queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(within(nav).getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('shows Dashboard and Sign Out in the open menu when signed in', async () => {
    mockAuth.user = { id: 'customer-1' }
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Sign Out' })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument()
  })

  it('leaves the account buttons out of the open menu while the session is loading', async () => {
    mockAuth.loading = true
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).queryByRole('button')).not.toBeInTheDocument()
  })

  it('goes to the sign in page from the menu and closes it', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Sign In Page')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).not.toHaveClass('nav-open')
  })
})

// jsdom doesn't apply stylesheets, so these read the CSS itself to check the rules the phone layout depends on
describe('Phone layout rules (src/index.css and index.html)', () => {
  it('tells the browser to use the device width', () => {
    expect(indexHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0" />')
  })

  it('hides the hamburger by default, so it only appears on small screens', () => {
    expect(ruleBody(css, '.hamburger')).toMatch(/display:\s*none/)
  })

  it('shows the hamburger at 768px and below', () => {
    expect(ruleBody(phoneRules, '.hamburger')).toMatch(/display:\s*flex/)
  })

  it('hides the page links at 768px and below until the menu is open', () => {
    expect(ruleBody(phoneRules, '.nav')).toMatch(/display:\s*none/)
    expect(ruleBody(phoneRules, '.nav.nav-open')).toMatch(/display:\s*block/)
  })

  it('hides the desktop Sign In and Dashboard buttons at 768px and below', () => {
    expect(ruleBody(phoneRules, '.header-actions')).toMatch(/display:\s*none/)
  })

  it('stacks the page links in a column at 768px and below', () => {
    expect(ruleBody(phoneRules, '.nav-list')).toMatch(/flex-direction:\s*column/)
  })

  it('has a smaller layout for narrow phones', () => {
    expect(mediaBlocks('max-width: 480px').length).toBeGreaterThan(0)
  })
})
