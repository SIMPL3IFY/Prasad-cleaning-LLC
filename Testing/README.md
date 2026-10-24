# Testing Guide

This project has two kinds of tests:

| Kind | Tool | What it checks | Where |
|---|---|---|---|
| **Unit tests** | Vitest + React Testing Library | One page or component at a time, with Supabase faked | `Testing/` or next to the file in `src/` |
| **Functional tests** | Selenium + pytest (Python) | The whole running site in real Chrome, with real Supabase | [`Testing/selenium/`](selenium/README.md) |

Unit tests run automatically on every pull request (see [CI](#ci-automatic-tests-on-pull-requests)).

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

## Functional tests (Selenium)

See [`selenium/README.md`](selenium/README.md). In short:

```
pip install -r Testing/selenium/requirements.txt
npm run dev                                # terminal 1
python -m pytest Testing/selenium -v       # terminal 2
```

New Selenium test files go in `Testing/selenium/` and must be named `test_*.py`. Use the helpers in [`conftest.py`](selenium/conftest.py) (`open_page`, `wait_for_text`, `button`, `scroll_and_click`, and so on).

## CI: automatic tests on pull requests

[`.github/workflows/tests.yml`](../.github/workflows/tests.yml) runs `npm run test:run` on every pull request and every push to `main`. If any unit test fails, the PR shows a red ❌. Click **Details** to see which test failed, fix it, and push again.

Only unit tests run in CI. Selenium tests need the site running and a real account, so run those yourself before your PR.

## Before you open a PR

1. `npm run test:run` passes.
2. You added or updated tests for the code you changed.
3. If you changed sign in or another flow with Selenium tests, run them with the dev server running.
