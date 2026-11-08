# Selenium functional tests

Black-box tests for customer sign in. They drive a real Chrome browser against the running site.

## Setup (once)

```
pip install -r Testing/selenium/requirements.txt
```

You don't need to download ChromeDriver yourself. Selenium 4 finds the version that matches your Chrome.

## Run

1. Start the site: `npm run dev`
2. In another terminal: `python -m pytest Testing/selenium -v`

To run without opening a browser window, set `HEADLESS=1`.

## Optional tests

These tests are skipped unless you set the variables:

| Variable | Used for |
|---|---|
| `TEST_CUSTOMER_EMAIL`, `TEST_CUSTOMER_PASSWORD` | A real customer account. Checks that signing in reaches `/portal`. |
| `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` | A real admin account. Needed for the admin sign in and Edit Services tests. |
| `BASE_URL` | Site address (default `http://localhost:5173`). |
| `RUN_QUOTE_SAVE_TESTS=1` | Saves real quotes to check the address verification flow. Delete the `Selenium Test 239` rows from `quotes` afterwards. |
| `RUN_SERVICE_WRITE_TESTS=1` | Adds, edits and deletes a real service, which is briefly visible on the live site. If the test stops early, delete any `Selenium Test 253` rows from `services` and their photos from `service-images`. |

PowerShell example:

```
$env:TEST_CUSTOMER_EMAIL = 'you@example.com'; $env:TEST_CUSTOMER_PASSWORD = '...'; python -m pytest Testing/selenium -v
```

| `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` | A real admin account. Needed for `test_admin_sign_in.py` and `test_admin_dashboard.py`. |
| `ALLOW_DATA_CHANGES=1` and `TEST_QUOTE_NAME` | Turns on the admin quote lifecycle test, which changes real data. See below. |

## Admin Dashboard tests (SCRUM-230)

`test_admin_dashboard.py` signs in as the test admin and checks the dashboard in a real browser:

| Test | What it checks | Saves data? |
|---|---|---|
| Every box loads without errors | All six boxes appear and no "Unable to load" error shows (real RLS lets the admin read) | No |
| Reviews popup opens and closes | View Review Table shows the groups and × closes it | No |
| Search with no match empties every box | Search filters all four lists, and Hide Search restores it | No |
| Time category shows a time picker | Scrum 219 search field | No |
| Decline without a reason is blocked | Validation message, then Cancel | No |
| Accept, then Cancel, keeps the quote | The confirm popup closes and the quote stays pending | No |
| Cancel appointment without a reason is blocked | Validation message, then Keep Appointment | No |
| Update with no changes is blocked | "No changes to save" message, then Cancel | No |
| Quote lifecycle | Accept, then cancel with a reason, then Move to Manage Quotes | **Yes (opt-in)** |

Tests that need a pending quote or an appointment skip themselves when the database has none.

### The lifecycle test (changes real data)

1. On the site, submit a quote with **your own email** and a unique name, for example `Selenium Test 230`.
2. Run with the extra variables:

```
$env:ALLOW_DATA_CHANGES = '1'; $env:TEST_QUOTE_NAME = 'Selenium Test 230'
python -m pytest Testing/selenium/test_admin_dashboard.py -v
Remove-Item Env:ALLOW_DATA_CHANGES
```

It ends with the quote back in Manage Quotes, so you can run it again.
Each run sends real emails: the quote-accepted email to you, and the cancellation email
to you **and to the business admin address**.