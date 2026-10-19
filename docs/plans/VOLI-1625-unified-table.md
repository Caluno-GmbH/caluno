# VOLI-1625 — Unified Table Component

A single table component that every list renders through. It owns the look (from Pencil,
non-negotiable) and everything shareable — sorting, pagination, filtering, empty/loading
states, the footer — while each feature only supplies its columns, its data hook, and its
cell content.

**Scope of this ticket: three tables only — Timesheets, Shifts (a.k.a. Assignments), and
Users (the Volunteers "Approved" table).** Everything else is explicitly out of scope for
now: Reimbursements, all Requirement-form tables (Forms, Form Blocks, Submissions,
Submission view), and Roles. The primitive is still built to serve the whole product, but
we only migrate and verify these three.

---

## 0. CRITICAL RULES (non-negotiable)

1. **UI requirements from Pencil (`bGlPt`) are absolute.** Section 2 is the contract; code
   adapts to the design, never the reverse.
2. **All three tables are paginated** with a user-selectable rows-per-page: **default 25**,
   options **25 / 50 / 100**. No unpaginated/static tables in scope (section 5).
3. **Accounting (and every out-of-scope module) is read-only from the outside.** Consume
   exported services/hooks; never edit their internals.
4. **No PII** in logs, errors, analytics, fixtures, or commit messages.
5. **No `Co-Authored-By` trailer** on any commit — ever.
6. **No commits until the user explicitly asks for them.** Not after a green build, not
   after a passing review — only on an explicit request.

---

## 1. Goal & guiding principles

- **One component, many data shapes.** Features never hand-build `<table>`/`<tr>`
  markup again. They declare *columns* and hand over *rows*; the unified component
  draws everything.
- **The UI is fixed, the data is pluggable.** The Pencil design (`unified tables.pen`,
  node `bGlPt`) is the absolute visual contract. Code adapts to it, never the reverse.
- **Engine = Timesheets.** We do not invent a new engine. Timesheets already runs on
  TanStack `useTable` + a shared `DataTable` wrapper + nuqs URL params + server-side
  fetch. That is the template; we grow it to cover every table and every cell type the
  design needs, then move the other tables onto it.
- **Thin features, fat primitive.** Anything shared (sort affordance, pagination,
  truncation+tooltip, right-aligned numbers, the avatar/title/subtitle cell) lives once
  in the primitive. Features stay small and declarative.
- **Security and clean code are acceptance criteria, not afterthoughts** (section 7).

---

## 2. The UI contract (non-negotiable — from Pencil `bGlPt`)

These numbers come straight from the design file and are **absolute**. The primitive is
built to them; no feature may override them.

### Column header (the `th`)
- Height **32px**, padding **0 vertical / 8px horizontal**.
- Background **`--muted`**; label **14px**, color **`--muted-foreground`**.
- **Border-right 1px `--border`** on every column **except the last**.
- **Min width 120px.** Label **truncates** with ellipsis when the column is narrower.
- When the label is truncated, a **tooltip reveals the full column name**.
- Sortable columns show the **sort control as a right-aligned island** inside the header
  (the existing `DataTableColumnHeader` button covers this behaviour).

### Data row
- A row is a vertical stack: the **cells strip** (vertically centered) followed by a
  **1px divider in `--border`**.
- **Cell padding: 8px vertical / 12px horizontal.**
- **Vertical column separators run through the body too:** every data cell has
  **border-right 1px `--border` except the last column** — same rule as the header, so the
  column grid is continuous from header through the rows.
- Column widths are per-column; the **actions cell fills remaining width and
  right-aligns** its buttons.

### Cell anatomy — the four cell types (this is the heart of the unification)
Every column renders through exactly one of these. Nothing else is allowed.

1. **Full cell** — `[avatar OR icon, 32×32]` + a content block
   `{ title 18px (--foreground), subtitle 16px (--muted-foreground) }`
   + an **optional trailing status/alert icon 16×16**. Horizontal gap 8, centered.
2. **Average cell** — exactly **one data element** (a single value, 18px).
3. **Status cell** — a **Badge only**. It may coexist with **nothing except a trailing
   icon**. (Reuse the Badge primitive from VOLI-1635; its padding `[2,8]` / radius 8
   already matches the spec.)
4. **Number cell** — numeric value, **always right-aligned**.

### Footer (pagination)
- Left: “Showing 1–25 of N …” — 16px, `--muted-foreground`.
- Right: a **rows-per-page selector** (default **25**, options **25 / 50 / 100**),
  “Page 1 of M” (16px), and **Previous / Next** buttons (18px label, chevron icons).
- The existing `pagination.tsx` already matches the count/page/prev-next; the rows-per-page
  selector is the one footer addition this ticket introduces (keep it visually consistent
  with the Pencil footer styling).

> These map cleanly onto the design-system tokens and the scale-up rule (title 18px is
> the dominant size; header label is `--text-xs` = 14px). The cell types are a small,
> closed set — that is what makes one primitive able to serve all nine tables.

---

## 3. Where we are today

**The engine already half-exists.** Timesheets runs on a small shared layer under
`apps/frontend/src/components/data-table/`:

- `data-table.tsx` — `<DataTable>` wrapper over TanStack `useTable` (`manualSorting`,
  `manualPagination`, `enableSortingRemoval:false`) rendering `@repo/ui` `<Table>`.
- `data-table-column-header.tsx` — sortable header button with asc/desc/unsorted icons.
- `features.ts`, `table-sort.ts`, `table-params.ts` — feature set, sort helpers, and the
  nuqs `createTableParsers(sortFields, defaultSort, defaultDir)` factory (`sort`/`dir`/`page`).
- Page-level: `timesheets/page.tsx` fetches server-side via `getDataClient` with
  `limit/offset/sort/order`; `pagination.tsx` renders the footer.

**Nine tables exist; only Timesheets uses the engine fully. Three are in scope.**

| # | Table | File (domain/*) | Engine today | Sort | Page | Search | Actions | In scope |
|---|-------|-----------------|--------------|------|------|--------|---------|----------|
| 1 | Timesheets | `time-entry/components/timesheets-table.tsx` | TanStack + wrapper | ✓ | ✓ | – | ✓ | **Yes** |
| 2 | Shifts / Assignments | `shift/components/shifts-table.tsx` | shadcn Table | – | ✓ | – | ✓ | **Yes** |
| 3 | Users / Volunteers (Approved) | `app/.../volunteers/manage-volunteers-client.tsx` | shadcn Table | – | – | ✓ | ✓ | **Yes** |
| 4 | Roles | `role/components/roles-table.tsx` | shadcn Table | – | – | – | ✓ | No |
| 5 | Forms | `requirement-form/components/forms-table.tsx` | shadcn Table | – | – | – | ✓ | No |
| 6 | Form Blocks | `requirement-form/components/blocks-table.tsx` | shadcn Table | – | – | – | ✓ | No |
| 7 | Form Submissions | `requirement-form/components/form-submissions-client.tsx` | shadcn Table | – | – | ✓ | ✓ | No |
| 8 | Submission view | `requirement-form/components/submission-view.tsx` | shadcn Table | – | – | – | – | No |
| 9 | Reimbursements board | `accounting/components/reimbursements-volunteer-group.tsx` | shadcn Table (hierarchical) | ✓ | – | ✓ | ✓ | No |

**Reality check for the three in scope:** all use the `@repo/ui` `<Table>` primitives
already, so the markup migration is mechanical. The real work is (a) the cell-type system
+ header/footer styling from Pencil, (b) a reusable **filter/search** param layer the
engine lacks, and (c) one backend change — `sort`/`order`/`search` args on the `shifts`
resolver (Timesheets already has sort; Users filters in-browser, see section 5). None of
the three is hierarchical, so the flat row model fits all of them cleanly.

---

## 4. Target architecture

Keep Timesheets’ shape; make it the product-wide default by adding the missing pieces.

### 4.1 Cell-type primitives (new — the visual contract in code)
A tiny set of presentational components in `components/data-table/cells/`, built exactly
to section 2. Columns compose these instead of raw JSX, so the look can never drift:

- `TextCell` (average cell) — single value, 18px.
- `EntityCell` (full cell) — `avatar | icon` 32×32 + title/subtitle + optional trailing
  16×16 status icon. Handles the truncation of long titles.
- `StatusCell` — wraps `Badge`; accepts only a badge + optional trailing icon (enforced
  by the component’s props, so misuse is a type error, not a review comment).
- `NumberCell` — right-aligned; tabular numerals.
- `ActionsCell` — right-aligned icon-button group (edit/delete/etc.).

The header truncation+tooltip and the border-right/last-column rule live in the
`DataTable` header render + `TableHead`, not in each column.

### 4.2 Engine (extend `DataTable`, don’t replace)
- Keep TanStack `useTable` and `enableSortingRemoval:false`.
- Fold the Pencil styling into the wrapper: muted 32px header, 8/12 cell padding, divider
  rows, min-width/truncation, right-alignment via `meta`.
- **Rows-per-page is part of the engine.** Add a `pageSize` URL param alongside
  `sort/dir/page`: default **25**, constrained to **25 / 50 / 100**. Changing it resets
  `page` to 1. All three tables use it — there is no unpaginated mode in scope.

**Two data modes, one UI (the hybrid decision).** The component renders identically either
way; only the data plumbing differs. This is a single explicit prop (e.g. `mode:
'server' | 'client'`), not scattered branching:

- **Server mode** (Timesheets, Shifts): `manualPagination` + `manualSorting`. The
  server-component page fetches the current page via `@repo/data` using
  `limit/offset/sort/order` (+ `search`), and passes `data`, `pageCount`, `sorting` in.
  The URL params *are* the query inputs.
- **Client mode** (Users): the component receives the **full** list and turns on TanStack’s
  own `getPaginationRowModel` / `getSortedRowModel` / `getFilteredRowModel`. The same
  `page/pageSize/sort/search` URL params drive TanStack state instead of a server fetch, so
  the URL stays shareable and refresh-safe — but filtering/sorting/paging happen in-browser
  over the whole loaded set, which is why search stays correct without a backend change.

Keep the mode boundary razor-thin: the cells, header, footer, page-size selector, and
search box are mode-agnostic; only how `data`/`pageCount` are produced differs.

> `createTableParsers` grows a fourth parser: `pageSize`
> (`parseAsStringLiteral(['25','50','100'])` or a validated integer, default `25`). Server
> fetch reads it as `limit`; the rows-per-page selector writes it and resets `page`.

### 4.3 Filtering / search layer (new, mirrors `createTableParsers`)
Add a sibling param factory (e.g. `createFilterParsers`) so search/filter state lives in
the URL exactly like sort/page does (nuqs, `shallow:false`, server-readable via the params
cache). A single shared, debounced search box replaces today’s ad-hoc `useState`. **Where
the param is applied depends on the table’s mode** (section 4.2): in server mode (Shifts)
the resolver consumes `search` just as `findAll` consumes `sort/order`; in client mode
(Users) the same param drives TanStack’s `getFilteredRowModel` over the full loaded set.
Either way the search box, its URL param, and its behaviour are identical to the user.

### 4.4 Column contract
A feature supplies a typed `ColumnDef[]` where each column declares:
- `header` via `DataTableColumnHeader` (title + optional sort field),
- `meta` for width / alignment / `cellClassName`,
- `cell` returning **one** of the section-4.1 cell primitives.

That is the entire surface a feature touches. Everything else is the engine.

---

## 5. Data & server contract (hybrid, per table)

What each in-scope table does — chosen to keep the unbounded tables scalable while sparing
the bounded one any backend work:

| Table | Mode | Pagination | Sort | Search | Backend work this ticket |
|-------|------|-----------|------|--------|--------------------------|
| **Timesheets** | server | ✅ already | ✅ already | — (none today; out of scope) | none |
| **Shifts** | server | ✅ already | **add** | **add** | add `sort`/`order`/`search` to `shifts` resolver + `GetShifts` + codegen |
| **Users** | client | in-browser | in-browser | in-browser | none |

- **Server mode** (Timesheets, Shifts): the server component fetches through
  `getDataClient`/`@repo/data` with `limit/offset/sort/order` (+ `search` for Shifts) and
  passes `data`, `pageCount`, `sorting` in. Sort fields come from the generated GraphQL
  enums fed into `createTableParsers` — no stringly-typed sort keys in the UI.
- **Shifts is the only backend change.** `GetShifts`/the `shifts` resolver gains `sort`,
  `order`, and `search` arguments (mirroring how `timeEntries` already does sort/order),
  then `bun run codegen` regenerates types. The `shift` domain is ours to edit; this does
  **not** touch any read-only cross-domain module.
- **Users runs client-side.** `useMemberships` already returns the org’s full membership
  list; we keep that single fetch and let TanStack paginate/sort/filter it in the browser.
  No `limit/offset`, no resolver change. This is correct **because the set is bounded**
  (one org’s approved volunteers) — see the risk in section 10.
- **Pagination stays offset-based** (server mode) / index-based (client mode); no cursors.
- **`limit`/`pageSize` is always the 25/50/100 allow-list.** In server mode the server must
  clamp it — never trust an arbitrary `limit` from the query string.

---

## 6. Migration order (lowest risk → highest)

Only the three in-scope tables. Each step is “move this table onto the unified component +
cells, delete its bespoke markup, verify against Pencil.”

1. **Primitive + engine first** — build the cell primitives, fold in the Pencil styling,
   add the filter param layer, update Storybook. Nothing else proceeds until this is the
   single source of truth and Timesheets still renders identically on top of it.
2. **Timesheets** (server mode) — re-point to the new cells (smallest diff; proves parity /
   canary). No data change.
3. **Shifts / Assignments** (server mode) — migrate columns to cells **and** the backend
   step: add `sort`/`order`/`search` to the `shifts` resolver + `GetShifts`, run codegen,
   then wire sort/search in the UI. The only step with backend work — do the backend arg +
   codegen first, verify the query, then the frontend.
4. **Users / Volunteers (Approved)** (client mode) — migrate to the unified component in
   client mode: keep the single `useMemberships` fetch, enable TanStack client
   pagination/sort/filter, and move search off local `useState` onto the shared URL-param
   layer. No backend change. Only the "Approved" table migrates; the Pending/Rejected tabs
   render cards, not tables, and are untouched.

Out of scope this ticket: Roles, all Requirement-form tables, and Reimbursements. The
accounting module stays **read-only from the outside** regardless — we don't touch it.

---

## 7. Security & clean-code guardrails (acceptance criteria)

- **No PII in logs, errors, analytics, test fixtures, or commit messages.** Cells render
  data; they never `console.log` rows. Tooltips/aria-labels use names already on screen,
  nothing more.
- **Server-side authorization is unchanged.** The table is pure presentation; it must not
  become a place that fetches data bypassing existing permission checks. All reads keep
  going through `@repo/data` resolvers that already enforce org/permission scoping.
- **URL params are validated.** nuqs parsers (`parseAsStringEnum`, `parseAsStringLiteral`,
  `parseAsInteger`) constrain `sort`/`dir`/`page`/`pageSize`/filters to known values — an
  attacker editing the query string can’t inject arbitrary sort columns, an out-of-range
  `pageSize`, or unbounded page offsets. Clamp `page` to `[1, pageCount]` and `pageSize` to
  the **25/50/100 allow-list server-side** — the client parser is convenience, the server
  is the gate.
- **No dangerous rendering.** Cell content is React children only; never
  `dangerouslySetInnerHTML`. Links are internal `@/i18n/navigation` links.
- **Clean code:** one component, closed set of cell types, typed column contract. Comments
  only where non-obvious (per repo convention — don’t narrate code). Delete every bespoke
  table body we replace; no dead “old table” left behind.
- **Accessibility is part of the contract:** `aria-sort` on headers (already present),
  real `<th>`/`<td>` semantics, focusable sort buttons, tooltip reachable by keyboard.

---

## 8. How we build it — cheap worker agents, you as control

The engine/primitive step is high-leverage and must be done carefully (one agent, tight
review). The per-table migrations are repetitive and mechanical — ideal for cheap worker
agents running one table each, with you reviewing every diff.

- **Step 1 (engine + cells + filters + Storybook):** a single capable agent, reviewed
  closely. This is the contract; everything else copies it.
- **Steps 2–4 (the three table migrations):** one **cheap worker agent per table**, each
  given the Pencil cell-type spec (section 2), the finished primitive’s API, the data mode
  (server/client) for that table, the one-to-few files to touch, and a “delete the old
  markup” instruction. They live in different domains (`time-entry`, `shift`, `volunteers`)
  with no shared files, so **Timesheets and Users can run in parallel** once step 1 lands.
- **Shifts needs a backend sub-step first.** Its agent (or a dedicated one) adds
  `sort`/`order`/`search` to the `shifts` resolver + `GetShifts` and runs `bun run codegen`
  **before** the frontend migration — a slightly more careful agent than the pure-frontend
  two, reviewed on the backend diff and the regenerated types specifically.
- **Your role is control:** every agent returns a diff; you (with me) verify it against
  the design and the guardrails before it’s accepted. No commits until you say so, and no
  `Co-Authored-By` trailer on commits.

**Per-agent checklist (same for every migration agent):**
1. Replace bespoke markup with `DataTable` + the four cell primitives.
2. Match Pencil exactly (header 32px/muted, 8/12 padding, divider, min-width+tooltip,
   right-aligned numbers, badge-only status cells).
3. Keep data fetching server-driven via the existing `@repo/data` hook.
4. Delete the old table code; no leftovers.
5. `bun run check-types` + `bun run lint` clean; Storybook/story updated if the cell set grew.
6. Report the diff; change nothing outside the one table’s files.

---

## 9. Verification

- **Visual parity:** screenshot each migrated table at `bun run dev` and compare to
  `bGlPt`. The header, divider, cell types, and footer must match.
- **Type/lint gates:** `bun run check-types` and `bun run lint` green after every step.
- **Behavioural checks:** sorting flips via URL, pagination bounds hold, the rows-per-page
  selector (25/50/100) changes the page size and resets to page 1, truncated headers show
  tooltips, search updates the URL and survives refresh.
- **Regression safety:** Timesheets (step 2) is the canary — if it renders identically on
  the new primitive, the contract is sound before we touch Shifts and Users.

---

## 10. Risks & mitigations

- **Two data modes in one “unified” component.** → Contain the server/client split behind a
  single `mode` prop; cells, header, footer, page-size selector, and search box stay
  mode-agnostic. If branching starts leaking into the presentational layer, stop and
  refactor — the whole point is one UI.
- **Users client mode assumes a bounded set.** → Loading every membership is fine for one
  org’s approved volunteers today, but a very large org would load slowly. Document the
  assumption; if an org ever outgrows it, that table graduates to server mode (which is why
  the backend arg pattern from Shifts is worth copying consistently).
- **Shifts backend change.** → Adding `sort`/`order`/`search` to the `shifts` resolver
  must preserve existing org/permission scoping and pagination semantics; `search` is a
  filter *before* the count, not after. Review the resolver and regenerated types; don’t
  touch unrelated resolvers.
- **Scope creep back into the 6 out-of-scope tables.** → The primitive is built to serve
  them eventually, but this ticket migrates and verifies only Timesheets, Shifts, and
  Users. Don’t touch the rest.
- **Users search rework.** → Moving off local `useState` to the URL-param layer changes the
  state model. Verify search filters across the whole set, survives refresh, and resets to
  page 1.
- **Search layer scope creep.** → Keep it to URL-param + debounced input mirroring
  `createTableParsers`; the mode decides where filtering executes (server for Shifts,
  in-browser for Users) — no client-side massaging of server-paginated data.
- **Agent drift from the design.** → The cell primitives *are* the design; agents compose
  them and cannot restyle. Anything that needs restyling is a step-1 change, reviewed once.
```
