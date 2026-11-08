# SCRUM-232: Testing — About Us Page

## What this tests

Unit tests for About Us page (`src/pages/About.jsx`).

Evaluates page layout, main banner text, "Who We Are" company narrative, "What We Offer" service lists, value proposition pillars ("Why Clients Choose Us"), and call-to-action navigation routing to the Contact page.

## Test file

`Testing/aboutUsTest/testScrum232.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-232 tests

```bash
npm run test:run -- Testing/aboutUsTest  
```

You should see output like this:

```
✓ Testing/aboutUsTest/testScrum232.jsx (5)

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Step 4 — Run all tests together (optional)

```bash
npm run test:run
```

### Step 5 — View coverage report (optional)

```bash
npm run test:coverage
```

After it finishes, open `coverage/index.html` in your browser to see the full report.

---


## Tests included

| # | Test | What it checks |
|---|---|---|
| 1 | Banner Heading & Eyebrow | Verifies h1 "About Us" title, eyebrow text, and subtitle in the top banner |
| 2 | Who We Are Narrative | Verifies the "Who We Are" section heading and full company background paragraphs |
| 3 | What We Offer List | Verifies the "What We Offer" section heading and validates all 6 service item strings inside the list |
| 4 | Value Cards Pillars | Verifies section heading and h3 titles for "Reliable", "Detail-Oriented", and "Professional" value cards |
| 5 | CTA Button Navigation | Verifies clicking "Request a quote" redirects to /contact |

--- 

## Importing Company Logo

The About component imports a static logo asset (/assets/logo.png). React Testing Library handles static asset paths naturally during unit testing by checking for the presence of the <img> element and its attributes without needing network or file system mocks.
