# Unit Testing Rule for New Code

Whenever you create or significantly change code, you **must** write or update tests too.

## Core Requirements

- Write tests for new functions, components, hooks, or modules.
- Test behavior, not implementation — don't test internal state or private functions.
- Tests should be straightforward and deterministic.
- Cover the happy path plus edge cases that actually matter.

## Stack

- Test runner: Vitest
- Components: React Testing Library (`@testing-library/react`)
- User events: `@testing-library/user-event`
- Assertions: `@testing-library/jest-dom`

## File Conventions

- Put test files next to the source file (`QuoteForm.test.jsx` beside `QuoteForm.jsx`).
- Don't mock Supabase unless you really have to.
