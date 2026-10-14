# Complete missing profile details in a sheet on "My documents"

Date: 2026-10-13
Ticket: VOLI-1547
Status: Approved design, pending implementation plan

## Problem

A contract or invoice template can bind volunteer profile data (address, IBAN, date of birth, …). When the volunteer's profile lacks a value the document needs, the document reports it in `missingProfileFields`, and the volunteer cannot sign: the backend rejects the signature (`contract.service.ts` / `invoice.service.ts`, "Your profile is missing details required for this document"), and the preview disables Sign.

Today the document card (`volunteer-document-card.tsx`) and the preview (`volunteer-document-preview.tsx`) show a warning with a link to `/profile`. That flow has two problems:

1. **The volunteer doesn't know what to fill.** `/profile` is a read-only overview leading to a full edit form with every profile field. Nothing tells the volunteer which of them the document needs.
2. **The volunteer leaves the document.** They navigate away from "My documents", edit the profile, and have to find their way back to sign.

## Goal

Let the volunteer fill exactly the missing details for one document in a sheet opened over "My documents", then return to the list, where the document becomes signable without leaving the page.

## Idea

Open a Next.js parallel-route sheet on `/profile/documents`, the same pattern the backoffice uses for `@sheet/shifts/new`. The sheet loads the document, translates its `missingProfileFields` into profile system keys, and renders a dynamic form with only those fields, reusing the requirement-form field renderer and validation. Saving writes to the volunteer's profile, refreshes the document queries and closes the sheet.

## Decisions

| Question | Decision |
|---|---|
| Which fields does the sheet show | Only the missing fields of the one document whose card was clicked |
| How the sheet learns the fields | URL carries the document kind and id; the sheet loads the document and reads its `missingProfileFields` |
| Document query | Reuse `useContract(id)` / `useInvoice(id)` (includes `resolvedBody`; accepted overhead, often already cached) |
| URL shape | `/profile/documents/complete-profile?kind=contract\|invoice&id=<id>` |
| Source → profile key mapping | Explicit 9-entry map in `@repo/data`, next to `DataSourceKey`; not a prefix strip |
| Slot location | `profile/documents/layout.tsx` with an `@sheet` slot |
| Direct load / reload | A main-slot fallback page renders the documents list, so the sheet opens over it instead of a 404 |
| Sign while details missing | Sign disabled on the card; "Complete details" becomes the primary action |
| Save | New `useUpdateMyProfile` TanStack mutation hook in `@repo/data` |
| After save | Toast, invalidate document and user queries, `router.replace('/profile/documents')` |
| Requiredness | Every rendered field is required |
| Validation | `buildFieldSchema`, the same rules as the profile edit form and the backend |
| Account-holder prefill | Prefill with "Firstname Lastname" when the names are known |
| Old `/profile` link | Removed from the card. The preview's link points to the sheet URL instead |
| Missing org data (`missingOrgProfileFields`) | Out of scope; the volunteer cannot fix it |
| Sheets on preview / membership pages | Out of scope; those pages link to the My-documents sheet |

## Background facts

- **The profile is global.** The fields are columns on the `users` table, and `updateMyProfile(input: UpdateMyProfileInput!)` takes no org. Filling a field once fixes it for every document in every org.
- **`missingProfileFields` holds template source keys.** The backend translates them with `PROFILE_SOURCE_TO_PROFILE_KEY` (`apps/backend/src/accounting/services/document-template.types.ts`). The possible values are:

  | Source key | Profile system key | `UpdateMyProfileInput` field |
  |---|---|---|
  | `volunteer_first_name` | `firstname` | `firstname` |
  | `volunteer_last_name` | `lastname` | `lastname` |
  | `volunteer_street` | `street` | `street` |
  | `volunteer_zip` | `zip` | `zip` |
  | `volunteer_city` | `city` | `city` |
  | `volunteer_dob` | `birthdate` | `birthdate` |
  | `volunteer_iban` | `iban` | `iban` |
  | `volunteer_account_holder` | `account-holder` | `accountHolder` |
  | `volunteer_bic` | `bic` | `bic` |

  `preferred-name`, `gender` and `phone` (the rest of `WRITABLE_PROFILE_SYSTEM_KEYS`) never appear.
- **"My documents" loads on the client** through `useMyDocuments()` (query key `['accounting', 'my-documents']`). `router.refresh()` alone does not update it, so the cache has to be invalidated.
- **`contract(id)` / `invoice(id)` work without an org.** The owner check in `assertCanViewDocument` passes without the `x-organization-unit-id` header, so the org-less `DataProvider` in `(volunteering)/layout.tsx` is enough.
- **The admin `@sheet` slot** has a `default.tsx` returning `null`, plain `page.tsx` files and no intercepting routes. `FormSheet` / `useFormSheet` (`apps/frontend/src/components/form-sheet.tsx`) handle opening, the close animation and `router.back()`.

## Solution

### Shared mapping (`packages/data`)

Add a module next to `template-body.types.ts`, exported from `@repo/data`:

```ts
export const PROFILE_SOURCE_TO_PROFILE_KEY = {
  volunteer_first_name: 'firstname',
  volunteer_last_name: 'lastname',
  volunteer_street: 'street',
  volunteer_zip: 'zip',
  volunteer_city: 'city',
  volunteer_dob: 'birthdate',
  volunteer_iban: 'iban',
  volunteer_account_holder: 'account-holder',
  volunteer_bic: 'bic',
} as const satisfies Partial<Record<DataSourceKey, string>>;

export type ProfileSourceKey = keyof typeof PROFILE_SOURCE_TO_PROFILE_KEY;
export type MissingProfileKey = (typeof PROFILE_SOURCE_TO_PROFILE_KEY)[ProfileSourceKey];

export function isProfileSourceKey(value: string): value is ProfileSourceKey;
export function toMissingProfileKeys(sources: readonly string[]): MissingProfileKey[];
```

`toMissingProfileKeys` drops unknown values, so a backend key the frontend doesn't know yet can't crash the sheet, and it removes duplicates. `apps/frontend/src/domain/accounting/lib/creation-fields.ts` replaces its local partial map with this one, keeping its separate first/last-name handling.

### Mutation hook (`packages/data`)

Add `useUpdateMyProfile()` in `packages/data/src/react/hooks/use-update-my-profile.ts`, following `use-update-my-account-settings.ts`. It calls `UserRepository.updateMyProfile`, and on success invalidates:

- `['user', 'me']`
- `['accounting', 'my-documents']`, `['accounting', 'my-document-summary']`
- `['accounting', 'my-contracts']`, `['accounting', 'my-invoices']`
- `['accounting', 'contract']`, `['accounting', 'invoice']` (prefix, so the single-document caches drop)

Unlike the `updateUserProfile` server action, the hook does not call `revalidatePath('/profile')`. During implementation, check that `/profile` and `/profile/edit` render dynamically and don't serve stale data. If they don't, call that server action's revalidation too.

### Routes (`apps/frontend/src/app/[locale]/(volunteering)/profile/documents/`)

```
documents/
├── layout.tsx                    # renders {children} and {sheet}
├── page.tsx                      # existing list page (unchanged)
├── complete-profile/
│   └── page.tsx                  # main-slot fallback: renders the same list as page.tsx
└── @sheet/
    ├── default.tsx               # returns null
    └── complete-profile/
        └── page.tsx              # reads ?kind&id, renders <CompleteProfileSheet>
```

- Extract the body of `documents/page.tsx` into a shared server component so the fallback page renders the same list. On a hard load or reload of the sheet URL, the list renders behind the open sheet.
- The sheet page validates `kind` (`contract | invoice`) and requires `id`. Bad values don't call `notFound()`; they render the sheet's error state.

### Sheet component (`apps/frontend/src/domain/accounting/components/complete-profile-sheet.tsx`)

A client component built on `FormSheet` / `useFormSheet`.

1. **Load:** `useContract(id)` or `useInvoice(id)` depending on `kind`. While loading, show a skeleton inside the sheet.
2. **Derive fields:** `toMissingProfileKeys(document.missingProfileFields)`, then look up each key's definition (`key`, `labelKey`, `type`) in `SYSTEM_PROFILE_FIELDS`, keeping that list's order so the address fields stay grouped.
3. **Schema:** a zod object with one entry per field from `buildFieldSchema(field, messages)`, every field required, and `useValidationMessages()` for the copy. The rules (IBAN checksum, BIC, zip, letters-only names, birthdate) match the profile edit form and the backend's `validateSystemKeyValue`.
4. **Form:** react-hook-form with `zodResolver`, `mode: 'onChange'`; each field is a `Controller` rendering `FieldRenderer`, as in `EditIdentityForm`.
5. **Prefill:** if `account-holder` is rendered and the volunteer's first and last name are known (from the current user), its default value is `"<firstname> <lastname>"`. Everything else starts empty, since only missing fields are shown.
6. **Submit:** map the form values to `UpdateMyProfileInput`, sending only the rendered fields (reuse `profileDataToUpdateInput` from `domain/user/lib/profile-data-map.ts` if its shape fits). Call `useUpdateMyProfile().mutateAsync`, then on success show the toast "Details saved", close the sheet and `router.replace('/profile/documents')`. On error, show the server message in a toast and keep the sheet open with the values intact.

**States:**

| State | Content |
|---|---|
| Loading | Skeleton inside the sheet |
| Fields missing | Dynamic form, Cancel + Save |
| Nothing missing (stale link, saved in another tab) | "All details are complete" message + Close |
| Bad `kind`/`id`, not found, forbidden | Generic error message + Close |

**Copy** (title and description):
- Title: "Complete your details"
- Description: names the document and the org (e.g. "Required for *Volunteer agreement* at *Org name*") and says the details are saved to the volunteer's profile and used for all their documents.

### Document card (`volunteer-document-card.tsx`)

When the document is `awaiting-signature` and `missingProfileFields` is not empty:

1. Warning text (`missingProfileWarning`)
2. Primary button "Complete details", a `Link` to `/profile/documents/complete-profile?kind=<kind>&id=<id>`
3. Sign button, **disabled**
4. Decline button

Without missing fields the card is unchanged. Also remove the debug `console.log` in the card and in `volunteer-my-documents.tsx`.

The card is also used by `VolunteerDocumentsSection` on the membership detail page, where the same link appears. It leaves that page for My documents, which is accepted for now.

### Document preview (`volunteer-document-preview.tsx`)

Keep Sign disabled. The missing-details link points to the sheet URL instead of `/profile`.

### Translations

Add to `de` and `en`:

- `MyDocuments.completeProfile.title`, `.description` (document name and org interpolated), `.savedToProfile`, `.submit`, `.success`, `.allComplete`, `.error`, `.close`
- `MembershipDetail.documents.completeDetailsCta` (the card button), replacing the use of `missingProfileCta` (drop that key if nothing else uses it)

Field labels reuse `RequirementForm.fieldForm.*`, and validation messages reuse `RequirementForm.validation.*`.

## Out of scope

- Missing organisation data (`missingOrgProfileFields`: org address, legal representative). The volunteer can't fix it, and it stays as it is today.
- Sheets opened on the document preview or the membership detail page. Both link to the My-documents sheet.
- Continuing straight into signing after saving. The volunteer signs from the refreshed card.
- Slim per-document queries without `resolvedBody`. Revisit only if the payload turns out to matter.

## Testing

- **Unit (`packages/data`):** `toMissingProfileKeys`: maps all 9 sources, drops unknown values, removes duplicates.
- **Unit (frontend):** the field/schema builder for the sheet. Given a set of missing keys it renders exactly those fields in `SYSTEM_PROFILE_FIELDS` order, all required, rejects an invalid IBAN and zip, and prefills the account holder from the names.
- **E2E:** extend `e2e/tests/features/accounting/documents-flow.e2e.ts`. A volunteer with a missing address opens a contract card, sees Sign disabled, clicks "Complete details", fills in the sheet, saves, lands back on My documents, and Sign is enabled.
