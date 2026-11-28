# SCRUM-230: Testing — Customer Reviews

## What this tests

Unit tests for the **Customer Reviews** box and its **View Review Table** popup in the admin dashboard (`src/pages/AdminDashboard.jsx`): how reviews are listed, and how the admin approves or rejects them.

Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`. These tests never touch the real database and never change a real review.

## Test file

`Testing/adminReviewsTest/testScrum230Reviews.jsx`

## How to run

No dev server or `.env` is needed. These tests also run in CI on every pull request.

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the Customer Reviews tests

```bash
npx vitest run Testing/adminReviewsTest
```

You should see output like this:

```
✓ Testing/adminReviewsTest/testScrum230.jsx (8 tests)

Test Files  1 passed (1)
     Tests  8 passed (8)
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
| 1 | Pending and Approved | Reviews are split into Pending and Approved, each with name, text, stars and the right button (SCRUM-135) |
| 2 | Newest first | The newest review is listed first (SCRUM-135) |
| 3 | Close popup | The × button closes the popup (SCRUM-135) |
| 4 | No reviews | "No reviews available." shows when there are none (SCRUM-135) |
| 5 | Load error | A message shows when the reviews query fails (SCRUM-135) |
| 6 | Approve | Approve saves `approved: true` and moves the review to Approved (SCRUM-135) |
| 7 | Reject | Reject saves `approved: false` and moves the review to Pending (SCRUM-135) |
| 8 | Update fails | A failed update shows the error and leaves the review where it was (SCRUM-135) |

**Note:** the load-error message currently uses the green success style and has no `role="alert"`. Test 5 checks the text only, so it will keep passing if the styling is fixed later.

---

## How the mock works

`Testing/adminTestUtils/supabaseMock.js` fakes everything the Customer Reviews box talks to:

- The reviews query, to load the list (or fail)
- The update call, to save `approved: true` or `approved: false` (or return an error)

Each test can override either of them, for example to make the query return no rows or the update return an error.