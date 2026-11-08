# Testing Guide

This project has three kinds of tests:

| Kind | Tool | What it checks | Where |
|---|---|---|---|
| **Unit tests** | Vitest + React Testing Library | One page or component at a time, with Supabase faked | `Testing/` or next to the file in `src/` |
| **Email notification tests** | `deno test` | The emails our Supabase Edge Functions send, with Resend, Supabase and fetch faked | [`Testing/emailNotificationsTest/`](emailNotificationsTest/) |
| **Functional tests** | Selenium + pytest (Python) | The whole running site in real Chrome, with real Supabase | [`Testing/selenium/`](selenium/README.md) |

Unit tests and email notification tests run automatically on every pull request (see [CI](#ci-automatic-tests-on-pull-requests)).

## Quick start

```
npm install              # once, and after pulling new dependencies
npm test                 # watch mode: re-runs tests when you save
npm run test:run         # run all tests once
npm run test:coverage    # run once and show which lines were tested
```

## ⚠️ Name your test files correctly

Vitest **only** finds files that match one of these patterns. A file with any other name is skipped silently: no error, the tests just never run.

| Pattern | Example |
|---|---|
| `src/**/*.test.jsx` (or `.js`) | `src/components/QuoteForm.test.jsx` |
| `Testing/**/test*.jsx` (or `.js`) | `Testing/quoteFormTest/testQuoteForm.jsx` |

To make sure your file was picked up, check that it's listed in the `npm run test:run` output.

## Writing a unit test

Copy this template and change the component and the checks. [`signInTest/testScrum1.jsx`](signInTest/testScrum1.jsx) (sign in) is a full working example.

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import MyPage from '../../src/pages/MyPage'

// Fake Supabase so tests never touch the real database
const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
  },
}))
vi.mock('../../src/lib/supabaseClient', () => ({ supabase }))

describe('My Page', () => {
  beforeEach(() => {
    vi.clearAllMocks() // reset the fakes so tests don't affect each other
  })

  it('shows a message after clicking Save', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><MyPage /></MemoryRouter>)

    await user.type(screen.getByLabelText(/name/i), 'Larry')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Saved!')).toBeInTheDocument()
  })
})
```

### Faking Supabase

Our project rules say not to mock Supabase unless you really have to. In unit tests you do: the real client needs network access and `.env` keys, and it changes real data. Fake only the functions your page calls, and set what each one returns in the test:

```js
// Something your page awaits, e.g. supabase.auth.signInWithPassword(...)
supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

// An error response
supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } })

// A request that never finishes, to test "Loading..." states
supabase.auth.signInWithPassword.mockReturnValue(new Promise(() => {}))
```

For database queries like `supabase.from('profiles').select('*').eq('id', x).maybeSingle()`, build the chain so each step returns the next one:

```js
const maybeSingle = vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null })
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
supabase.from.mockReturnValue({ select })
```

Then you can check what the page asked for: `expect(supabase.from).toHaveBeenCalledWith('profiles')`.

### Tips

- **Find elements the way a user would:** `getByRole('button', { name: /save/i })`, `getByLabelText(/email/i)`, `getByText(...)`. Avoid class names and IDs.
- **`getBy...`** finds something that's already on screen. **`findBy...`** (with `await`) waits for something that appears after a request finishes. **`queryBy...`** returns `null` instead of failing, so use it to check that something is *not* there.
- **Pages that use links or `useNavigate`** must be wrapped in `<MemoryRouter>`. To test that the page changes, render `<Routes>` with stand-in pages (see `renderSignIn` in [`testScrum1.jsx`](signInTest/testScrum1.jsx)).
- **Fields marked `required` or `type="email"`:** the fake browser may block the submit before your code runs. To test your own validation messages, use `fireEvent.submit(form)` instead of clicking the button.
- **Test what the user sees, not the code's internals.** Check messages, buttons and navigation, not state variables.

## Coverage

`npm run test:coverage` prints a table showing how much of each file ran during the tests: statements, branches (both sides of every `if`), functions and lines. It also lists the exact lines that never ran.

For a line-by-line view, open `coverage/index.html` in a browser after running it. Green lines ran, red lines didn't, and yellow marks an `if` where only one side was tested. The `coverage/` folder is regenerated on every run and isn't committed.

Only unit tests count toward coverage. Selenium tests run in a separate browser, so they aren't measured.

## Email notification tests

These test the emails sent by the functions in `supabase/functions/`: who gets them, the subject, reply-to, Pacific date/time, HTML escaping and the `.ics` invite. They need [Deno](https://docs.deno.com/runtime/getting_started/installation/), not `npm install`:

```
cd supabase/functions
deno task test                                 # run all of them
deno task test --filter "escaped"              # only tests with this in the name
```

No real email is sent and no real database is touched. `emailNotificationsTest/import_map.json` swaps in fakes for `serve` and `@supabase/supabase-js`, `emailNotificationsTest/helpers.ts` replaces `fetch`, and the task isn't allowed to use the network, so a missed fake fails the test.

Test files go in `Testing/emailNotificationsTest/` and must end in `.test.ts`. A typical test:

```ts
import { assertEquals } from "@std/assert"
import { APPOINTMENT, CUSTOMER_EMAIL, db, resend, setup } from "./helpers.ts"

Deno.test("sends the customer an email", async () => {
  // Loads a fresh copy of the function. Use env to change or remove (undefined) a setting.
  const call = await setup("sync-appointment", { env: { ADMIN_NOTIFY_EMAIL: "someone@example.com" } })

  // Sign someone in, and decide what the fake database returns
  db.sessions["token"] = { id: "user-id" }
  db.respond = (query) => query.table === "profiles"
    ? { data: { is_admin: true }, error: null }
    : { data: APPOINTMENT, error: null }

  const res = await call({ headers: { Authorization: "Bearer token" }, body: { quoteId: APPOINTMENT.id, mode: "schedule" } })
  assertEquals(res.status, 200)

  // Check what was emailed
  assertEquals(resend.emailTo(CUSTOMER_EMAIL).subject, "...")
})
```

- **A failing Resend:** set `resend.respond = () => new Response("nope", { status: 500 })`.
- **Time windows:** pass `now` to `setup` to freeze `Date.now()`.
- **`RESEND_API_KEY` and other `_shared/email.ts` settings:** that file reads them once on import, so `env` can't change them mid-file. Call `useSharedEnv` at the top of a separate test file, like [`missing_resend_key.test.ts`](emailNotificationsTest/missing_resend_key.test.ts).

## Functional tests (Selenium)

See [`selenium/README.md`](selenium/README.md). In short:

```
pip install -r Testing/selenium/requirements.txt
npm run dev                                # terminal 1
python -m pytest Testing/selenium -v       # terminal 2
```

New Selenium test files go in `Testing/selenium/` and must be named `test_*.py`. Use the helpers in [`conftest.py`](selenium/conftest.py) (`open_page`, `wait_for_text`, `button`, `scroll_and_click`, and so on).

## CI: automatic tests on pull requests

[`.github/workflows/tests.yml`](../.github/workflows/tests.yml) runs `npm run test:run` and the email notification tests on every pull request and every push to `main`. If any test fails, the PR shows a red ❌. Click **Details** to see which test failed, fix it, and push again.

Selenium tests don't run in CI. They need the site running and a real account, so run those yourself before your PR.

## Before you open a PR

1. `npm run test:run` passes.
2. If you changed `supabase/functions/`, `deno task test` passes in that folder.
3. You added or updated tests for the code you changed.
4. If you changed sign in or another flow with Selenium tests, run them with the dev server running.
