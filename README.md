<img width="800" height="400" alt="image" src="https://github.com/user-attachments/assets/17f851e5-9298-4ba5-b546-e7ec62fa824d" />

# Prasad's Cleaning LLC

A web platform for a local cleaning business — built as a Senior Project for CSC 190/191 at Sacramento State.

## Synopsis

Prasad's Cleaning LLC is a full-stack web app that gives a small cleaning business an online presence and a self-service portal. Visitors can browse services, service areas, and testimonials; customers can manage their appointments; and admins can manage operations from a dashboard.

## Tech Stack

- React
- Java Spring Boot
- Node.js

## Getting Started

First, download the necessary packages:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in the browser.

### Available Scripts

- `npm run dev` — start the local development server
- `npm run build` — create a production build
- `npm run preview` — preview the production build locally

### Code Layout

- `src/pages/` — route-level pages (Home, Services, Contact, Customer Portal, Admin Dashboard, etc.)
- `src/components/` — shared UI (Header, Footer)
- `src/data/` — static content and mock data
- `src/ServicesImages/` — imagery for service offerings
- `assets/` — brand assets (logo, etc.)

### Quote Address Check (SCRUM-239)

When a customer clicks **Get My Free Quote**, the address (street, apt/unit, city, state, ZIP) is checked before the quote is saved. The check runs in the `validate-address` Supabase Edge Function using [Geocodio](https://www.geocod.io). The function never touches the database, and the Geocodio key never reaches the browser.

- **Real address:** the quote is saved in the standardized format.
- **Spelled differently:** "Did you mean: …?" with **Use this address** (saves the suggestion) or **Edit my address**.
- **Not found, or only found roughly** (street, city or ZIP level): the quote is blocked with "We couldn't verify this address. Please check it and try again."
- **Check unavailable** (Geocodio down or slow, daily limit used up, key missing, function not deployed): the quote is saved anyway, so a customer is never blocked by an outage.

Setup (one time):

1. Create a free Geocodio account and API key. The free tier is 2,500 lookups a day with no credit card. Without a card, lookups over the limit fail and quotes are simply saved unchecked for the rest of the day.
2. Store the key as a Supabase secret. It is server-only, so never put it in `.env` or any `VITE_` variable:

   ```bash
   npx supabase secrets set GEOCODIO_API_KEY=your-key --project-ref xdflqihrhhtjqaowrfkq
   ```

3. Deploy the function (no database changes needed):

   ```bash
   npx supabase functions deploy validate-address --use-api --project-ref xdflqihrhhtjqaowrfkq
   ```

## Contributing

- *main* — stable branch
- Create a pull request to `main` whenever a feature is complete.

### Example Workflow in Git

We will use the creation of a `customer-login` feature as an example.

1. Create a new branch for the feature you are creating:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/customer-login
```

2. Commit your work and push the branch:

```bash
git add .
git commit -m "feat: add customer login form"
git push -u origin feat/customer-login
```

3. Open a pull request from `feat/customer-login` into `dev` on GitHub.

## Testing

_Placeholder — to be implemented in CSC 191._

## Deployment

_Placeholder — to be implemented in CSC 191._

## ERD
<img width="500" height="500" alt="image" src="https://github.com/user-attachments/assets/909d7319-01c7-4868-b9a9-8b2f59b5dc6d" />

## FrontEnd Demo
<img width="800" height="700" alt="image" src="https://github.com/user-attachments/assets/dae7f2f3-ebb3-41bf-9e07-4300b6fef9b3" />

## Timeline Key Milestones
- Database Implementation 08/24 - 11/1
- Admin Portal 10/18
- Calendy API Implementation 08/24 - 10/18
- Vercel Hosting Implementation 10/19 - 11/1

## Contributors

- Thinh Nguyen
- Avneet Singh
- Larry Vang
- Rahul Chand
- Sulvana Abushawish
- Tuong Lo
- Amaan Habib
- Simrit Bajwa