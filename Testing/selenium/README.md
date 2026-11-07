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
