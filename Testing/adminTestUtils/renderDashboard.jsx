// Scrum-230: Renders AdminDashboard inside a router with stand-in pages,
// so tests can check redirects (/signin) and Sign Out (/).
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminDashboard from '../../src/pages/AdminDashboard' // change if your path differs

export function renderDashboard() {
    return render(
        <MemoryRouter initialEntries={['/admin']}>
            <Routes>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/signin" element={<h1>Sign In Page</h1>} />
                <Route path="/" element={<h1>Landing Page</h1>} />
            </Routes>
        </MemoryRouter>
    )
}

// Scrum-230: Renders, then waits for the admin check to finish ("Checking admin access...")
export async function renderDashboardAsAdmin() {
    const view = renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Manage Quotes' })
    return view
}

// Scrum-230: Returns queries scoped to one dashboard box.
// Several boxes have the same labels and arrows, so checks must stay inside one box.
export function getPanel(title) {
    const heading = screen.getByRole('heading', { level: 2, name: title })
    return within(heading.closest('.admin-panel'))
}