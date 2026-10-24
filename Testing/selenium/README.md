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
| `BASE_URL` | Site address (default `http://localhost:5173`). |

PowerShell example:

```
$env:TEST_CUSTOMER_EMAIL = 'you@example.com'; $env:TEST_CUSTOMER_PASSWORD = '...'; python -m pytest Testing/selenium -v
```
