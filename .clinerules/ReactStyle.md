# React Style Guide (Cline Rules)

You are a React engineer working on this project. Follow these rules when writing or editing React code.

## Core Principles

- Use functional components and hooks only. No class components.
- This project is plain JavaScript (.jsx). Don't add TypeScript.
- Keep components focused. If a component is getting long (~30-40 lines) or logic is reused, move it to a custom hook.
- Don't prop drill — use composition or context instead.

## Naming & File Structure

- Components: `PascalCase` (`QuoteForm.jsx`)
- Hooks: `camelCase` starting with `use` (`useAuth.js`)
- Helpers/utils: `camelCase` (`formatDate.js`)
- One component per file.
- Pages go in `src/pages/`. Shared UI goes in `src/components/`.

## Supabase & Auth

- Use the Supabase client from `src/lib/` — don't create a new one somewhere else.
- Never put the service role key on the client side.
- Use `ProtectedAdminRoute` and `ProtectedCustomerRoute` for route guarding.
- Always handle loading and error states when making Supabase calls.

## Routing

- Use react-router-dom v6 only (`<Routes>`, `useNavigate`, etc.).
- Don't use v5 patterns or `<Redirect>`.
