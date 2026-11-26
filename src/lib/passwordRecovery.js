import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

const storageKey = 'prasad-password-recovery'
const listeners = new Set()
let memoryMarker = null
let storageAvailable = true

function getMarker() {
  if (!storageAvailable) return memoryMarker
  try {
    memoryMarker = window.localStorage.getItem(storageKey)
    return memoryMarker
  } catch {
    storageAvailable = false
    return memoryMarker
  }
}

function setMarker(marker) {
  memoryMarker = marker
  try {
    if (storageAvailable) {
      if (marker === null) window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, marker)
    }
  } catch {
    // Match Supabase's in-memory fallback when browser storage is unavailable.
    storageAvailable = false
  }
  listeners.forEach(listener => listener())
}

function getTokenClaims(accessToken) {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(payload))
  } catch {
    return null
  }
}

function getSessionId(accessToken) {
  const sessionId = getTokenClaims(accessToken)?.session_id
  return typeof sessionId === 'string' && sessionId ? sessionId : null
}

function hasRecoveryMethod(accessToken) {
  const methods = getTokenClaims(accessToken)?.amr
  return Array.isArray(methods) && methods.some(entry => entry?.method === 'recovery')
}

export function markPasswordRecovery(accessToken) {
  // Store only the session ID, never the recovery token. It survives token refresh.
  setMarker(getSessionId(accessToken) || 'pending')
}

export function trackPasswordRecovery(session) {
  // Restored sessions and generic SIGNED_IN events may have no recovery URL.
  // This only restricts navigation; Supabase still validates authentication.
  if (hasRecoveryMethod(session?.access_token)) {
    markPasswordRecovery(session.access_token)
  }
}

export function clearPasswordRecovery() {
  // Only a successful password sign-in releases the restriction.
  setMarker(null)
}

export function isRecoverySession(session) {
  const sessionId = getSessionId(session?.access_token)
  return hasRecoveryMethod(session?.access_token) || Boolean(sessionId && getMarker() === sessionId)
}

function subscribe(listener) {
  listeners.add(listener)
  const onStorage = event => {
    if (event.key === storageKey || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function usePasswordRecovery() {
  return useSyncExternalStore(subscribe, getMarker) !== null
}

export function useHideAccountLinks() {
  const recovering = usePasswordRecovery()
  const { pathname, search } = useLocation()
  return recovering || /^\/reset-password(?:\/|$)/i.test(pathname) || /^\/continue\/?$/i.test(pathname) ||
    (pathname.toLowerCase() === '/signin' && new URLSearchParams(search).get('mode') === 'forgot')
}
