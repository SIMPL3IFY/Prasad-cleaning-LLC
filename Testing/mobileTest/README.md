# Testing — Mobile View

## What this tests

How the site behaves on a phone: the header's hamburger menu and the layout of the public pages on a small screen.

The unit tests cover the menu in `src/components/Header.jsx` with Supabase faked, and check the mobile rules in `src/index.css` and the admin dashboard's styles, and the viewport tag in `index.html`. jsdom doesn't apply stylesheets, so the unit tests can't see the real layout. The Selenium tests cover that in a real browser.

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
✓ Testing/mobileTest/testMobileView.jsx (18 tests)

Test Files  1 passed (1)
     Tests  18 passed (18)
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
| 17 | Admin dashboard, phones | The admin dashboard boxes go into one column at 640px and below |
| 18 | Admin dashboard, tablets | The admin dashboard boxes go into two columns at 1100px and below |

---

## How the mock works

`useAuth` is replaced with a plain object (`mockAuth`), so each test can sign the user in with `mockAuth.user = { id: '...' }` or set `mockAuth.loading = true`.

The Supabase client is faked, since the menu only asks for the account role when Dashboard is clicked, and these tests don't click it.

The CSS tests read `src/index.css` and `index.html` as text. `mediaBlocks()` pulls out each `@media` block and `ruleBody()` finds one rule inside it.

The header's Sign In, Dashboard and Sign Out buttons are covered in more detail by the SCRUM-233 tests in `Testing/headerTest/`. These tests only check how they behave in the phone menu.

---

## Selenium tests

`Testing/selenium/test_mobile_view.py` has 26 functional tests that drive the real site in Chrome set up as a phone (375 x 812). They are not part of `npm run test:run` and don't run in CI, so run them yourself before your PR.

Chrome's phone emulation is used instead of resizing the window, because a desktop Chrome window can't get as narrow as a phone.

### How to run

```bash
pip3 install -r Testing/selenium/requirements.txt   # once
npm run dev                                          # terminal 1
```

The 17 public page tests need no account. The 9 signed-in tests need real accounts and are skipped without them. In terminal 2:

```bash
export TEST_CUSTOMER_EMAIL='you@example.com'; export TEST_CUSTOMER_PASSWORD='...'
export TEST_ADMIN_EMAIL='admin@example.com'; export TEST_ADMIN_PASSWORD='...'
python3 -m pytest Testing/selenium/test_mobile_view.py -v
```

Set only the customer or only the admin variables to run just that half. To run without opening a browser window, set `HEADLESS=1`.

### Tests included

| # | Test | What it checks | Needs account? | Saves data? |
|---|---|---|---|---|
| 1 | Phone width | The page is 375px wide | No | No |
| 2 | Header | The hamburger shows, and the desktop links and buttons are hidden | No | No |
| 3 | Menu | The hamburger opens and closes the menu and its label and `aria-expanded` change | No | No |
| 4 | Menu link | Clicking Services goes to `/services` and closes the menu | No | No |
| 5 | Sign In | The menu has a Sign In button that goes to `/signin` | No | No |
| 6 | Sideways scroll | None of 9 public pages is wider than the screen (one test each: `/`, `/services`, `/about`, `/testimonials`, `/service-area`, `/contact`, `/signin`, `/signup`, `/reset-password`) | No | No |
| 7 | Footer | The footer is visible and fits the screen | No | No |
| 8 | Contact form | Every field fits inside the screen | No | No |
| 9 | Breakpoint | The hamburger shows at 768px and is gone at 1024px | No | No |
| 10 | Customer portal | `/portal` shows "Welcome back!" and isn't wider than the screen | Customer | No |
| 11 | Settings page | `/settings` isn't wider than the screen, and every field and the Save button fit | Customer | No |
| 12 | Signed-in menu | The menu has Dashboard and Sign Out and no Sign In | Customer | No |
| 13 | Menu Dashboard | Dashboard in the menu goes to `/portal` and closes the menu | Customer | No |
| 14 | Menu Sign Out | Sign Out in the menu signs out, and the menu then offers Sign In | Customer | No |
| 15 | Admin dashboard | `/admin` isn't wider than the screen | Admin | No |
| 16 | Admin boxes | The dashboard boxes are in one column | Admin | No |
| 17 | Admin top buttons | Home, Admin Settings and Sign Out all fit the screen | Admin | No |
| 18 | Admin Settings popup | The popup and its two password fields fit the screen, and Cancel closes it | Admin | No |

### Why nothing is saved

The tests use the real Supabase project, so they never submit anything. The settings page and the admin password popup are only opened and looked at. Signing in creates a session, and Sign Out ends it.
