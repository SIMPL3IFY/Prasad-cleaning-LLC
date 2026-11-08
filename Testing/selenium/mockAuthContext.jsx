// Test server only auth context
const testUser = {
    id: 'selenium-customer-246',
    email: 'selenium@example.test',
}

const testSession = { user: testUser }

export function AuthProvider({ children }) {
    return children
}

export function useAuth() {
    return {
        session: testSession,
        user: testUser,
        loading: false,
    }
}