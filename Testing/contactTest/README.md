# SCRUM-245: Testing — Request a Quote / Contact Page

## What this tests

Unit tests for the Contact page (`src/pages/Contact.jsx`) and the shared quote form it uses (`src/components/QuoteForm.jsx`). This is the `/contact` page where customers request a quote.

Supabase is fully mocked so these tests never touch the real database, never create a real quote, and never call the real address check.

## Test file

`Testing/contactTest/testScrum245.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-245 tests

```bash
npx vitest run Testing/contactTest/testScrum245.jsx
```

You should see output like this:

```
✓ Testing/contactTest/testScrum245.jsx (23 tests)

Test Files  1 passed (1)
     Tests  23 passed (23)
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

| # | Test | What it checks |
|---|---|---|
| 1 | Header | The heading "Let's get your space sparkling", the "Request your free quote" title and "All fields are required." show |
| 2 | How it works | All 3 steps show |
| 3 | What we offer | Standard Cleaning, Deep Cleaning, Move-in / Move-Out and Custom Requests are listed |
| 4 | Service area link | "See the cities we serve" goes to the Service Area page |
| 5 | Every field | Name, Email, Phone, Street, Unit, City, State, ZIP and "How can we help?" show |
| 6 | Starting values | Both dropdowns start on their placeholder and the state starts on CA |
| 7 | Property types | The property dropdown offers Residential and Commercial |
| 8 | Service types | The service dropdown offers the four services |
| 9 | Button, empty form | "Get My Free Quote" is disabled while the form is empty |
| 10 | Button, one field missing | The button stays disabled while any one field is empty |
| 11 | Button, all filled | The button is enabled once every field is filled (the unit is optional) |
| 12 | Bad email | An email without a domain ending (`name@example`) shows "Please enter a valid email address." and nothing is sent |
| 13 | Bad phone | A phone number without 10 digits shows "Please enter a valid 10-digit phone number." and nothing is sent |
| 14 | Formatted phone | `(555) 123-4567` is accepted |
| 15 | Blank message | A message that is only spaces shows "Please tell us how we can help." and nothing is sent |
| 16 | Bad ZIP | A ZIP code without 5 digits shows "Please enter a 5-digit ZIP code." and nothing is saved |
| 17 | Saves the quote | The quote is inserted once into `quotes` with trimmed values, the standardized address and `status: 'pending'` |
| 18 | Address check request | The typed address is sent to the `validate-address` function |
| 19 | Address check down | If the address check is down, the quote is saved with what the customer typed |
| 20 | Unverifiable address | An address that can't be verified shows the standard message, nothing is saved, and the input is kept |
| 21 | After success | The thank-you message shows and every field is cleared |
| 22 | Save failure | "Something went wrong submitting your quote. Please try again." shows and the input is kept |
| 23 | While submitting | The button reads "Submitting..." and is disabled, and a second submit is ignored |

---

## How the mock works

`mockSupabase()` fakes the two things the form talks to:

- `from('quotes').insert()` saves the quote and returns `{ error: null }` unless the test says otherwise
- `functions.invoke('validate-address')` is the address check. By default it confirms the address and sends back `123 Main St, Sacramento, CA 95814`

Each test can override either one, for example `mockSupabase({ insertResult: { error: { message: 'db down' } } })` to make saving fail, or `mockSupabase({ addressResult: { data: null, error: new Error('network down') } })` to make the address check unreachable.

`fillQuoteForm()` fills every field with valid values, and any value can be replaced, for example `fillQuoteForm({ phone: '555123456' })`. The unit is left empty because it's optional.

The browser blocks a submit when a required field is empty or the email isn't an email, so the tests that check our own messages call `submitQuoteForm()`, which submits the form directly.

The address check is covered in more detail by the SCRUM-239 tests in `Testing/addressVerificationTest/`. These tests only check that it works as part of the Contact page.

---

## Selenium tests

`Testing/selenium/test_contact_page.py` has 11 functional tests that drive the real site in Chrome. They are not part of `npm run test:run` and don't run in CI, so run them yourself before your PR.

### How to run

```bash
pip install -r Testing/selenium/requirements.txt   # once
npm run dev                                         # terminal 1
python -m pytest Testing/selenium/test_contact_page.py -v   # terminal 2
```

To run without opening a browser window, set `HEADLESS=1`.

### Tests included

| # | Test | What it checks | Saves data? |
|---|---|---|---|
| 1 | Header | The heading, the form title and "All fields are required." show | No |
| 2 | How it works | All 3 steps show | No |
| 3 | What we offer | The four services are listed | No |
| 4 | Service area link | "See the cities we serve" goes to `/service-area` | No |
| 5 | Dropdowns | Both start on their placeholder and offer the right options | No |
| 6 | State | The state starts on CA | No |
| 7 | Button | "Get My Free Quote" stays disabled until every field is filled | No |
| 8 | Bad email | `name@example` shows "Please enter a valid email address." | No |
| 9 | Bad phone | A phone number without 10 digits shows the phone message | No |
| 10 | Bad ZIP | A ZIP code without 5 digits shows the ZIP message | No |
| 11 | Input kept | The typed values are still there after an error | No |

### Why there is no successful-submit test

The tests use the real Supabase project. A successful submit would save a real quote and call the real address check. Every form test here fills in at least one bad value, so the form's own validation stops it before anything is sent. A successful submit is covered by the unit tests above, which fake Supabase.
