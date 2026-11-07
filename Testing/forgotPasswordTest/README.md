# SCRUM-231: Forgot password testing

This follows `Testing/README.md` and the shared helpers in `Testing/selenium/`.
It adds tests and instructions only. Website code, dependencies, Supabase schema,
email settings and the existing CI workflow are unchanged.

## Coverage added

| File | Cases | What it checks |
|---|---:|---|
| `testScrum231Request.jsx` | 11 | Opening/back navigation, invalid and normalized email, recovery redirect, generic success, service errors, pending requests and retry feedback |
| `testScrum231Reset.jsx` | 16 | Recovery-session verification, token mismatch, ordinary sign-in rejection, recovery events, password rules, update errors/success, pending requests and subscription cleanup |
| `testScrum231Confirmation.jsx` | 9 | Confirmation-page token format, missing/oversized/malformed hashes, clearing the hash, invalid Supabase URL and return navigation |
| `../selenium/test_forgot_password.py` | 8 default + 1 opt-in | Real-browser navigation, native email validation, application validation, invalid recovery routes and an optional real email request |

Vitest mocks Supabase, so it does not send emails, update passwords or validate a
real server-issued recovery token. A fake token that displays Continue in a unit
test only passes the page's format checks; it is not evidence of a valid reset.
Selenium's default eight tests also make no password-reset requests. They use
the actual running website and the Selenium/Chrome setup from the team guide.

## 1. Check branch and install

In PowerShell at the project root:

```powershell
git branch --show-current
npm.cmd ci
```

The branch should be `scrum-231-forgot-password-testing`, created from the current
main snapshot. Do not put the unmerged Scrum 215 implementation into this branch.
Keep `.env.local` locally configured for running the real website; never commit it.

## 2. Run unit tests

Run just the 36 new cases:

```powershell
npm.cmd run test:run -- Testing/forgotPasswordTest
```

Confirm all three new test files are listed. Then run the complete project checks:

```powershell
npm.cmd run test:run
npm.cmd run test:coverage
npm.cmd run build
```

Open `coverage/index.html` to inspect SignIn, ResetPassword and ResetConfirmation.
Coverage measures executed code; it does not prove delivery of a real email or
successful replacement of a real account password. Do not commit `coverage/`.

## 3. Run browser tests without sending emails

Start the website in terminal 1:

```powershell
npm.cmd run dev
```

In terminal 2, from the same project root:

```powershell
py -m pip install -r Testing/selenium/requirements.txt
Remove-Item Env:RUN_RESET_EMAIL_TEST -ErrorAction SilentlyContinue
Remove-Item Env:TEST_RESET_EMAIL -ErrorAction SilentlyContinue
py -m pytest Testing/selenium/test_forgot_password.py -v
```

If the Python launcher `py` is unavailable, use `python` for those two Python
commands. Chrome must be installed. The shared driver fixture manages ChromeDriver.
The expected default result is **8 passed, 1 skipped**. A skipped email-request
test is intentional and must not be recorded as a completed delivery test.

If Vite uses a different port, set it in terminal 2 before running pytest:

```powershell
$env:BASE_URL = 'http://localhost:5174'
```

For a full browser regression run using the team's existing tests:

```powershell
py -m pytest Testing/selenium -v
```

That command includes existing sign-in tests which contact real Supabase. Their
optional account-login cases require the existing TEST_CUSTOMER_EMAIL and
TEST_CUSTOMER_PASSWORD variables; see `Testing/selenium/README.md`.

## 4. Optional automated real email request

Use a test customer account and inbox you control. This sends a real reset request
and may consume the project's email quota. It does not change the account password.
Do not use a teammate's email or repeatedly run this test while waiting for delivery.

```powershell
$env:RUN_RESET_EMAIL_TEST = '1'
$env:TEST_RESET_EMAIL = 'replace-with-your-test-account-email'
py -m pytest Testing/selenium/test_forgot_password.py -v -k controlled_account
Remove-Item Env:RUN_RESET_EMAIL_TEST
Remove-Item Env:TEST_RESET_EMAIL
```

A pass means the website received a successful request response and displayed its
generic confirmation. Check the inbox manually to prove delivery. Because the
message intentionally does not disclose account existence, an unregistered email
can still display the same message without receiving an email.

## 5. Manual end-to-end recovery test

Use one controlled test account. Know its current password before starting; do
not record either password or any reset token in this README, Git, screenshots,
Jira comments or shared test output.

1. Confirm the old password signs the account in, then sign out.
2. Open `/signin`, select **Forgot password?**, and submit that account's email.
   If step 4 already sent the email, use that message instead of requesting another.
3. Confirm the generic success message and actual inbox delivery (check spam too).
4. Open the email link. If it opens the **Continue** page, click **Continue** once.
   Confirm **Create New Password** opens on the intended website origin.
5. Check invalid inputs: fewer than 8 characters, no special character, and
   mismatched confirmation. They must be rejected without changing the password.
6. Enter matching valid values (at least 8 characters with a special character).
   Confirm the password-updated message appears.
7. Follow **Go to Sign In**. Confirm the old password is rejected and the new
   password signs in successfully. Sign out after testing.
8. Open the already-used email link again in a signed-out private window. It must
   not allow another password update. If there is a Continue page, continue to
   server verification; simply seeing Continue is not proof the token still works.
9. In a fresh signed-out window, visit `/reset-password` without an email token.
   Confirm it rejects the link and offers **Return to Sign In**.
10. For expiry coverage, let a separate unused test link expire according to the
    existing project's configured lifetime, then verify it cannot update a password.
    Record this as not run if no expired link was tested. Do not change shared
    expiry settings just to make the test faster.

The confirmation page clears its one-time hash after loading. Reloading that
page before Continue can produce an invalid-link message; use the original email
link rather than copying the cleaned address bar URL.

## If the real email flow fails

- No email or SMTP error: record the result and inspect Supabase Auth logs and
  the existing SMTP setup with the team. Unit tests cannot establish SMTP health.
- Wrong destination: record the destination origin/path only (omit tokens), then
  inspect the existing Auth redirect URLs and recovery email template.
- Expired/used-link error: request a fresh link for the controlled test account;
  avoid rapid retries which can cause email rate-limit errors.
- A test failure is evidence to investigate, not permission to weaken recovery
  checks or change shared Supabase configuration. Discuss the specific change first.

## Test evidence

Results recorded from Amaan Habib's local console output and manual confirmations
on October 25, 2026. Automated results below were run on his Windows PC; they were
not run in the separate code-preparation environment. No credentials or reset tokens
are included. Reviewers can reproduce the checks using sections 1-5 above and their
own controlled test account.

Tested code baseline: main `5e7d840c97f59e62fa4831ebf4e1622a54c5dc6a` plus the
five SCRUM-231 test/documentation files, on `scrum-231-forgot-password-testing`.
The full-suite result applies to this snapshot, not later changes to main.

| Check | Result | Date / evidence (no credentials or tokens) |
|---|---|---|
| 36 SCRUM-231 Vitest cases | Passed | 2026-10-25: 3 files passed; 36 tests passed |
| Full Vitest suite | Passed | 2026-10-25: 6 files passed; 68 tests passed |
| Coverage report reviewed | Reviewed; partial coverage remains | 2026-10-25: figures below; coverage run also passed all 68 tests |
| Production build | Passed | 2026-10-25: Vite production build completed; bundle-size warning only |
| Default Selenium checks | Passed | 2026-10-25: 8 passed, 1 intentionally skipped in 33.83 seconds |
| Controlled reset request | Passed | 2026-10-25: opt-in browser test: 1 passed, 8 deselected in 4.79 seconds |
| Actual inbox delivery and link destination | Passed (manual) | 2026-10-25: Amaan confirmed receipt and successful navigation through the recovery flow |
| Short password, missing special character and mismatch | Passed (manual) | 2026-10-25: Amaan confirmed the validation checks in section 5 |
| Password update and new-password login | Passed (manual) | 2026-10-25: Amaan confirmed successful update and login with the new password |
| Old-password rejection | Passed (manual) | 2026-10-25: Amaan confirmed the old/new password checks |
| Used-link rejection | Passed (manual) | 2026-10-25: Amaan confirmed the already-used link was rejected during the signed-out/private-window check |
| Expired-link rejection | Not run | A separate unused link was not tested after its configured expiry; used-link rejection does not establish expiry behavior |

### Coverage recorded

These are file-level figures from the full Vitest coverage run, not measurements
of real email delivery or the complete running website.

| File | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `SignIn.jsx` | 100% | 100% | 100% | 100% |
| `ResetPassword.jsx` | 96.69% | 97.05% | 100% | 96.69% |
| `ResetConfirmation.jsx` | 100% | 100% | 66.66% | 100% |

`ResetPassword.jsx` lines 66-69 were not exercised. The confirmation page's Continue
navigation was checked in the real email flow; that manual check does not increase
Vitest function coverage. Overall repository line coverage was 21.09%, since these
suites do not test every page in the website.

### Environment and limitations

- Windows PowerShell, using the existing local Vite website and Google Chrome.
- Python 3.15.1; Selenium 4.51.0; pytest 9.1.1.
- Vitest 2.1.9; Vite 5.4.21. The Chrome version was not recorded.
- React Router future-flag warnings appeared but did not fail the tests.
- The optional email request was skipped in the default browser run and then
  explicitly enabled and passed in its separate run; it was not counted as passed
  while skipped.
- No SMTP, redirect, schema, RLS or other shared Supabase configuration changes
  were made for this scrum. The real recovery test did change the controlled
  account's password through the normal feature.
- No failures were reported in these runs. An unused expired-link test and further
  integration checks after later main changes remain outside the verified results.

## Review scope

Only five new files belong to this scrum: this README, its three JSX test files,
and `Testing/selenium/test_forgot_password.py`. Existing application files and
other scrums' tests are not modified. No new packages or CI changes are required.
Commit/push only after reviewing the results and confirming the Git author and
committer identities. Use Amaan Habib's identity without coauthor trailers.
