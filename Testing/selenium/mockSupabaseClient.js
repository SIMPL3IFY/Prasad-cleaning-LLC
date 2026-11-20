// Selenium-only in-memory Supabase replacement.
// It records inserts and never sends requests to a Supabase project.
export const recoveryLinkAccessToken = null
export const recoveryLinkError = null

const testUser = {
  id: 'selenium-customer-246',
  email: 'selenium@example.test',
}

export const seleniumState = {
  insertedReviews: [],
  signUpCalls: [],
  signUpError: null,
}

export const supabase = {
  auth: {
    signUp: async (credentials) => {
      seleniumState.signUpCalls.push(credentials)
      return { data: { session: null }, error: seleniumState.signUpError }
    },
    getUser: async () => ({
      data: { user: testUser },
      error: null,
    }),
    signOut: async () => ({ error: null }),
  },

  from(table) {
    if (table === 'profiles') {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ 
          data: { is_admin: false },
          error: null,
        }),
      }

      return query
    }
    if (table === 'services') {
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => ({ data: [], error: null }),
      }

      return query
    }

    if (table === 'customer_reviews') {
      return {
        insert: async (review) => {
          seleniumState.insertedReviews.push(review)
          return { data: [review], error: null }
        },
      }
    }

    throw new Error(`Unexpected Supabase table in Selenium test: ${table}`)
  },
}

if (typeof window !== 'undefined') {
  window.__SCRUM246_MOCK__ = seleniumState
  window.__SCRUM228_MOCK__ = seleniumState
}