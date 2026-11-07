# SCRUM-249: Testing — Service Area Page

## What this tests

Unit tests for the Service Area page (`src/pages/ServiceArea.jsx`) and the city list it uses (`src/data/cities.json`).

The page doesn't use Supabase, so nothing is faked except the city list in the empty-list test.

## Test file

`Testing/serviceAreaTest/testScrum249.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-249 tests

```bash
npx vitest run Testing/serviceAreaTest/testScrum249.jsx
```

You should see output like this:

```
✓ Testing/serviceAreaTest/testScrum249.jsx (11 tests)

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
| 1 | Every city shown | Each city in `cities.json` is a button under "Cities We Serve", in the same order |
| 2 | Empty city list | "Service areas not available." shows instead of the city list |
| 3 | Map before picking | The map shows the full Northern California service area |
| 4 | Pick a city | The map focuses on the city, "Showing [city]" appears, and the button is marked as selected |
| 5 | Bay Area | The map searches the whole San Francisco Bay Area, since it's a region and not a city |
| 6 | Map scrolls into view | Picking a city scrolls the map into view (needed on phones, where the map is above the list) |
| 7 | Same city again | Clicking the selected city again returns to the full service area |
| 8 | Show full service area | The "Show full service area" button returns to the full service area |
| 9 | One city at a time | Picking a second city replaces the first, and only one button is selected |
| 10 | Get a Free Quote | The button goes to the Contact page |
| 11 | Sign In | The button goes to the Sign In page |

---

## How the mock works

`cities.json` is replaced with a small object that each test can change. `beforeEach` fills it with the real city list, so most tests use the real cities. The empty-list test sets `citiesData.cities = []` before rendering.

The map is a Google Maps iframe, so the tests check its `src` instead of what it draws:

- Full service area: the URL contains the overview coordinates `!2d-121.4944!3d38.5816`
- A city: the URL contains `q=<city>, CA` (URL-encoded)

jsdom doesn't have `scrollIntoView`, which the page calls when a city is clicked, so `beforeEach` replaces it with a fake that the tests can check.
