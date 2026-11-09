import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import About from '../../src/pages/About'

function renderAbout() {
  return render(
    <MemoryRouter initialEntries={['/about']}>
      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<div>Contact Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('About Page (SCRUM-232)', () => {
  
  it('renders the main banner with h1 page title and eyebrow text', () => {
    renderAbout()
    
    // Explicitly verify the h1 title text to catch title breaks
    const title = screen.getByRole('heading', { level: 1, name: /about us/i })
    expect(title).toBeInTheDocument()
    expect(screen.getByText(/locally owned & operated/i)).toBeInTheDocument()
    expect(screen.getByText(/reliable, high-quality cleaning for homes and businesses/i)).toBeInTheDocument()
  })

  it('renders company background section (Who We Are) with complete narrative text', () => {
    renderAbout()
    
    expect(screen.getByRole('heading', { level: 2, name: /who we are/i })).toBeInTheDocument()
    
    // Verify specific paragraph content so hiding paragraphs causes a failure
    expect(screen.getByText(/Prasad's Cleaning Services LLC is a locally owned cleaning company/i)).toBeInTheDocument()
    expect(screen.getByText(/Owned and operated by Nigel Prasad/i)).toBeInTheDocument()
    expect(screen.getByText(/We take pride in professionalism, attention to detail/i)).toBeInTheDocument()
  })

  it('renders service offerings list (What We Offer) dynamically', () => {
    renderAbout()
    
    expect(screen.getByRole('heading', { level: 2, name: /what we offer/i })).toBeInTheDocument()

    const list = screen.getByRole('list')
    const listItems = within(list).getAllByRole('listitem')
    
    // Flexibly verifies that list items render without hardcoding the total count
    expect(listItems.length).toBeGreaterThan(0)
    
    // Verifies key core services exist within the list
    expect(within(list).getByText(/commercial cleaning/i)).toBeInTheDocument()
    expect(within(list).getByText(/carpet cleaning/i)).toBeInTheDocument()
  })

  it('renders value proposition cards (Why Clients Choose Us) with specific card titles', () => {
    renderAbout()
    
    const valuesSectionHeading = screen.getByRole('heading', { level: 2, name: /why clients choose us/i })
    expect(valuesSectionHeading).toBeInTheDocument()

    // Query value card titles explicitly using level 3 headings inside cards
    expect(screen.getByRole('heading', { level: 3, name: /^reliable$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /^detail-oriented$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /^professional$/i })).toBeInTheDocument()
  })

  it('navigates to contact page when CTA button is clicked', async () => {
    const user = userEvent.setup()
    renderAbout()

    const ctaButton = screen.getByRole('link', { name: /request a quote/i })
    expect(ctaButton).toHaveAttribute('href', '/contact')

    await user.click(ctaButton)
    expect(await screen.findByText('Contact Page')).toBeInTheDocument()
  })
})
