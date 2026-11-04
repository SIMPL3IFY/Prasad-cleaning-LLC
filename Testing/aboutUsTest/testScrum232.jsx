/**
 * Unit tests for the About Us page (SCRUM-232).
 * Validates rendering of company details, logo, services offered, and core values.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import About from '../../src/pages/About'

describe('About Us Page (SCRUM-232)', () => {
  it('renders the company logo with correct alt text', () => {
    render(<About />)
    const logoImage = screen.getByAltText("Prasad's Cleaning Services LLC logo")
    expect(logoImage).toBeInTheDocument()
    expect(logoImage).toHaveAttribute('src')
  })

  it('renders the main heading and company background information', () => {
    render(<About />)
    
    // Main heading
    expect(screen.getByRole('heading', { name: /^about us$/i })).toBeInTheDocument()

    // Owner and regional presence mentioned in the description
    expect(screen.getByText(/Nigel Prasad/i)).toBeInTheDocument()
    expect(screen.getByText(/Northern California/i)).toBeInTheDocument()
    expect(screen.getByText(/Bay Area/i)).toBeInTheDocument()
  })

  it('renders the "What We Offer" section and all cleaning services', () => {
    render(<About />)

    expect(screen.getByRole('heading', { name: /what we offer/i })).toBeInTheDocument()

    const expectedServices = [
      'Commercial Cleaning',
      'Residential Window Cleaning',
      'Carpet Cleaning',
      'Janitorial Services',
      'Floor Cleaning',
      'Stripping and Wax Services',
    ]

    expectedServices.forEach((service) => {
      expect(screen.getByText(service)).toBeInTheDocument()
    })
  })

  it('renders the "Why Clients Choose Us" section with all three core value cards', () => {
    render(<About />)

    expect(screen.getByRole('heading', { name: /why clients choose us/i })).toBeInTheDocument()

    // Value 1: Reliable
    expect(screen.getByRole('heading', { name: /^reliable$/i })).toBeInTheDocument()
    expect(screen.getByText(/consistent, high-quality service that customers can count on/i)).toBeInTheDocument()

    // Value 2: Detail-Oriented
    expect(screen.getByRole('heading', { name: /^detail-oriented$/i })).toBeInTheDocument()
    expect(screen.getByText(/finishing touches that improve the whole space/i)).toBeInTheDocument()

    // Value 3: Professional
    expect(screen.getByRole('heading', { name: /^professional$/i })).toBeInTheDocument()
    expect(screen.getByText(/respect, clear communication, and care/i)).toBeInTheDocument()
  })
})
