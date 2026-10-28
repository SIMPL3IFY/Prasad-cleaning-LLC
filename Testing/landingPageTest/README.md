# SCRUM-235: Testing — Landing Page

## What this tests

Unit tests for the landing page (`src/pages/Home.jsx`) and the quote form it uses (`src/components/QuoteForm.jsx`).

Supabase is fully mocked so these tests never touch the real database.

## Test file

`Testing/landingPageTest/testScrum235.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-235 tests

```bash
npx vitest run Testing/landingPageTest/testScrum235.jsx
```

You should see output like this:

```
✓ Testing/landingPageTest/testScrum235.jsx (11 tests)

Test Files  1 passed (1)
     Tests  11 passed (11)
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
| 1 | Book Now link | Clicking "Book Now" goes to the Contact page |
| 2 | Our Services link | Clicking "Our Services" goes to the Services page |
| 3 | Featured services only | Services marked as featured are shown; non-featured ones are not |
| 4 | Service card flip | Clicking a service card flips it (`aria-pressed` becomes `true`) |
| 5 | Testimonials loading | "Loading testimonials..." shows while reviews are loading |
| 6 | Testimonials shown | Reviews are displayed and the page asks Supabase for at most 3 |
| 7 | Testimonials error | "We could not load testimonials right now." shows if loading fails |
| 8 | Invalid email | Shows "Please enter a valid email address." and nothing is saved |
| 9 | Invalid phone | Shows "Please enter a valid 10-digit phone number." and nothing is saved |
| 10 | Valid quote saves | The quote is inserted into Supabase and a success message appears |
| 11 | Save fails | An error message appears and the user's input stays in the form |

---

## How the mock works

`mockSupabase()` fakes the three tables the landing page uses, each with the same chain of calls as the real code:

- `services`: `from().select().eq().order()`, plus `storage.from().getPublicUrl()` for the card images
- `customer_reviews`: `from().select().eq().order().limit(3)`
- `quotes`: `from().insert()`

Each test can override one response, for example `mockSupabase({ reviews: new Promise(() => {}) })` to keep the testimonials loading forever.

The quote form tests use `fireEvent.submit` instead of clicking the button, so the browser's built-in `type="email"` check doesn't block the submit before the form's own validation runs.
