name: supabase-auth
description: Handle Supabase authentication, protected routes, and user session management for the Prasad Cleaning LLC app. Use when implementing sign in, sign up, password reset, auth callbacks, admin access, or customer portal access.

---

# Supabase Auth Skill

Use this skill whenever working on authentication or authorization features in this project.

## Core Principles

- Use the Supabase client from `src/lib/` — don't create a new one inline.
- Never store auth tokens manually — Supabase handles sessions automatically.
- Always check for both `user` and `session` when determining auth state.
- Handle loading states before rendering protected content to avoid flickers.

## Recommended Flow

1. **Sign Up / Sign In**
   - Use `supabase.auth.signUp()` or `supabase.auth.signInWithPassword()`.
   - On success, redirect with `useNavigate()` — never use `window.location`.
   - Show clear error messages from the Supabase error response.

2. **Auth Callback**
   - `AuthCallback.jsx` handles OAuth and email confirmation redirects.
   - Exchange the code for a session using `supabase.auth.exchangeCodeForSession()`.
   - Redirect to the right page after confirming the session.

3. **Protected Routes**
   - Wrap admin pages with `<ProtectedAdminRoute>`.
   - Wrap customer pages with `<ProtectedCustomerRoute>`.
   - Don't manually check roles inside page components — keep that in the route guards.

4. **Sign Out**
   - Call `supabase.auth.signOut()` then navigate to `/` or `/signin`.
   - Clear any local state tied to the user session.

5. **Password Reset**
   - Send the reset email with `supabase.auth.resetPasswordForEmail()`.
   - Handle the reset on `ResetPassword.jsx` using `supabase.auth.updateUser()`.

## Common Pitfalls

- Don't redirect before `supabase.auth.getSession()` resolves — always await it.
- Don't assume the user is logged in on page load — verify the session first.
- `user` can be null on first render — null check before using `user.id`.
- Email confirmation links expire — show a clear message if the link is invalid.
