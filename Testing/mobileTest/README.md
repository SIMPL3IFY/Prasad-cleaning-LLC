# Testing — Mobile View

## What this tests

How the site behaves on a phone: the header's hamburger menu and the layout of the public pages on a small screen.

The unit tests cover the menu in `src/components/Header.jsx` with Supabase faked, and check the mobile rules in `src/index.css` and the viewport tag in `index.html`. jsdom doesn't apply stylesheets, so the unit tests can't see the real layout. The Selenium tests cover that in a real browser.

## Test file

`Testing/mobileTest/testMobileView.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the mobile tests

```bash
npx vitest run Testing/mobileTest/testMobileView.jsx
```

You should see output like this:

```
✓ Testing/mobileTest/testMobileView.jsx (16 tests)

Test Files  1 passed (1)
     Tests  16 passed (16)
```

### Step 4 — Run all tests together (optional)

```bash
npm run test:run
```

---

## Tests included

| # | Test | What it checks |
|---|---|---|
| 1 | Starts closed | The hamburger reads "Open menu", `aria-expanded` is false and the menu isn't open |
| 2 | Opens | Clicking the hamburger opens the menu and it switches to "Close menu" |
| 3 | Closes | Clicking it again closes the menu |
| 4 | Page links | Services, About, Testimonials, Service Areas and Contact are in the open menu |
| 5 | Link closes the menu | Clicking a page link goes to that page and closes the menu |
| 6 | Account buttons, closed | "Sign In" isn't in the menu until it is opened |
| 7 | Signed in | The open menu shows Dashboard and Sign Out and no Sign In |
| 8 | Loading | The open menu has no account buttons while the session is still loading |
| 9 | Sign In button | Clicking Sign In in the menu goes to `/signin` and closes the menu |
| 10 | Viewport tag | `index.html` has `width=device-width, initial-scale=1.0` |
| 11 | Hamburger hidden on desktop | The hamburger is `display: none` by default |
| 12 | Hamburger on phones | The hamburger is `display: flex` at 768px and below |
| 13 | Links hidden on phones | The page links are hidden at 768px and below, and shown when the menu is open |
| 14 | Desktop buttons hidden | The desktop Sign In and Dashboard buttons are hidden at 768px and below |
| 15 | Links stacked | The page links stack in a column at 768px and below |
| 16 | Narrow phones | There is a layout for 480px and below |

---

## How the mock works

`useAuth` is replaced with a plain object (`mockAuth`), so each test can sign the user in with `mockAuth.user = { id: '...' }` or set `mockAuth.loading = true`.

The Supabase client is faked, since the menu only asks for the account role when Dashboard is clicked, and these tests don't click it.

The CSS tests read `src/index.css` and `index.html` as text. `mediaBlocks()` pulls out each `@media` block and `ruleBody()` finds one rule inside it.

The header's Sign In, Dashboard and Sign Out buttons are covered in more detail by the SCRUM-233 tests in `Testing/headerTest/`. These tests only check how they behave in the phone menu.

---

## Selenium tests

`Testing/selenium/test_mobile_view.py` has 17 functional tests that drive the real site in Chrome set up as a phone (375 x 812). They are not part of `npm run test:run` and don't run in CI, so run them yourself before your PR.

Chrome's phone emulation is used instead of resizing the window, because a desktop Chrome window can't get as narrow as a phone.

### How to run

```bash
pip3 install -r Testing/selenium/requirements.txt   # once
npm run dev                                          # terminal 1
python3 -m pytest Testing/selenium/test_mobile_view.py -v   # terminal 2
```

No account is needed. To run without opening a browser window, set `HEADLESS=1`.

### Tests included

| # | Test | What it checks | Saves data? |
|---|---|---|---|
| 1 | Phone width | The page is 375px wide | No |
| 2 | Header | The hamburger shows, and the desktop links and buttons are hidden | No |
| 3 | Menu | The hamburger opens and closes the menu and its label and `aria-expanded` change | No |
| 4 | Menu link | Clicking Services goes to `/services` and closes the menu | No |
| 5 | Sign In | The menu has a Sign In button that goes to `/signin` | No |
| 6 | Sideways scroll | None of 9 public pages is wider than the screen (one test each: `/`, `/services`, `/about`, `/testimonials`, `/service-area`, `/contact`, `/signin`, `/signup`, `/reset-password`) | No |
| 7 | Footer | The footer is visible and fits the screen | No |
| 8 | Contact form | Every field fits inside the screen | No |
| 9 | Breakpoint | The hamburger shows at 768px and is gone at 1024px | No |

### Why only public pages

These tests don't sign in, so they never touch an account or the real database. The customer portal, settings page and admin dashboard need an account and are not checked here.
