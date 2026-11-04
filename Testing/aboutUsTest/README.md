# SCRUM-232: Testing — About Us Page

## What this tests

Unit tests for About Us page (`src/pages/About.jsx`).

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
✓ Testing/aboutUsTest/testScrum232.jsx (4)

 Test Files  1 passed (1)
      Tests  4 passed (4)
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
| 1 | Company logo | Verifies the logo renders with the correct alt text (Prasad's Cleaning Services LLC logo) |
| 2 | Main heading & background | Checks that the "About Us" heading and company background details (owner Nigel Prasad, Northern California, Bay Area) are displayed |
| 3 | What We Offer section | Verifies the section heading and all 6 cleaning services (Commercial Cleaning, Residential Window Cleaning, Carpet Cleaning, Janitorial Services, Floor Cleaning, and Stripping and Wax Services) render |
| 4 | Why Clients Choose Us | Verifies the section heading and all three core value cards ("Reliable", "Detail-Oriented", "Professional") are rendered with their descriptive text |

--- 

## Importing Company Logo

The About component imports a static logo asset (/assets/logo.png). React Testing Library handles static asset paths naturally during unit testing by checking for the presence of the <img> element and its attributes without needing network or file system mocks.
