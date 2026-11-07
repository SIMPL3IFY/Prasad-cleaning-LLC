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
  it('renders the main banner and eyebrow text', () => {
    renderAbout()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders company background section (Who We Are)', () => {
    renderAbout()
    expect(screen.getByRole('heading', { name: /who we are/i })).toBeInTheDocument()
  })

  it('renders service offerings list (What We Offer) structurally', () => {
    renderAbout()
    
    // Find the section heading
    const offerHeading = screen.getByRole('heading', { name: /what we offer/i })
    expect(offerHeading).toBeInTheDocument()

    // Find the list container element and check that list items exist inside it
    const list = screen.getByRole('list')
    const listItems = within(list).getAllByRole('listitem')
    expect(listItems.length).toBeGreaterThan(0)
  })

  it('renders value proposition cards (Why Clients Choose Us) structurally', () => {
    renderAbout()
    
    // Find the section heading
    expect(screen.getByRole('heading', { name: /why clients choose us/i })).toBeInTheDocument()

    // Query article elements (value cards) rather than specific text
    const valueCards = document.querySelectorAll('article.about-value-card')
    expect(valueCards.length).toBeGreaterThan(0)
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
