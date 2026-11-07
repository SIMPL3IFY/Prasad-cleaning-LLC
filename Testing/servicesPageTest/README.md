# SCRUM-247: Testing — Services Page

## What this tests

Unit tests for the Services page (`src/pages/Services.jsx`) and the `useServices` hook it uses (`src/hooks/useServices.js`).

Supabase is fully mocked so these tests never touch the real database.

## Test file

`Testing/servicesPageTest/testScrum247.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-247 tests

```bash
npx vitest run Testing/servicesPageTest/testScrum247.jsx
```

You should see output like this:

```
✓ Testing/servicesPageTest/testScrum247.jsx (11 tests)

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
| 1 | Loading message | "Loading services..." shows while services are loading |
| 2 | Loading message hides | The loading message goes away once services load |
| 3 | All active services | Every active service is shown, including ones that aren't featured, and only active services are requested |
| 4 | Name and image | Each card shows the service name and its image from Supabase storage |
| 5 | Flip and flip back | Clicking a card flips it (`aria-pressed` and `is-flipped`), clicking again flips it back |
| 6 | Flip one card only | Clicking one card doesn't flip the others |
| 7 | Admin description | The back of the card shows the admin-written description when there is one |
| 8 | Built-in description | With no admin description, the back shows the built-in one from `ServicesData.jsx` |
| 9 | Default description | With neither, the back shows "Customized cleaning solutions designed around your needs." |
| 10 | Load failure | If loading fails, the built-in list of services is shown instead |
| 11 | Request a quote | The "Request a quote" button links to the Contact page |

---

## How the mock works

`mockSupabase()` fakes the same chain of calls as `useServices`:

- `from('services').select().eq('is_active', true).order()` returns the services
- `storage.from().getPublicUrl()` returns `https://example.com/<image_path>` for each image

`MOCK_SERVICES` has one service for each description case: one with an admin description, one with only a built-in description (Residential Cleaning), and one with neither (Window Cleaning). Window Cleaning is also not featured, which checks that the page shows every service and not only the featured ones.

Each test can override the response, for example `mockSupabase({ services: new Promise(() => {}) })` to keep the page loading forever.

The back of each card is always in the page (the flip is done with CSS only), so the description tests read the text without clicking. The flip tests check `aria-pressed` and the `is-flipped` class instead.
