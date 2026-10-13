# Complete-Profile Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a volunteer fill exactly the profile details a document is missing in a sheet over "My documents", so the document becomes signable without leaving the page (VOLI-1547).

**Architecture:** A Next.js parallel-route `@sheet` slot on `/profile/documents` opens `/profile/documents/complete-profile?kind=contract|invoice&id=<id>`. The sheet loads the document via `useContract`/`useInvoice`, translates `missingProfileFields` into profile system keys through a new shared map in `@repo/data`, and renders a react-hook-form + zod form reusing `FieldRenderer`/`buildFieldSchema`. Saving goes through a new `useUpdateMyProfile` TanStack mutation that invalidates the document queries.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, react-hook-form + zod, next-intl, bun:test, Playwright.

Spec: `docs/specs/2026-10-13-complete-profile-sheet-design.md`

## Global Constraints

- Use `bun`, never npm/yarn. Tests are `bun:test` — **no DOM, no component rendering tests** (apps/frontend/AGENTS.md). All testable logic lives in pure `lib/` modules.
- **Never render `error.message` to the user** (apps/frontend/src/domain/accounting/AGENTS.md). The save-failure toast uses generic translated copy — this overrides the spec's "show the server message" line.
- All user-facing strings come from `apps/frontend/messages/{en,de}.json`; every new key is added to both locales.
- Client-side routing uses `@/i18n/navigation` (`Link`, `useRouter`), never `next/link` / `next/navigation`.
- The frontend never writes GraphQL; all data access goes through `@repo/data`.
- Field labels reuse `RequirementForm.fieldForm.*`; validation messages reuse `RequirementForm.validation.*` via `useValidationMessages()`.
- URL shape: `/profile/documents/complete-profile?kind=contract|invoice&id=<id>`.
- `/profile` and `/profile/edit` render dynamically (they call `getDataClient()`, which reads cookies), so no `revalidatePath` is needed after the client-side save.
- Spec key `MyDocuments.completeProfile.submit` is intentionally not added: `FormSheet`'s footer already renders `Common.cancel` / `Common.saveChanges`.
- The org name in the sheet description comes from `useMyDocuments()` (the `contract(id)`/`invoice(id)` detail queries carry no org name), falling back to an org-less description while it loads.

---

### Task 1: Shared source→profile-key mapping in `@repo/data`

**Files:**
- Create: `packages/data/src/repositories/accounting/profile-source-keys.ts`
- Test: `packages/data/src/repositories/accounting/profile-source-keys.spec.ts`
- Modify: `packages/data/src/index.ts` (add one export line after the `template-body.types` export)
- Modify: `apps/frontend/src/domain/accounting/lib/creation-fields.ts:1-56` (drop local map, use shared one)

**Interfaces:**
- Consumes: `DataSourceKey` from `./template-body.types` (already exported from `@repo/data`).
- Produces (used by Tasks 5–6 and the `creation-fields.ts` refactor):
  - `PROFILE_SOURCE_TO_PROFILE_KEY` — `as const` map of the 9 profile-bound `DataSourceKey`s to profile system keys.
  - `type ProfileSourceKey = keyof typeof PROFILE_SOURCE_TO_PROFILE_KEY`
  - `type MissingProfileKey = (typeof PROFILE_SOURCE_TO_PROFILE_KEY)[ProfileSourceKey]`
  - `isProfileSourceKey(value: string): value is ProfileSourceKey`
  - `toMissingProfileKeys(sources: readonly string[]): MissingProfileKey[]` — drops unknown values, removes duplicates.

- [ ] **Step 1: Write the failing test**

Create `packages/data/src/repositories/accounting/profile-source-keys.spec.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import {
  PROFILE_SOURCE_TO_PROFILE_KEY,
  toMissingProfileKeys,
} from './profile-source-keys';

describe('toMissingProfileKeys', () => {
  it('maps all 9 template source keys to profile system keys', () => {
    expect(toMissingProfileKeys(Object.keys(PROFILE_SOURCE_TO_PROFILE_KEY))).toEqual([
      'firstname',
      'lastname',
      'street',
      'zip',
      'city',
      'birthdate',
      'iban',
      'account-holder',
      'bic',
    ]);
  });

  it('drops source keys the frontend does not know', () => {
    expect(
      toMissingProfileKeys(['volunteer_iban', 'org_name', 'not_a_source']),
    ).toEqual(['iban']);
  });

  it('removes duplicates', () => {
    expect(toMissingProfileKeys(['volunteer_zip', 'volunteer_zip'])).toEqual([
      'zip',
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(toMissingProfileKeys([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/data/src/repositories/accounting/profile-source-keys.spec.ts`
Expected: FAIL — module `./profile-source-keys` does not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/data/src/repositories/accounting/profile-source-keys.ts`:

```ts
import type { DataSourceKey } from './template-body.types';

/**
 * Maps a template field's bound `source` to the user profile systemKey it
 * reads from. Mirrors the backend's PROFILE_SOURCE_TO_PROFILE_KEY
 * (apps/backend/src/accounting/services/document-template.types.ts) — the two
 * must stay in sync. The document's `missingProfileFields` carries these
 * source keys; the complete-profile sheet translates them to profile fields.
 */
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
export type MissingProfileKey =
  (typeof PROFILE_SOURCE_TO_PROFILE_KEY)[ProfileSourceKey];

export function isProfileSourceKey(value: string): value is ProfileSourceKey {
  return value in PROFILE_SOURCE_TO_PROFILE_KEY;
}

/**
 * Translates a document's `missingProfileFields` (template source keys) into
 * profile system keys. Unknown values are dropped — a backend key the
 * frontend doesn't know yet must not crash the sheet — and duplicates removed.
 */
export function toMissingProfileKeys(
  sources: readonly string[],
): MissingProfileKey[] {
  const keys = new Set<MissingProfileKey>();
  for (const source of sources) {
    if (isProfileSourceKey(source)) {
      keys.add(PROFILE_SOURCE_TO_PROFILE_KEY[source]);
    }
  }
  return [...keys];
}
```

In `packages/data/src/index.ts`, find the line `export * from './repositories/accounting/template-body.types';` and add directly below it:

```ts
export * from './repositories/accounting/profile-source-keys';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/data/src/repositories/accounting/profile-source-keys.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `creation-fields.ts` onto the shared map**

In `apps/frontend/src/domain/accounting/lib/creation-fields.ts`:

Replace the import block (lines 1-6):

```ts
import type {
  DataSourceKey,
  TemplateDocument,
  TemplateField,
  TemplateLine,
} from '@repo/data';
```

with:

```ts
import {
  type DataSourceKey,
  isProfileSourceKey,
  PROFILE_SOURCE_TO_PROFILE_KEY,
  type TemplateDocument,
  type TemplateField,
  type TemplateLine,
} from '@repo/data';
```

Delete the local map (lines 26-35, the `PROFILE_SOURCE_TO_PROFILE_KEY` const and its comment) and replace `isEditableSource` (lines 37-43) with:

```ts
function isEditableSource(source: DataSourceKey): boolean {
  return isProfileSourceKey(source);
}
```

(The shared map includes the two name keys, so the explicit first/last-name checks fold into it.)

In `resolveBoundValue` (lines 45-56), replace the map lookup:

```ts
  const profileKey = PROFILE_SOURCE_TO_PROFILE_KEY[source];
```

with:

```ts
  const profileKey = isProfileSourceKey(source)
    ? PROFILE_SOURCE_TO_PROFILE_KEY[source]
    : undefined;
```

The first/last-name special-casing at the top of `resolveBoundValue` stays as-is.

- [ ] **Step 6: Run the existing creation-fields tests (behavior must be unchanged)**

Run: `bun test apps/frontend/src/domain/accounting/lib/creation-fields.spec.ts`
Expected: PASS (all existing tests).

- [ ] **Step 7: Type-check both packages**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/data/src/repositories/accounting/profile-source-keys.ts \
  packages/data/src/repositories/accounting/profile-source-keys.spec.ts \
  packages/data/src/index.ts \
  apps/frontend/src/domain/accounting/lib/creation-fields.ts
git commit -m "feat(data): share the template-source to profile-key map (VOLI-1547)"
```

---

### Task 2: `useUpdateMyProfile` mutation hook

**Files:**
- Create: `packages/data/src/react/hooks/use-update-my-profile.ts`
- Modify: `packages/data/src/react.ts` (add one export line, alphabetically after `use-update-my-image`)

**Interfaces:**
- Consumes: `UserRepository.updateMyProfile(input: UpdateMyProfileInput)` (exists), `useSdk()` from `./use-graphql-client`.
- Produces: `useUpdateMyProfile(): UseMutationResult<..., Error, UpdateMyProfileInput>` — used by the sheet in Task 5.

- [ ] **Step 1: Write the hook**

Create `packages/data/src/react/hooks/use-update-my-profile.ts`:

```ts
'use client';

import { type UpdateMyProfileInput, UserRepository } from '@repo/data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSdk } from './use-graphql-client';

/**
 * Saves the volunteer's own profile fields (the global `users` columns). The
 * profile feeds every document's `missingProfileFields`, so all accounting
 * document queries — including the single-document caches, by prefix — are
 * invalidated on success.
 */
export function useUpdateMyProfile() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const repository = new UserRepository(sdk);

  return useMutation({
    mutationFn: (input: UpdateMyProfileInput) =>
      repository.updateMyProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-documents'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-document-summary'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-contracts'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', 'my-invoices'],
      });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'contract'] });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'invoice'] });
    },
  });
}
```

- [ ] **Step 2: Export it**

In `packages/data/src/react.ts`, after the line `export * from './react/hooks/use-update-my-image';` add:

```ts
export * from './react/hooks/use-update-my-profile';
```

- [ ] **Step 3: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/data/src/react/hooks/use-update-my-profile.ts packages/data/src/react.ts
git commit -m "feat(data): add useUpdateMyProfile mutation hook (VOLI-1547)"
```

---

### Task 3: Translations

**Files:**
- Modify: `apps/frontend/messages/en.json`
- Modify: `apps/frontend/messages/de.json`

**Interfaces:**
- Produces (consumed by Tasks 4 and 6):
  - `MembershipDetail.documents.completeDetailsCta`
  - `MyDocuments.completeProfile.{title,description,descriptionWithoutOrg,savedToProfile,success,allComplete,error,saveError,close}`
- Removes: `MembershipDetail.documents.missingProfileCta` (its only two usages are replaced in Task 4).

- [ ] **Step 1: Update `en.json`**

In the `MembershipDetail.documents` block (around line 483), replace the line

```json
      "missingProfileCta": "Complete your profile to sign",
```

with:

```json
      "completeDetailsCta": "Complete details",
```

In the `MyDocuments` block (line 2657-2665), replace:

```json
  "MyDocuments": {
    "title": "My documents",
    "backLabel": "Back",
    "loadMore": "Load more ({remaining})",
    "empty": {
      "title": "No documents yet",
      "description": "Agreements and timesheets from your organisations will appear here."
    }
  }
```

with:

```json
  "MyDocuments": {
    "title": "My documents",
    "backLabel": "Back",
    "loadMore": "Load more ({remaining})",
    "empty": {
      "title": "No documents yet",
      "description": "Agreements and timesheets from your organisations will appear here."
    },
    "completeProfile": {
      "title": "Complete your details",
      "description": "Required for {documentName} at {orgName}.",
      "descriptionWithoutOrg": "Required for {documentName}.",
      "savedToProfile": "The details are saved to your profile and used for all your documents.",
      "success": "Details saved",
      "allComplete": "All details are complete — there is nothing left to fill in.",
      "error": "We couldn't load this document. Please try again.",
      "saveError": "We couldn't save your details. Please try again.",
      "close": "Close"
    }
  }
```

- [ ] **Step 2: Update `de.json`**

In the `MembershipDetail.documents` block (line 484), replace:

```json
      "missingProfileCta": "Profil vervollständigen, um zu unterschreiben",
```

with:

```json
      "completeDetailsCta": "Daten vervollständigen",
```

In the `MyDocuments` block, add the same `completeProfile` object after the `empty` block (keeping `title`/`backLabel`/`loadMore`/`empty` untouched), with German copy:

```json
    "completeProfile": {
      "title": "Vervollständige deine Daten",
      "description": "Wird für {documentName} bei {orgName} benötigt.",
      "descriptionWithoutOrg": "Wird für {documentName} benötigt.",
      "savedToProfile": "Die Angaben werden in deinem Profil gespeichert und für alle deine Dokumente verwendet.",
      "success": "Angaben gespeichert",
      "allComplete": "Alle Angaben sind vollständig – es gibt nichts mehr auszufüllen.",
      "error": "Wir konnten dieses Dokument nicht laden. Bitte versuche es erneut.",
      "saveError": "Wir konnten deine Angaben nicht speichern. Bitte versuche es erneut.",
      "close": "Schließen"
    }
```

- [ ] **Step 3: Type-check (next-intl validates key parity at type level)**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/messages/en.json apps/frontend/messages/de.json
git commit -m "feat(i18n): complete-profile sheet copy (VOLI-1547)"
```

---

### Task 4: Document card + preview point at the sheet

**Files:**
- Modify: `apps/frontend/src/domain/accounting/components/volunteer-document-card.tsx` (lines 92-98 console.log, lines 181-218 actions block)
- Modify: `apps/frontend/src/domain/accounting/components/volunteer-document-preview.tsx` (lines 217-229 link)
- Modify: `apps/frontend/src/domain/accounting/components/volunteer-my-documents.tsx` (lines 49-53 console.log)

**Interfaces:**
- Consumes: `MembershipDetail.documents.completeDetailsCta` (Task 3). `VolunteerDocument.kind` / `.id` / `.missingProfileFields` (existing).

- [ ] **Step 1: Card — remove the debug log and rework the awaiting-signature actions**

In `volunteer-document-card.tsx`, delete the debug log (lines 94-98):

```tsx
  console.log(
    'missingProfileFields',
    missingProfileFields,
    document.missingProfileFields,
  );
```

Then replace the whole `{awaitingSignature && (...)}` block (lines 181-218) with:

```tsx
        {awaitingSignature && (
          <>
            {missingProfileFields && (
              <div className="flex flex-col gap-1 px-1">
                <p className="text-xs text-muted-foreground">
                  {t('missingProfileWarning')}
                </p>
                <Button asChild className="w-full">
                  <Link
                    href={`/profile/documents/complete-profile?kind=${document.kind}&id=${document.id}`}
                  >
                    <FileUserIcon />
                    {t('completeDetailsCta')}
                  </Link>
                </Button>
              </div>
            )}
            <Button
              className="w-full"
              disabled={missingProfileFields}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(document);
              }}
            >
              <SignatureIcon />
              {t('actions.sign')}
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onDecline(document);
              }}
            >
              <OctagonXIcon />
              {t('actions.decline')}
            </Button>
          </>
        )}
```

`Link`, `FileUserIcon`, `SignatureIcon`, `OctagonXIcon` are all already imported in this file — no import changes needed.

- [ ] **Step 2: List — remove the debug log**

In `volunteer-my-documents.tsx`, delete (lines 49-53):

```tsx
  console.log(
    'myDocumentsQuery',
    myDocumentsQuery.data,
    myDocumentsQuery.isLoading,
  );
```

- [ ] **Step 3: Preview — point the missing-details link at the sheet**

In `volunteer-document-preview.tsx`, replace the missing-profile block (lines 217-229):

```tsx
                {canDecide && missingProfileFields.length > 0 && (
                  <div className="flex flex-col gap-1 px-1">
                    <p className="text-xs text-muted-foreground">
                      {t('missingProfileWarning')}
                    </p>
                    <Link
                      href="/profile"
                      className="text-xs font-medium text-primary underline underline-offset-2"
                    >
                      {t('missingProfileCta')}
                    </Link>
                  </div>
                )}
```

with:

```tsx
                {canDecide && missingProfileFields.length > 0 && (
                  <div className="flex flex-col gap-1 px-1">
                    <p className="text-xs text-muted-foreground">
                      {t('missingProfileWarning')}
                    </p>
                    <Link
                      href={`/profile/documents/complete-profile?kind=${kind}&id=${documentId}`}
                      className="text-xs font-medium text-primary underline underline-offset-2"
                    >
                      {t('completeDetailsCta')}
                    </Link>
                  </div>
                )}
```

- [ ] **Step 4: Verify no stale references and type-check**

Run: `grep -rn "missingProfileCta" apps/frontend packages` — expect no matches.
Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/domain/accounting/components/volunteer-document-card.tsx \
  apps/frontend/src/domain/accounting/components/volunteer-document-preview.tsx \
  apps/frontend/src/domain/accounting/components/volunteer-my-documents.tsx
git commit -m "feat(accounting): gate card sign on missing profile details, link to complete-profile sheet (VOLI-1547)"
```

---

### Task 5: Complete-profile sheet component + field helpers

**Files:**
- Create: `apps/frontend/src/domain/accounting/lib/complete-profile-fields.ts`
- Test: `apps/frontend/src/domain/accounting/lib/complete-profile-fields.spec.ts`
- Create: `apps/frontend/src/domain/accounting/components/complete-profile-sheet.tsx`

**Interfaces:**
- Consumes: `toMissingProfileKeys`, `MissingProfileKey` (Task 1); `useUpdateMyProfile` (Task 2); `MyDocuments.completeProfile.*`, `MembershipDetail.documents.names`, `RequirementForm.fieldForm.*` (Task 3); `buildFieldSchema`/`FieldRenderer`/`useValidationMessages`/`RenderableField` from `@/domain/requirement-form/components/field-renderer`; `SYSTEM_PROFILE_FIELDS` from `@/domain/requirement-form/system-profile-fields`; `profileDataToUpdateInput` from `@/domain/user/lib/profile-data-map`; `FormSheet`/`useFormSheet` from `@/components/form-sheet`.
- Produces: `CompleteProfileSheet` (consumed by Task 6's sheet page) and pure helpers `missingFieldsToRenderable(missingKeys, labelFor): RenderableField[]`, `completeProfileDefaultValues(missingKeys, names): Record<string, string>`.

- [ ] **Step 1: Write the failing test for the field helpers**

Create `apps/frontend/src/domain/accounting/lib/complete-profile-fields.spec.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { FieldType } from '@repo/data';
import { buildFieldSchema } from '../../requirement-form/components/field-renderer';
import {
  completeProfileDefaultValues,
  missingFieldsToRenderable,
} from './complete-profile-fields';

const labelFor = (labelKey: string) => `label:${labelKey}`;

const msgs = {
  fieldRequired: (l: string) => `${l} required`,
  mustBeNumber: (l: string) => `${l} number`,
  mustBeValidDate: (l: string) => `${l} date`,
  mustBeValidEmail: (l: string) => `${l} email`,
  mustBeValidPhone: (l: string) => `${l} phone`,
  invalidOptions: (l: string) => `${l} options`,
  maxChars: (l: string, m: number) => `${l} max ${m}`,
  invalidCharacters: (l: string) => `${l} chars`,
  validPostalCode: (l: string) => `${l} zip`,
  minAge: (a: number) => `min ${a}`,
  invalidIban: (l: string) => `${l} iban`,
  invalidBic: (l: string) => `${l} bic`,
  dateNotFuture: (l: string) => `${l} not future`,
};

describe('missingFieldsToRenderable', () => {
  it('renders exactly the missing fields, in SYSTEM_PROFILE_FIELDS order, all required', () => {
    const fields = missingFieldsToRenderable(['iban', 'street', 'zip'], labelFor);
    expect(fields.map((f) => f.id)).toEqual(['street', 'zip', 'iban']);
    expect(fields.every((f) => f.required)).toBe(true);
    expect(fields.map((f) => f.label)).toEqual([
      'label:street',
      'label:zipCode',
      'label:iban',
    ]);
  });

  it('rejects an invalid IBAN and zip, accepts valid ones', () => {
    // SYSTEM_PROFILE_FIELDS orders zip before iban regardless of input order.
    const fields = missingFieldsToRenderable(['iban', 'zip'], labelFor);
    expect(fields.map((f) => f.id)).toEqual(['zip', 'iban']);
    const zip = buildFieldSchema(fields[0], true, msgs);
    const iban = buildFieldSchema(fields[1], true, msgs);
    expect(zip.safeParse('!!!').success).toBe(false);
    expect(zip.safeParse('10115').success).toBe(true);
    expect(iban.safeParse('DE00 0000 0000 0000 0000 00').success).toBe(false);
    expect(iban.safeParse('DE89 3704 0044 0532 0130 00').success).toBe(true);
  });

  it('rejects empty values — every field is required', () => {
    const fields = missingFieldsToRenderable(['city'], labelFor);
    expect(buildFieldSchema(fields[0], true, msgs).safeParse('').success).toBe(
      false,
    );
  });
});

describe('completeProfileDefaultValues', () => {
  it('prefills the account holder from the names, everything else empty', () => {
    expect(
      completeProfileDefaultValues(['street', 'account-holder'], {
        firstname: 'Erika',
        lastname: 'Musterfrau',
      }),
    ).toEqual({ street: '', 'account-holder': 'Erika Musterfrau' });
  });

  it('leaves the account holder empty when the names are unknown', () => {
    expect(
      completeProfileDefaultValues(['account-holder'], {
        firstname: null,
        lastname: null,
      }),
    ).toEqual({ 'account-holder': '' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/frontend/src/domain/accounting/lib/complete-profile-fields.spec.ts`
Expected: FAIL — module `./complete-profile-fields` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `apps/frontend/src/domain/accounting/lib/complete-profile-fields.ts`:

```ts
import type { MissingProfileKey } from '@repo/data';
import type { RenderableField } from '../../requirement-form/components/field-renderer';
import { SYSTEM_PROFILE_FIELDS } from '../../requirement-form/system-profile-fields';

/**
 * The complete-profile sheet renders exactly the document's missing profile
 * fields, each required, in SYSTEM_PROFILE_FIELDS order so the address fields
 * stay grouped regardless of the order the backend reports them in.
 */
export function missingFieldsToRenderable(
  missingKeys: readonly MissingProfileKey[],
  labelFor: (labelKey: string) => string,
): RenderableField[] {
  const missing = new Set<string>(missingKeys);
  return SYSTEM_PROFILE_FIELDS.filter((field) => missing.has(field.key)).map(
    (field) => ({
      id: field.key,
      systemKey: field.key,
      type: field.type,
      label: labelFor(field.labelKey),
      required: true,
      description: null,
      placeholder: null,
      options: null,
      documents: [],
      documentLabel: null,
      minAge: null,
    }),
  );
}

/** "Firstname Lastname" when the names are known, otherwise empty. */
export function accountHolderDefault(names: {
  firstname?: string | null;
  lastname?: string | null;
}): string {
  return [names.firstname?.trim() ?? '', names.lastname?.trim() ?? '']
    .filter(Boolean)
    .join(' ');
}

/**
 * Only missing fields are shown, so everything starts empty — except the
 * account holder, which is prefilled from the volunteer's name.
 */
export function completeProfileDefaultValues(
  missingKeys: readonly MissingProfileKey[],
  names: { firstname?: string | null; lastname?: string | null },
): Record<string, string> {
  return Object.fromEntries(
    missingKeys.map((key) => [
      key,
      key === 'account-holder' ? accountHolderDefault(names) : '',
    ]),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/frontend/src/domain/accounting/lib/complete-profile-fields.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement the sheet component**

Create `apps/frontend/src/domain/accounting/components/complete-profile-sheet.tsx`:

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type MissingProfileKey, toMissingProfileKeys } from '@repo/data';
import {
  useContract,
  useInvoice,
  useMyDocuments,
  useUpdateMyProfile,
} from '@repo/data/react';
import {
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  useIsMobile,
} from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Controller, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormSheet, useFormSheet } from '@/components/form-sheet';
import {
  buildFieldSchema,
  FieldRenderer,
  useValidationMessages,
} from '@/domain/requirement-form/components/field-renderer';
import { profileDataToUpdateInput } from '@/domain/user/lib/profile-data-map';
import { useRouter } from '@/i18n/navigation';
import {
  completeProfileDefaultValues,
  missingFieldsToRenderable,
} from '../lib/complete-profile-fields';
import type { VolunteerDocumentKind } from '../lib/volunteer-documents.utils';

interface CompleteProfileSheetProps {
  kind: VolunteerDocumentKind | null;
  documentId: string | null;
  userNames: { firstname: string | null; lastname: string | null };
}

/**
 * Sheet over "My documents" that collects exactly the profile details one
 * document is missing. Bad URLs, load failures and the already-complete case
 * render a message state instead of the form; saving writes the volunteer's
 * profile and returns to the refreshed documents list.
 */
export function CompleteProfileSheet({
  kind,
  documentId,
  userNames,
}: CompleteProfileSheetProps) {
  const t = useTranslations('MyDocuments.completeProfile');
  const tNames = useTranslations('MembershipDetail.documents.names');
  const router = useRouter();
  const { open, setOpen } = useFormSheet();

  // Always return to the list — a hard load of the sheet URL has no back entry.
  const close = () => setOpen(false, () => router.replace('/profile/documents'));

  const contractQuery = useContract(
    kind === 'contract' ? (documentId ?? undefined) : undefined,
  );
  const invoiceQuery = useInvoice(
    kind === 'invoice' ? (documentId ?? undefined) : undefined,
  );
  const query = kind === 'contract' ? contractQuery : invoiceQuery;

  // The detail queries carry no org name; the (usually cached) documents list
  // does, so the description can name the org the document belongs to.
  const myDocumentsQuery = useMyDocuments();
  const orgName = useMemo(() => {
    if (!documentId) return null;
    for (const group of myDocumentsQuery.data ?? []) {
      if (
        group.contracts.some((c) => c.id === documentId) ||
        group.invoices.some((i) => i.id === documentId)
      ) {
        return group.organizationName;
      }
    }
    return null;
  }, [myDocumentsQuery.data, documentId]);

  const missingKeys = useMemo(
    () => toMissingProfileKeys(query.data?.missingProfileFields ?? []),
    [query.data],
  );

  const documentName = kind
    ? tNames(kind === 'contract' ? 'agreement' : 'timesheet')
    : '';
  const description = orgName
    ? `${t('description', { documentName, orgName })} ${t('savedToProfile')}`
    : `${t('descriptionWithoutOrg', { documentName })} ${t('savedToProfile')}`;

  if (kind === null || documentId === null || query.isError) {
    return (
      <MessageSheet
        open={open}
        onClose={close}
        title={t('title')}
        message={t('error')}
        closeLabel={t('close')}
      />
    );
  }

  if (query.isLoading || !query.data) {
    return (
      <FormSheet
        title={t('title')}
        description={description}
        onSubmit={() => {}}
        open={open}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        submitDisabled
      >
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </FormSheet>
    );
  }

  if (missingKeys.length === 0) {
    return (
      <MessageSheet
        open={open}
        onClose={close}
        title={t('title')}
        message={t('allComplete')}
        closeLabel={t('close')}
      />
    );
  }

  return (
    <CompleteProfileForm
      missingKeys={missingKeys}
      userNames={userNames}
      title={t('title')}
      description={description}
      open={open}
      onClose={close}
    />
  );
}

/** Error / nothing-missing states: a message and a Close button, no form. */
function MessageSheet({
  open,
  onClose,
  title,
  message,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  closeLabel: string;
}) {
  const isMobile = useIsMobile();
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex h-full w-full flex-col gap-0 overflow-hidden md:max-w-xl',
          isMobile && 'max-h-[calc(100vh-1.5rem)] rounded-t-2xl',
        )}
      >
        <SheetHeader className="shrink-0 px-6 pt-6">
          <SheetTitle className="text-2xl font-bold">{title}</SheetTitle>
          <SheetDescription>{message}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="mt-auto flex shrink-0 flex-row">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {closeLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CompleteProfileForm({
  missingKeys,
  userNames,
  title,
  description,
  open,
  onClose,
}: {
  missingKeys: MissingProfileKey[];
  userNames: { firstname: string | null; lastname: string | null };
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('MyDocuments.completeProfile');
  const tFields = useTranslations('RequirementForm.fieldForm');
  const messages = useValidationMessages();
  const updateProfile = useUpdateMyProfile();

  const fields = useMemo(
    () => missingFieldsToRenderable(missingKeys, tFields),
    [missingKeys, tFields],
  );

  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          fields.map((f) => [f.id, buildFieldSchema(f, true, messages)]),
        ),
      ),
    [fields, messages],
  );

  const defaultValues = useMemo(
    () => completeProfileDefaultValues(missingKeys, userNames),
    [missingKeys, userNames],
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as Resolver<Record<string, string>>,
    defaultValues,
    mode: 'onChange',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync(profileDataToUpdateInput(values));
      toast.success(t('success'));
      onClose();
    } catch {
      // Never render the server message — it can carry internal ids. Generic
      // copy, sheet stays open with the values intact.
      toast.error(t('saveError'));
    }
  });

  return (
    <FormSheet
      title={title}
      description={description}
      onSubmit={onSubmit}
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      pending={updateProfile.isPending}
      submitDisabled={!isValid}
    >
      {fields.map((f) => (
        <Controller
          key={f.id}
          name={f.id}
          control={control}
          render={({ field: ctrl }) => (
            <FieldRenderer
              field={f}
              value={ctrl.value ?? ''}
              onChange={ctrl.onChange}
              error={errors[f.id]?.message}
            />
          )}
        />
      ))}
    </FormSheet>
  );
}
```

- [ ] **Step 6: Type-check, lint, run the new tests**

Run: `bun run check-types && bun run lint && bun test apps/frontend/src/domain/accounting/lib/complete-profile-fields.spec.ts`
Expected: no type errors, no lint errors, tests pass. (The component is not routed yet — Task 6 wires it up and smoke-tests the flow.)

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/domain/accounting/lib/complete-profile-fields.ts \
  apps/frontend/src/domain/accounting/lib/complete-profile-fields.spec.ts \
  apps/frontend/src/domain/accounting/components/complete-profile-sheet.tsx
git commit -m "feat(accounting): complete-profile sheet over My documents (VOLI-1547)"
```

---

### Task 6: Sheet routes on `/profile/documents`

**Files:**
- Create: `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/my-documents-content.tsx`
- Modify: `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/page.tsx`
- Create: `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/layout.tsx`
- Create: `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/complete-profile/page.tsx`
- Create: `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/@sheet/default.tsx`
- Create: `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/@sheet/complete-profile/page.tsx`

**Interfaces:**
- Consumes: `CompleteProfileSheet` from Task 5 (`@/domain/accounting/components/complete-profile-sheet`) with props `{ kind: 'contract' | 'invoice' | null; documentId: string | null; userNames: { firstname: string | null; lastname: string | null } }`.
- Produces: the route `/profile/documents/complete-profile?kind&id` rendering the sheet over the documents list.

- [ ] **Step 1: Extract the list into a shared server component**

Create `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/my-documents-content.tsx` with the current body of `page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server';
import { VolunteerMyDocuments } from '@/domain/accounting/components/volunteer-my-documents';
import { VolunteerMyDocumentsHeader } from '@/domain/accounting/components/volunteer-my-documents-header';

/**
 * The volunteer's cross-org "My documents" list — every document they are
 * party to across all their organizations, grouped per org. Shared by the
 * list page and the complete-profile fallback page, so a hard load of the
 * sheet URL renders the list behind the open sheet.
 */
export async function MyDocumentsContent() {
  const t = await getTranslations('MyDocuments');

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30">
        <VolunteerMyDocumentsHeader title={t('title')} />
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6">
        <VolunteerMyDocuments />
      </div>
    </div>
  );
}
```

Replace the entire contents of `page.tsx` with:

```tsx
import { MyDocumentsContent } from './my-documents-content';

/**
 * The volunteer's cross-org "My documents" page. Reached from the profile
 * dropdown ("Meine Dokumente").
 */
export default async function MyDocumentsPage() {
  return <MyDocumentsContent />;
}
```

- [ ] **Step 2: Add the layout with the `@sheet` slot**

Create `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

export default function DocumentsLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
```

- [ ] **Step 3: Add the `@sheet` default and sheet page**

Create `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/@sheet/default.tsx`:

```tsx
export default function SheetDefaultPage() {
  return null;
}
```

Create `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/@sheet/complete-profile/page.tsx`:

```tsx
import { CompleteProfileSheet } from '@/domain/accounting/components/complete-profile-sheet';
import { getDataClient } from '@/lib/data-client';

interface CompleteProfileSheetPageProps {
  searchParams: Promise<{ kind?: string; id?: string }>;
}

/**
 * Sheet route: complete the profile details one document is missing. Bad
 * `kind`/`id` values are forwarded as null — the sheet renders its own error
 * state rather than a 404. The current user's names come along for the
 * account-holder prefill.
 */
export default async function CompleteProfileSheetPage({
  searchParams,
}: CompleteProfileSheetPageProps) {
  const { kind, id } = await searchParams;
  const data = await getDataClient();
  const me = await data.user.getMe();

  return (
    <CompleteProfileSheet
      kind={kind === 'contract' || kind === 'invoice' ? kind : null}
      documentId={id ?? null}
      userNames={{ firstname: me.firstname, lastname: me.lastname }}
    />
  );
}
```

- [ ] **Step 4: Add the main-slot fallback page**

Create `apps/frontend/src/app/[locale]/(volunteering)/profile/documents/complete-profile/page.tsx`:

```tsx
import { MyDocumentsContent } from '../my-documents-content';

/**
 * Main-slot fallback for the complete-profile sheet URL: a hard load or
 * reload of `/profile/documents/complete-profile?...` renders the documents
 * list behind the open sheet instead of a 404.
 */
export default async function CompleteProfileFallbackPage() {
  return <MyDocumentsContent />;
}
```

- [ ] **Step 5: Type-check**

Run: `bun run check-types`
Expected: no errors.

- [ ] **Step 6: Smoke-test the flow manually**

Run `bun run dev`, sign in as a demo volunteer whose profile lacks address/IBAN data (or clear a field on `/profile/edit` first), open `/profile/documents`, click "Complete details" on a card with the missing-details warning, fill the sheet, save, and confirm the card's Sign button becomes enabled without a page reload. Also hard-reload the sheet URL and confirm the list renders behind the sheet.

- [ ] **Step 7: Commit**

```bash
git add "apps/frontend/src/app/[locale]/(volunteering)/profile/documents/"
git commit -m "feat(accounting): @sheet routes for complete-profile on My documents (VOLI-1547)"
```

---

### Task 7: E2E — complete details from the card, then sign

**Files:**
- Modify: `e2e/tests/features/accounting/documents-flow.e2e.ts` (add one test, first in the describe)

**Interfaces:**
- Consumes: the card's `Complete details` link (Task 4), the sheet (Tasks 5-6), existing page objects `AdminReimbursementsPage` / `LoginPage`.
- Note: the e2e fixture members (`demo+e2e_member02@caluno.org`) are seeded with street/IBAN/birthdate but **no zip/city**, and the default contract preset binds `volunteer_zip`/`volunteer_city` — so the missing-details state arises naturally. The new test runs **first** in the file and leaves zip/city filled, which the existing sign flow needs (the card's Sign button is now disabled while details are missing). The test clears zip/city via the profile edit page at the start so it is re-runnable against a stateful dev DB.

- [ ] **Step 1: Add the test**

In `e2e/tests/features/accounting/documents-flow.e2e.ts`, add as the first `test(...)` inside the describe block (before the `'admin creates → volunteer signs → ...'` test):

```ts
  test('volunteer completes missing profile details in a sheet from "My documents", then the card becomes signable', async ({
    browser,
  }) => {
    // ── Admin side: a fresh contract awaits the volunteer's signature ──────
    const adminContext = await browser.newContext({
      storageState: adminAuthFile,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await adminPage.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUnitId = new URL(adminPage.url()).pathname.split('/')[3];
    const board = new AdminReimbursementsPage(adminPage);
    await board.goto(orgUnitId);
    await board.createContractFor(VOLUNTEER_NAME);
    await adminContext.close();

    const volunteerContext = await browser.newContext({
      storageState: volunteerAuthFile,
    });
    const volunteerPage = await volunteerContext.newPage();

    // The fixtures seed no zip/city; clear them anyway so the test is
    // re-runnable against a stateful dev DB where an earlier run filled them.
    // Saving with untouched (already empty) fields is a no-op — the form's
    // Save stays disabled — so only save when there is something to clear.
    await volunteerPage.goto(`${BASE_URL}/en/profile/edit`, {
      waitUntil: 'load',
    });
    const zipInput = volunteerPage.getByLabel('Postal code');
    const cityInput = volunteerPage.getByLabel('City', { exact: true });
    if (
      (await zipInput.inputValue()) !== '' ||
      (await cityInput.inputValue()) !== ''
    ) {
      await zipInput.fill('');
      await cityInput.fill('');
      await volunteerPage
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await volunteerPage.waitForURL(/\/en\/profile$/, { timeout: 15_000 });
    }

    // ── My documents: Sign is disabled, "Complete details" opens the sheet ──
    await volunteerPage.goto(`${BASE_URL}/en/profile/documents`, {
      waitUntil: 'load',
    });
    const card = volunteerPage
      .locator(
        '[data-testid="volunteer-document-card"][data-state="awaiting-signature"]',
      )
      .first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(
      'Your profile is missing details this document needs.',
    );
    await expect(
      card.getByRole('button', { name: 'Sign', exact: true }),
    ).toBeDisabled();

    await card.getByRole('link', { name: 'Complete details' }).click();
    await volunteerPage.waitForURL(
      /\/en\/profile\/documents\/complete-profile\?kind=contract&id=[^&]+/,
      { timeout: 15_000 },
    );

    const sheet = volunteerPage.getByRole('dialog');
    await expect(sheet.getByText('Complete your details')).toBeVisible();

    // Only the missing fields render: postal code and city, no IBAN.
    await expect(sheet.getByLabel('Postal code')).toBeVisible();
    await expect(sheet.getByLabel('City', { exact: true })).toBeVisible();
    await expect(sheet.getByLabel('IBAN')).toHaveCount(0);

    await sheet.getByLabel('Postal code').fill('10115');
    await sheet.getByLabel('City', { exact: true }).fill('Berlin');
    const save = sheet.getByRole('button', { name: 'Save changes' });
    await expect(save).toBeEnabled();
    const [saveResponse] = await Promise.all([
      volunteerPage.waitForResponse(
        (response) =>
          response.url().includes('/graphql') &&
          (response.request().postData() ?? '').includes('UpdateMyProfile'),
        { timeout: 20_000 },
      ),
      save.click(),
    ]);
    expect(saveResponse.ok()).toBeTruthy();

    // ── Back on My documents: the refreshed card is signable ───────────────
    await volunteerPage.waitForURL(/\/en\/profile\/documents$/, {
      timeout: 15_000,
    });
    const refreshed = volunteerPage
      .locator(
        '[data-testid="volunteer-document-card"][data-state="awaiting-signature"]',
      )
      .first();
    await expect(
      refreshed.getByRole('button', { name: 'Sign', exact: true }),
    ).toBeEnabled();
    await expect(
      refreshed.getByRole('link', { name: 'Complete details' }),
    ).toHaveCount(0);

    await volunteerContext.close();
  });
```

- [ ] **Step 2: Run the e2e suite**

The suite needs the e2e fixtures and running dev servers:

```bash
bun run db:up && bun run --cwd apps/backend db:fixtures:e2e
bun run dev   # in a separate terminal
cd e2e && E2E_BASE_URL=http://localhost:3000 bunx playwright test tests/features/accounting/documents-flow.e2e.ts
```

Expected: all tests pass — the new sheet test, then the existing sign/decline and badge tests.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/features/accounting/documents-flow.e2e.ts
git commit -m "test(e2e): complete profile details from the document card sheet (VOLI-1547)"
```

---

## Final verification

- [ ] `bun run lint`
- [ ] `bun run check-types`
- [ ] `bun test` (repo unit tests)
- [ ] E2E suite green (Task 7, Step 2)
