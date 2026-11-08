# SCRUM-251: Customer Portal Testing

## Unit tests

Run from the repository root:

```bash
npx vitest run Testing/customerPortalTest/testScrum251.jsx

## Running the Selenium Tests

These tests use a local Vite server and a designated test customer in a dedicated test Supabase project. Do not run them against the production website or use a production customer account.

### 1. Install dependencies

From the repository root, install the project dependencies if needed:

```bash
npm install
```

Install the Selenium test dependencies:

```bash
python -m pip install -r Testing/selenium/requirements.txt
```

### 2. Configure the test environment

Configure the local Vite environment to use a dedicated test Supabase project. Create a confirmed standard test customer with `is_admin = false`.

Set `TEST_CUSTOMER_EMAIL` and `TEST_CUSTOMER_PASSWORD` in the terminal where you will run pytest. Do not add test credentials to the repository or this README.

Linux/macOS:

```bash
export TEST_CUSTOMER_EMAIL="test-customer@example.com"
export TEST_CUSTOMER_PASSWORD="your-test-password"
```

Windows PowerShell:

```powershell
$env:TEST_CUSTOMER_EMAIL = "test-customer@example.com"
$env:TEST_CUSTOMER_PASSWORD = "your-test-password"
```

### 3. Start the local website

In one terminal, from the repository root, start the Vite development server:

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Leave the server running while Selenium tests execute.

### 4. Run the customer portal tests

Open a second terminal, go to the repository root, and run:

```bash
python -m pytest Testing/selenium/test_customer_portal.py -v
```

The tests check that a signed-out visitor cannot access `/portal` and that the designated test customer can sign in and reach the portal. They do not submit reviews, appointments, quotes, or other customer changes.

If the test customer variables are not set, the signed-out access test can still run, but the sign-in test will be skipped.