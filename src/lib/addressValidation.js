import { supabase } from './supabaseClient'
import { INVALID_MESSAGE } from '../../supabase/functions/_shared/address-validation.ts'

// SCRUM-239: Same field rules as the validate-address Edge Function (one shared file).
// No API key and no direct geocoder calls here: the Edge Function does the lookup.
export {
  addressError,
  EMPTY_ADDRESS,
  formatAddress,
  INVALID_MESSAGE,
} from '../../supabase/functions/_shared/address-validation.ts'

// SCRUM-239: Asks the validate-address Edge Function whether an address is real. Returns one of:
//   { result }                    the check ran (result.status: verified | suggestion | invalid | unavailable)
//   { outage: true }              function unreachable, not deployed or crashed (network, relay, 404, 5xx);
//                                 the caller saves anyway so a customer is never blocked by an outage
//   { error: 'message to show' }  the function refused the request (bad input 400, rate limit 429)
export async function checkAddress(parts, honeypot = '') {
  let data, error
  try {
    ({ data, error } = await supabase.functions.invoke('validate-address', {
      body: { address: parts, website: honeypot },
    }))
  } catch {
    return { outage: true }
  }
  if (!error) return data?.result ? { result: data.result } : { outage: true }

  // Only FunctionsHttpError carries the Response; fetch/relay errors mean the service is down.
  // 404 also counts as down: it's what Supabase returns when the function isn't deployed.
  const response = error.name === 'FunctionsHttpError' ? error.context : null
  if (!response || response.status >= 500 || response.status === 404) return { outage: true }

  let message = ''
  try {
    message = (await response.json())?.error ?? ''
  } catch { /* response had no JSON body */ }
  if (response.status === 429 && message) return { error: message }
  return { error: INVALID_MESSAGE }
}
