# Customer Reviews unit tests (SCRUM-230)

Tests the **Customer Reviews** box and its **View Review Table** popup in `AdminDashboard.jsx`
with Vitest and React Testing Library. Supabase is faked with `Testing/adminTestUtils/supabaseMock.js`,
so no test touches the real database.

## What it checks

| Test | 
|---|---|
| Reviews are split into Pending and Approved, with name, text, stars and the right button | Scrum 135 |
| The newest review is listed first | Scrum 135 |
| The × button closes the popup | Scrum 135 |
| "No reviews available." when there are none | Scrum 135 |
| A message appears when the reviews query fails | Scrum 135 |
| Approve saves `approved: true` and moves the review to Approved | Scrum 135 |
| Reject saves `approved: false` and moves the review to Pending | Scrum 135 |
| A failed update shows the error and leaves the review where it was | Scrum 135 |

Note: the load-error message currently uses the green success style and has no `role="alert"`.
The test checks the text only, so it will keep passing if the styling is fixed later.

## How to run

From the project root:

```
npx vitest run Testing/adminReviewsTest   # just this folder
npm run test:run                          # every unit test
```

No dev server or `.env` is needed. These tests also run in CI on every pull request.