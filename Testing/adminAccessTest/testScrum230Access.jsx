// SCRUM-230: Unit tests for admin access and navigation in AdminDashboard.jsx
// Covers the admin check (SCRUM-119), Sign Out (SCRUM 172), the Home link,
// and opening the Edit Services popup (SCRUM-204). Admin Settings is out of scope.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// SCRUM-230: Replace the real Supabase client with the fake
vi.mock('../../src/lib/supabaseClient', async () => {
    const { createSupabaseFake } = await import('../adminTestUtils/supabaseMock')
    return { supabase: createSupabaseFake() }
})

// SCRUM-230: Stand-in for the Edit Services popup. This file only checks that the dashboard
// opens and closes it; the popup's own features need their own tests.
// Uses createElement instead of JSX because vi.mock runs before this file's imports.
vi.mock('../../src/components/ServicePhotosManager', async () => {
    const { createElement: h } = await import('react')
    return {
        default: ({ onClose }) =>
            h('div', null,
                h('p', null, 'Service Photos Manager (stub)'),
                h('button', { onClick: onClose }, 'Close stub'))
    }
})

import { supabase } from '../../src/lib/supabaseClient'
import { setupSupabase } from '../adminTestUtils/supabaseMock'
import { renderDashboard, renderDashboardAsAdmin } from '../adminTestUtils/renderDashboard'

describe('SCRUM-230: Admin access and navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    describe('who can open the dashboard', () => {
        it('shows "Checking admin access..." until the check finishes', async () => {
            setupSupabase(supabase)
            renderDashboard()

            expect(screen.getByText('Checking admin access...')).toBeInTheDocument()
            expect(await screen.findByRole('heading', { level: 2, name: 'Manage Quotes' })).toBeInTheDocument()
            expect(screen.queryByText('Checking admin access...')).not.toBeInTheDocument()
        })

        it('shows every dashboard box to an admin', async () => {
            setupSupabase(supabase)
            await renderDashboardAsAdmin()

            for (const title of ['Completed Appointments', 'Manage Appointments', 'Manage Quotes',
                                 'Declined Quotes', 'Customer Reviews', 'Edit Services']) {
                expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
            }
        })

        it('sends a signed-out visitor to sign in', async () => {
            setupSupabase(supabase, {}, { user: null })
            renderDashboard()

            expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument()
            expect(screen.queryByRole('heading', { name: 'Manage Quotes' })).not.toBeInTheDocument()
        })

        it("sends a signed-in customer (not an admin) to sign in, after checking their own profile", async () => {
            const db = setupSupabase(supabase, {}, { isAdmin: false, user: { id: 'cust-1' } })
            renderDashboard()

            expect(await screen.findByRole('heading', { name: 'Sign In Page' })).toBeInTheDocument()
            const profileCheck = db.calls.find(c => c.table === 'profiles')
            expect(profileCheck.filters).toEqual({ id: 'cust-1' }) // looked up the user's own row
        })

        it('lets the demo admin in without contacting Supabase Auth', async () => {
            setupSupabase(supabase)
            localStorage.setItem('prasad-admin-demo-access', 'true')
            await renderDashboardAsAdmin()

            expect(supabase.auth.getUser).not.toHaveBeenCalled()
        })
    })

    describe('header buttons', () => {
        // SCRUM 172
        it('signs out and returns to the landing page', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase)
            await renderDashboardAsAdmin()

            await user.click(screen.getByRole('button', { name: 'Sign Out' }))

            expect(await screen.findByRole('heading', { name: 'Landing Page' })).toBeInTheDocument()
            expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
        })

        // SCRUM 172: the admin should not leave the page if the session wasn't really ended
        it('stays on the dashboard if sign out fails', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase)
            supabase.auth.signOut.mockResolvedValue({ error: { message: 'network down' } })
            await renderDashboardAsAdmin()

            await user.click(screen.getByRole('button', { name: 'Sign Out' }))

            await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled())
            expect(screen.getByRole('heading', { level: 2, name: 'Manage Quotes' })).toBeInTheDocument()
            expect(screen.queryByRole('heading', { name: 'Landing Page' })).not.toBeInTheDocument()
        })

        it('goes to the landing page with the Home link', async () => {
            const user = userEvent.setup()
            setupSupabase(supabase)
            await renderDashboardAsAdmin()

            await user.click(screen.getByRole('link', { name: 'Home' }))

            expect(await screen.findByRole('heading', { name: 'Landing Page' })).toBeInTheDocument()
        })
    })

    // SCRUM-204
    it('opens and closes the Edit Services popup', async () => {
        const user = userEvent.setup()
        setupSupabase(supabase)
        await renderDashboardAsAdmin()

        await user.click(screen.getByRole('button', { name: 'Manage Services' }))
        expect(screen.getByText('Service Photos Manager (stub)')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Close stub' }))
        expect(screen.queryByText('Service Photos Manager (stub)')).not.toBeInTheDocument()
    })
})