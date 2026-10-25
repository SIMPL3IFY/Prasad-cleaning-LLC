# SCRUM-238: Testing Scheduling Page

Unit tests for the scheduling flow — from the Customer Portal's "Schedule Appointment" button through to the Contact page quote form submission.

## Files

| File | What it tests |
|---|---|
| `testScrum238.jsx` | CustomerPortal scheduling button, navigation to Contact, QuoteForm fields and validation |

## What each test covers

### 1. Renders the Schedule Appointment button on the Customer Portal
Confirms that a logged-in user on the Customer Portal can see the "Schedule Appointment" button.

### 2. Clicking Schedule Appointment navigates to the Contact page
Clicks the button and verifies the router moves to `/contact`.

### 3. Contact page form loads with all required fields
Renders the Contact page and checks that all 7 required inputs are present: Name, Email, Phone, Address, Property Type (select), Service Type (select), and the message textarea.

### 4. Submitting an incomplete form shows a validation error
Submits the form while it is empty and confirms a validation error ("Please enter your name.") appears. The submit button is disabled until all fields are filled, so the form element is submitted directly to trigger the validation logic.

### 5. A valid form submission saves the request and shows a success message
Fills in every required field with valid data, clicks "Get My Free Quote", and confirms Supabase's `quotes` table is called and the success message appears.

### 6. Schedule Appointment is only accessible within the authenticated portal
The Customer Portal (which contains the scheduling button) is wrapped in a `ProtectedRoute` in `App.jsx`. This test confirms the portal renders the Sign Out button alongside the scheduling button, showing it is an authenticated-only page.

## How to run

From the project root:

```bash
npx vitest run Testing/schedulingTest/testScrum238.jsx
```

To run all tests at once:

```bash
npx vitest run
```

To see coverage:

```bash
npx vitest run --coverage
```

## Mocks used

- **`src/lib/supabaseClient`** — mocked so tests never touch the real Supabase project. `supabase.from` and `supabase.auth` are replaced with Vitest spy functions.
- **`src/hooks/useServices`** — returns an empty services array so the CustomerPortal renders without fetching from the database.
