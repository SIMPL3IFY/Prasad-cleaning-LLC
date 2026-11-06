# SCRUM-239: Testing — Address Verification

## What this tests

Unit tests for the check that a customer's address is real on the quote form:

- `supabase/functions/_shared/address-validation.ts`: the rules that classify an address
- `src/lib/addressValidation.js`: the browser's call to the `validate-address` Edge Function
- `src/components/QuoteForm.jsx`, `AddressFields.jsx` and `AddressSuggestion.jsx`: what the customer sees

Supabase is mocked in the `CheckAddress` and `Form` files, so these tests never touch the real database or spend a Geocodio lookup. The `Logic` file has no mocks because that code is pure.

## Test files

- `Testing/addressVerificationTest/testScrum239Logic.jsx`
- `Testing/addressVerificationTest/testScrum239CheckAddress.jsx`
- `Testing/addressVerificationTest/testScrum239Form.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-239 tests

```bash
npx vitest run Testing/addressVerificationTest
```

### Step 4 — Run all tests together (optional)

```bash
npm run test:run
```

### Step 5 — View coverage report (optional)

```bash
npm run test:coverage
```

After it finishes, open `coverage/index.html` in your browser to see the full report.

---

## Tests included

### `testScrum239Logic.jsx`

| Group | What it checks |
|---|---|
| `formatAddress` | Parts are joined in one format, an empty unit is left out, and spaces are trimmed |
| `addressError` | Missing street or city, bad state, and bad ZIP each give their own message; DC, PR and lowercase states are accepted |
| `cleanParts` | Unusable input returns null; whitespace is cleaned, state is uppercased, and field lengths are capped |
| `isPoBox` | Common PO box spellings are detected; a street like "Box Elder Rd" is not |
| `normalizeText` / `isSameAddress` | Casing, punctuation, abbreviations, ZIP+4 and a dropped unit still match; a different street, city, state or ZIP does not |
| `partsFromComponents` | Geocoder fields map to our fields, the customer's unit is kept when none comes back, and missing components don't crash |
| `classifyGeocodeResponse` | Precise matches are verified, different spellings become suggestions, and PO boxes, no results and rough matches are invalid (accuracy 0.9 passes, 0.89 fails) |
| `classifyGeocodeError` | 422 is invalid; 401, 403, 429 and 5xx are unavailable |

### `testScrum239CheckAddress.jsx`

| Group | What it checks |
|---|---|
| Sending the address | The address and honeypot value are sent, and the result is returned |
| Outages | A thrown call, a missing result, a fetch error, 404 and 5xx all report an outage |
| Refused requests | A 429 shows the server's message; other refusals show the standard message |

### `testScrum239Form.jsx`

| Group | What it checks |
|---|---|
| Required fields | State defaults to CA, unit is optional, and a bad ZIP or state stops the form before any lookup |
| Verified address | The standardized address is saved and the form resets; if saving fails, the input stays |
| Suggested address | "Did you mean ...?" saves nothing until answered; "Use this address" saves with no second lookup; "Edit my address" or editing a field closes it |
| Invalid address | The quote is blocked with the standard message |
| Address check is down | When the geocoder or the function is down, the quote still saves what was typed |
| Rate limit | The message is shown and nothing is saved |
| Honeypot | A filled hidden field looks like success, but nothing is checked or saved |
| While the address is being checked | The button reads "Verifying address...", the form locks, and a second submit is ignored |
| `AddressFields` | All 5 inputs render, state and ZIP have length limits, and changes keep the other fields |
| `AddressSuggestion` | Renders nothing without a suggestion, each button calls its handler, and both disable while loading |

---

## How the mock works

`mockSupabase()` in the `Form` file fakes the address check and `from('quotes').insert()`. Each test can override one response, for example `mockSupabase({ check: checkResult({ status: 'invalid', reason: 'po_box' }) })`.

A refused or crashed function is faked the way supabase-js reports it: `{ name: 'FunctionsHttpError', context: { status, json } }`.

The form tests use `fireEvent.submit` instead of clicking the button, the same as the SCRUM-235 tests, so the browser's built-in checks don't block the submit before the form's own validation runs.

---

## Manual checks

The Edge Function handler (`supabase/functions/validate-address/index.ts`) runs on Deno, so Vitest can't test it. These need the deployed function and a real `GEOCODIO_API_KEY`.

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | Submit a real address | Quote saves with the standardized address | Passed |
| 2 | Submit a made-up street | "We couldn't verify this address" and no quote | Passed |
| 3 | Submit a misspelled address | "Did you mean ...?" appears | Passed (tested with a wrong ZIP, not a misspelling) |
| 4 | Submit a PO box | "We couldn't verify this address" and no quote | Passed |
| 5 | Send 11 checks within 60 seconds | The 11th gets the "Too many requests" message | Passed |
| 6 | Unset `GEOCODIO_API_KEY` and submit | Quote still saves what was typed | Passed |
| 7 | Repeat on the Home and Contact pages | Both behave the same | Passed |
| 8 | Look at `quotes.address` in the database | It holds the standardized address | Passed |
