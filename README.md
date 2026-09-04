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
