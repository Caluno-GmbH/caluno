# Data access library for use in frontend

A data wrapper around the GraphQL api. All queries and mutations in the frontend go via this package. The frontend does NOT use the GraphQL api directly.

## Commands

- `bun run check-types` - Check for any typescript compile errors
- `bun run codegen` - Generates Typescript interfacing code for *.graphql queries and mutations

## Project Structure

```
src/
├── repositories  # Domain based repositories to query and mutate data in RSC and Server Actions
├── react         # Tanstack Query hooks to query and mutate data in client components
├── ee            # EE-only repositories/hooks (stripped by the OSS mirror) — import as `@repo/data/ee`
├── generated     # codegen output (graphql.ts) — auto-generated, NEVER edit manually
└── errors        # DataError, ForbiddenDataError
```

OSS/EE placement rules: root `AGENTS.md` (OSS / Enterprise Edition). EE GraphQL + hooks live under `src/ee/` and are exported only via the `./ee` package export — consume them from `apps/frontend/src/ee/**`, never from core frontend code.

## Patterns

- Repositories 'wrap' the GraphQL queries and mutations (*.graphql)
- GraphQL queries and mutations (*.graphql) are co-located with the repositories that use them
- Locale is request metadata: pass `locale` to `createDataClient` / `DataProvider`; `@repo/data` maps it to the `x-locale` header. The Better Auth client also sends `x-locale` from the `caluno.locale` cookie (with a pathname fallback) on every auth request.
- `DataProvider` retries a failed query or mutation once, except a Next `NEXT_REDIRECT` or an UNAUTHENTICATED / FORBIDDEN `DataError` (`shouldRetryQuery`). `throwOnError` rethrows that error during render so a `redirect()` from `onError` navigates from `useQuery` and `useMutation`, not only suspense. Other errors stay in hook state. Hooks import `useMutation` from `react/hooks/use-mutation.ts`, never `@tanstack/react-query`: on a redirect its `mutateAsync` never settles and per-call `onError` / `onSettled` (passed to `mutate` / `mutateAsync`) are skipped, so callers do not toast `NEXT_REDIRECT` or a failure while the page navigates.
- Adding a query/mutation: see skill `.agents/skills/add-data-query` (EE queries go under `src/ee/<feature>/`, not `src/repositories/`)
