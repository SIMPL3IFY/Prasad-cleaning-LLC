# Security attack tests

These tests attack the **live** Supabase backend and the deployed site the way a bad actor would. They send raw HTTP using only the public key from the JavaScript bundle and never go through the UI.

**A failing test means we found a hole.** Each test passes only when the attack is blocked.

Plan and background: the "Security Attack Test Plan" shared doc.

## Setup (once)

```
pip install -r Testing/securityTest/requirements.txt
```

Add these to `.env`, or set them in your shell. They're the same accounts the Selenium tests use:

| Variable | What it is | Without it |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Already in `.env` | Nothing runs |
| `TEST_CUSTOMER_EMAIL`, `TEST_CUSTOMER_PASSWORD` | A throwaway **customer** account (never an admin) | Logged-in attacks skip |
| `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` | A test **admin** account, used to check results and clean up | Every test that writes data skips |
| `SITE_URL` | Deployed site (default `https://prasadscleaning.com`) | |

## Run

```
python -m pytest Testing/securityTest -v -m "not quota"
```

At the end it prints `[security] cleanup for SECTEST-xxxx: leftovers: none`. Anything listed as a leftover is a row or file you need to delete in the Supabase dashboard. Search for the `SECTEST-` marker.

### Rate-limit tests (run once, on purpose)

```
python -m pytest Testing/securityTest -v -m quota
```

These use up to about 23 Geocodio lookups, send one password-reset email to the test customer, and **lock your IP out of signing in for about 5 minutes** (the brute-force test).

## What each file attacks

| File | Attacks |
|---|---|
| `test_sql_injection.py` | SQL in filters, quote form fields, RPC parameters, Edge Function bodies |
| `test_access_control_anon.py` | A visitor with no account reading, changing or deleting data |
| `test_access_control_customer.py` | A customer making themselves admin, reading or changing other users' data, approving their own review |
| `test_rpc_abuse.py` | Calling admin-only and cron-only database functions directly |
| `test_edge_functions.py` | Missing or forged webhook secrets, cron secrets, review tokens and JWTs; bad input; CORS; rate-limit bypass |
| `test_auth_attacks.py` | Forged and tampered JWTs, email enumeration, weak passwords, brute force |
| `test_storage.py` | Uploading, overwriting, moving, deleting or listing service photos |
| `test_xss_stored.py` | Script payloads in the quote form; scans the code for unsafe HTML rendering |
| `test_site_exposure.py` | Security headers, HTTPS redirect, exposed files, secrets and source maps in the bundle |

## How the tests stay safe on production

- Attackers only ever target **canary** rows and files that the test admin creates for that run, never real customer data. If an attack gets through, only the canary changes.
- Every row a test writes contains `SECTEST-<run id>`, and cleanup deletes them at the end.
- If the customer-to-admin escalation ever works, the test immediately sets `is_admin` back to false.
- No real session is ever sent to `delete-account`.
- No load testing, no scanners like sqlmap or ZAP, no attacks on Supabase's or Vercel's own systems.
- Not run in CI: it needs live credentials and writes to production.

Note: Cloudflare sits in front of Supabase and blocks obvious attack strings with a 403 page. The tests count that as blocked.
