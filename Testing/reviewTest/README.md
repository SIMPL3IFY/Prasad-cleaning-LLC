**# SCRUM-246: Testing — Customer Review Submission**

**## What this tests**

Unit tests and Selenium end-to-end tests for the review submission form in
`src/pages/CustomerPortal.jsx`. Reviews are submitted to the
`customer_reviews` table as pending reviews (`approved: false`).

Supabase is mocked in both test types. No real customer review is created.

**## Test files**

- Unit tests: `Testing/reviewTest/testScrum246.jsx`
- Selenium tests: `Testing/selenium/test_customer_review.py`

**## How to run**

**### Step 1 — Make sure you are in the project root**

```bash
cd path/to/Prasad-cleaning-LLC
```

**### Step 2 — Install dependencies**

Install the Node dependencies if needed:

```bash
npm install
```

Install the Selenium dependencies once:

```bash
py -m pip install -r Testing/selenium/requirements.txt
```

On macOS or Linux, use `python3 -m pip` instead of `py -m pip`.

**### Step 3 — Run the SCRUM-246 unit tests**

```bash
npm run test:run -- Testing/reviewTest/testScrum246.jsx
```

The unit tests mock the Supabase client and services hook. They do not connect
to the live Supabase project.

Expected output:

```text
✓ Testing/reviewTest/testScrum246.jsx (2 tests)

Test Files  1 passed (1)
     Tests  2 passed (2)
```

**### Step 4 — Run the Selenium tests**

The Selenium tests must use the mock-configured Vite server. Start it in one
terminal and leave it running:

```bash
npm run dev -- --config Testing/selenium/vite.config.js --host 127.0.0.1 --port 5173 --strictPort
```

In a second terminal, run the tests.

For Windows PowerShell:

```powershell
$env:BASE_URL = "http://127.0.0.1:5173"
$env:HEADLESS = "1"
py -m pytest Testing/selenium/test_customer_review.py -v
```

For macOS or Linux:

```bash
BASE_URL=http://127.0.0.1:5173 HEADLESS=1 python3 -m pytest Testing/selenium/test_customer_review.py -v
```

Expected output:

```text
Testing/selenium/test_customer_review.py::test_customer_can_submit_review_to_in_memory_mock PASSED
Testing/selenium/test_customer_review.py::test_empty_review_shows_validation_without_an_insert PASSED

2 passed
```

To watch Chrome during the test, omit `HEADLESS=1` in PowerShell or the
`HEADLESS=1` environment setting on macOS or Linux.

**### Step 5 — Run all unit tests (optional)**

```bash
npm run test:run
```

**### Step 6 — View the coverage report (optional)**

```bash
npm run test:coverage
```

After it finishes, open `coverage/index.html` in your browser.

**---**

**## Tests included**

| # | Test | What it checks |
|---|---|---|
| 1 | Unit: valid submission | Checks that the mocked Supabase client receives the customer name, review, rating, user ID, and `approved: false`; verifies the success message appears |
| 2 | Unit: empty submission | Checks that required-field messages appear and Supabase is not called |
| 3 | Selenium: valid submission | Opens the local portal, submits a review in Chrome, checks the success message, and verifies the review was recorded in the in-memory mock |
| 4 | Selenium: empty submission | Checks the required-field messages in Chrome and verifies that no review was inserted into the mock |

**---**

**## How the mocks work**

The unit tests mock `src/lib/supabaseClient` and `useServices`. They verify
review submission behavior without making live Supabase requests.

The Selenium-only Vite config in `Testing/selenium/vite.config.js` replaces the
Supabase client and auth context with test mocks. The browser uses a fixed fake
user, and review inserts are stored in browser memory for assertions. The tests
do not use Supabase credentials or write public customer reviews.

Run the Selenium test with the mock-configured Vite command above. The test
checks that the mock is active and that the server address is local before it
submits anything.