# SCRUM-254: Testing — Email Verification

## What this tests

Unit tests for the email confirmation page (`src/pages/AuthCallback.jsx`). This is the `/auth/callback` page that the link in the sign-up confirmation email opens.

Supabase is fully mocked so these tests never touch the real auth server.

## Test file

`Testing/emailVerificationTest/testScrum254.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-254 tests

```bash
npx vitest run Testing/emailVerificationTest/testScrum254.jsx
```

You should see output like this:

```
✓ Testing/emailVerificationTest/testScrum254.jsx (10 tests)

Test Files  1 passed (1)
     Tests  10 passed (10)
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
| 1 | Checking the link | "Confirming your email..." and "Please wait a moment." show while the link is checked |
| 2 | Valid link | "Email confirmed" and "Your email has been verified. Redirecting you to sign in..." show |
| 3 | Late sign-in | The page still confirms if Supabase reports the sign-in after the first check |
| 4 | Signed out | The customer is signed out after confirming, so they sign in themselves |
| 5 | Redirect | The page goes to Sign In 2.5 seconds after confirming, and not before |
| 6 | Go to Sign In (confirmed) | The link on the confirmed page goes to Sign In |
| 7 | Confirms once | If Supabase reports the sign-in twice, the page still confirms (and signs out) only once |
| 8 | Expired or used link | "Confirmation failed" and Supabase's error message show, and the page doesn't try to confirm |
| 9 | Nothing confirms | After 5 seconds with no sign-in, "This confirmation link is invalid or has expired." shows |
| 10 | Go to Sign In (failed) | The link on the failed page goes to Sign In so the customer can request a new email |

That sign-up sends the email with a link to `/auth/callback` is already tested in `Testing/signUpTest/testScrum228.jsx`.

---

## How the mock works

`mockAuth()` fakes the three auth calls the page makes:

- `getSession()` returns the session passed in (`SESSION` for a valid link, `null` if Supabase hasn't signed the customer in)
- `onAuthStateChange()` saves the page's listener, and `fireAuthEvent('SIGNED_IN', SESSION)` calls it, the way Supabase does once it has read the link
- `signOut()` succeeds

Link errors are read from the real address bar, so `renderAuthCallback(hash)` puts the hash there with `window.history.replaceState`. `EXPIRED_LINK_HASH` matches what Supabase adds to the link when it has expired or was already used.

The redirect (2.5 seconds) and the timeout (5 seconds) tests use Vitest's fake timers, so they run instantly. `advance(ms)` moves the fake clock forward and lets pending promises finish.
