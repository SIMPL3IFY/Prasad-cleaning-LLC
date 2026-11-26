import { createClient } from '@supabase/supabase-js'
import { markPasswordRecovery, trackPasswordRecovery } from './passwordRecovery'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Capture the recovery token before Supabase processes and removes the URL fragment.
const recoveryParams = new URLSearchParams(window.location.hash.slice(1))
export const recoveryLinkAccessToken = recoveryParams.get('type') === 'recovery'
  ? recoveryParams.get('access_token')
  : null
export const recoveryLinkError = recoveryParams.get('error')

// Restrict navigation before the client consumes the URL or restores its session.
if (recoveryLinkAccessToken) markPasswordRecovery(recoveryLinkAccessToken)
trackPasswordRecovery({ access_token: recoveryParams.get('access_token') })

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Register before React mounts so an early recovery event cannot be missed.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    markPasswordRecovery(session.access_token)
  }
  trackPasswordRecovery(session)
})
