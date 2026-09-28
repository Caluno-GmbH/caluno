# Gender select field implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the gender system profile field from free text into a select with five fixed options, localised DE/EN, with a backfill of existing answers.

**Architecture:** Reuse `FieldType.SINGLE_CHOICE`. The five option values live in a mirrored constant (frontend `gender-options.ts`, backend `constants.ts`); localized labels come from a new `RequirementForm.genderOptions` message namespace. The frontend injects the fixed options whenever `systemKey === 'gender'`; the backend validates membership in `validateSystemKeyValue`. Two custom drizzle migrations convert existing field rows and backfill `user_profiles.data.gender`.

**Tech Stack:** NestJS + Drizzle (backend), Next.js 16 + next-intl + react-hook-form/zod (frontend), bun:test, Biome.

**Spec:** `docs/specs/2026-09-15-gender-select-field-design.md` (approved, committed).

## Global Constraints

- Use `bun` — never npm or yarn.
- The five gender option values are exactly `female`, `male`, `diverse`, `other`, `prefer-not-to-say` — identical strings in the frontend and backend constants.
- All user-facing strings come from `messages/{en,de}.json`; both locales stay in sync, key shapes identical.
- Test runner is `bun:test` only. No DOM, no rendered-component tests. Backend unit tests: `cd apps/backend && bun test src`. Backend integration tests: `cd apps/backend && bun test test/` (needs Postgres via `bun run db:up`). Frontend tests: `cd apps/frontend && bun test src`.
- Backend errors: throw `*GraphQLError` from `src/graphql/errors`, never raw exceptions.
- Migrations: scaffold with `bun run db:generate --custom --name <name>` (drizzle-kit), never create migration folders by hand. Apply with `bun run db:migrate`.
- Do not touch `apps/backend/src/schema.gql` or `packages/data/src/generated/graphql.ts` — no GraphQL schema change in this plan.
- Commit after each task.

---

### Task 1: Frontend option catalog + message catalogs

**Files:**
- Create: `apps/frontend/src/domain/requirement-form/gender-options.ts`
- Test: `apps/frontend/src/domain/requirement-form/gender-options.spec.ts`
- Modify: `apps/frontend/messages/en.json` (insert after the `"form"` object, ~line 1044)
- Modify: `apps/frontend/messages/de.json` (insert after the `"form"` object, ~line 1044)

**Interfaces:**
- Produces: `GENDER_OPTION_VALUES` (`readonly ['female','male','diverse','other','prefer-not-to-say']`), `GenderOptionValue`, `isGenderOptionValue(v: string): v is GenderOptionValue` — consumed by Tasks 3, 4, 5. Message namespace `RequirementForm.genderOptions` with keys `female`, `male`, `diverse`, `other`, `prefer-not-to-say` — consumed by Tasks 3, 4.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/domain/requirement-form/gender-options.spec.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { GENDER_OPTION_VALUES, isGenderOptionValue } from './gender-options';

describe('gender options', () => {
  it('defines the fixed option list in order', () => {
    expect(GENDER_OPTION_VALUES).toEqual([
      'female',
      'male',
      'diverse',
      'other',
      'prefer-not-to-say',
    ]);
  });

  it('accepts each option value', () => {
    for (const v of GENDER_OPTION_VALUES) {
      expect(isGenderOptionValue(v)).toBe(true);
    }
  });

  it('rejects arbitrary strings', () => {
    expect(isGenderOptionValue('Weiblich')).toBe(false);
    expect(isGenderOptionValue('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && bun test src/domain/requirement-form/gender-options.spec.ts`
Expected: FAIL — `Cannot find module './gender-options'`.

- [ ] **Step 3: Write the implementation**

Create `apps/frontend/src/domain/requirement-form/gender-options.ts`:

```ts
export const GENDER_OPTION_VALUES = [
  'female',
  'male',
  'diverse',
  'other',
  'prefer-not-to-say',
] as const;

export type GenderOptionValue = (typeof GENDER_OPTION_VALUES)[number];

export const isGenderOptionValue = (v: string): v is GenderOptionValue =>
  (GENDER_OPTION_VALUES as readonly string[]).includes(v);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/frontend && bun test src/domain/requirement-form/gender-options.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the message catalogs**

In `apps/frontend/messages/en.json`, insert between the closing `},` of `"form"` (line 1044) and the opening `"submission": {` (line 1045):

```json
    "genderOptions": {
      "female": "Female",
      "male": "Male",
      "diverse": "Diverse",
      "other": "Other",
      "prefer-not-to-say": "Prefer not to say"
    },
```

In `apps/frontend/messages/de.json`, insert between the closing `},` of `"form"` (line 1044) and the opening `"submission": {` (line 1045):

```json
    "genderOptions": {
      "female": "Weiblich",
      "male": "Männlich",
      "diverse": "Divers",
      "other": "Andere",
      "prefer-not-to-say": "Keine Angabe"
    },
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/domain/requirement-form/gender-options.ts apps/frontend/src/domain/requirement-form/gender-options.spec.ts apps/frontend/messages/en.json apps/frontend/messages/de.json
git commit -m "feat(frontend): fixed gender option catalog with DE/EN labels"
```

---

### Task 2: Backend validation against the fixed list

**Files:**
- Modify: `apps/backend/src/requirement-profile/constants.ts`
- Modify: `apps/backend/src/requirement-profile/profile-validation.ts:78-83`
- Test: `apps/backend/src/requirement-profile/profile-validation.spec.ts`

**Interfaces:**
- Produces: `GENDER_OPTION_VALUES` from `apps/backend/src/requirement-profile/constants.ts` — same five strings as Task 1. Consumed by Task 2 only (the form-submission service picks the rule up through the existing `validateSystemKeyValue` call).

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('validateSystemKeyValue', ...)` in `apps/backend/src/requirement-profile/profile-validation.spec.ts`:

```ts
  describe('gender', () => {
    it('accepts all five fixed option values', () => {
      for (const v of [
        'female',
        'male',
        'diverse',
        'other',
        'prefer-not-to-say',
      ]) {
        expectOk(v, 'gender');
      }
    });

    it('accepts an empty value (no answer is not an invalid value)', () => {
      expectOk('', 'gender');
    });

    it('rejects values outside the fixed list, including legacy free text', () => {
      expectBad('Weiblich', 'gender');
      expectBad('non-binary', 'gender');
      expectBad('anything', 'gender');
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/backend && bun test src/requirement-profile/profile-validation.spec.ts`
Expected: FAIL — the "rejects values outside the fixed list" test fails because the current 50-character rule accepts `Weiblich`.

- [ ] **Step 3: Write the implementation**

In `apps/backend/src/requirement-profile/constants.ts`, append:

```ts
/** Fixed option values for the gender system field. Mirrored in the frontend (gender-options.ts). */
export const GENDER_OPTION_VALUES = [
  'female',
  'male',
  'diverse',
  'other',
  'prefer-not-to-say',
] as const;
```

In `apps/backend/src/requirement-profile/profile-validation.ts`, add the import at the top:

```ts
import { GENDER_OPTION_VALUES } from './constants';
```

Replace the `gender` case (lines 78-83):

```ts
    case 'gender':
      if (value.length > 50)
        throw new BadRequestGraphQLError(
          `"${label}": must be 50 characters or fewer`,
        );
      break;
```

with:

```ts
    case 'gender':
      if (!(GENDER_OPTION_VALUES as readonly string[]).includes(value))
        throw new BadRequestGraphQLError(
          `"${label}": must be one of the available options`,
        );
      break;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/backend && bun test src/requirement-profile/profile-validation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/requirement-profile/constants.ts apps/backend/src/requirement-profile/profile-validation.ts apps/backend/src/requirement-profile/profile-validation.spec.ts
git commit -m "feat(backend): validate gender against fixed option list"
```

---

### Task 3: Frontend select rendering + zod schema

**Files:**
- Modify: `apps/frontend/src/domain/requirement-form/components/field-renderer.tsx` (SINGLE_CHOICE branch ~line 185-196, 400-430; gender rule ~line 256-258)
- Test: `apps/frontend/src/domain/requirement-form/components/field-renderer.spec.ts`

**Interfaces:**
- Consumes: `GENDER_OPTION_VALUES` from `../gender-options` (Task 1); message namespace `RequirementForm.genderOptions` (Task 1).
- Produces: no new exports — behavior change inside `buildFieldSchema` and `FieldRenderer`. Both are consumed by `edit-identity-form.tsx`, `volunteer-form.tsx`, and `form-block-section.tsx` automatically.

- [ ] **Step 1: Write the failing test**

Append to `apps/frontend/src/domain/requirement-form/components/field-renderer.spec.ts`:

```ts
describe('buildFieldSchema gender', () => {
  const genderField = makeField({
    id: 'gender',
    type: FieldType.SingleChoice,
    label: 'Gender',
    systemKey: 'gender',
  });

  it('accepts each fixed option value when optional', () => {
    const schema = buildFieldSchema(genderField, false, msgs);
    for (const v of [
      'female',
      'male',
      'diverse',
      'other',
      'prefer-not-to-say',
    ]) {
      expect(schema.safeParse(v).success).toBe(true);
    }
    expect(schema.safeParse('').success).toBe(true);
  });

  it('rejects free text and values outside the fixed list', () => {
    const schema = buildFieldSchema(genderField, false, msgs);
    expect(schema.safeParse('Weiblich').success).toBe(false);
    expect(schema.safeParse('attack').success).toBe(false);
  });

  it('requires a value when the field is required', () => {
    const schema = buildFieldSchema(genderField, true, msgs);
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse('prefer-not-to-say').success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && bun test src/domain/requirement-form/components/field-renderer.spec.ts`
Expected: FAIL — "rejects free text" passes `Weiblich` today because a `SINGLE_CHOICE` field with no options falls through to plain-string validation.

- [ ] **Step 3: Write the implementation — buildFieldSchema**

In `apps/frontend/src/domain/requirement-form/components/field-renderer.tsx`, add the import:

```ts
import { GENDER_OPTION_VALUES } from '../gender-options';
```

Replace the `SINGLE_CHOICE` branch (lines 185-196):

```ts
  if (type === FieldType.SingleChoice) {
    const vals = (options ?? []).map((o) => o.value);
    if (vals.length > 0) {
      const e = z.enum(vals as [string, ...string[]], {
        message: messages.fieldRequired(label),
      });
      return isRequired ? e : z.preprocess(emptyAsUndefined, e.optional());
    }
    return isRequired
      ? z.string().min(1, messages.fieldRequired(label))
      : z.string().optional();
  }
```

with:

```ts
  if (type === FieldType.SingleChoice) {
    if (systemKey === 'gender') {
      const e = z.enum(GENDER_OPTION_VALUES, {
        message: messages.fieldRequired(label),
      });
      return isRequired ? e : z.preprocess(emptyAsUndefined, e.optional());
    }
    const vals = (options ?? []).map((o) => o.value);
    if (vals.length > 0) {
      const e = z.enum(vals as [string, ...string[]], {
        message: messages.fieldRequired(label),
      });
      return isRequired ? e : z.preprocess(emptyAsUndefined, e.optional());
    }
    return isRequired
      ? z.string().min(1, messages.fieldRequired(label))
      : z.string().optional();
  }
```

- [ ] **Step 4: Write the implementation — FieldRenderer**

In the same file, inside `FieldRenderer` (starts ~line 298), add after the existing `const t = useTranslations('RequirementForm.volunteerForm');`:

```ts
  const tGender = useTranslations('RequirementForm.genderOptions');
```

In the `SINGLE_CHOICE` render branch (starts ~line 400), replace the options source. Before the `return (` insert:

```ts
    const opts =
      field.systemKey === 'gender'
        ? GENDER_OPTION_VALUES.map((v) => ({ value: v, label: tGender(v) }))
        : (field.options ?? []);
```

and replace inside the JSX:

```tsx
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
```

with:

```tsx
            {opts.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/frontend && bun test src/domain/requirement-form/components/field-renderer.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/domain/requirement-form/components/field-renderer.tsx apps/frontend/src/domain/requirement-form/components/field-renderer.spec.ts
git commit -m "feat(frontend): render gender as select with fixed localized options"
```

---

### Task 4: Localized gender display (submission review + profile page)

**Files:**
- Modify: `apps/frontend/src/domain/requirement-form/lib/resolve-field-answer.ts`
- Modify: `apps/frontend/src/domain/requirement-form/components/submission-view.tsx`
- Modify: `apps/frontend/src/domain/user/components/personal-information-section.tsx`
- Test: `apps/frontend/src/domain/requirement-form/lib/resolve-field-answer.spec.ts`

**Interfaces:**
- Consumes: `GENDER_OPTION_VALUES` and `isGenderOptionValue` from `../gender-options` (Task 1); `RequirementForm.genderOptions` messages (Task 1).
- Produces: `resolveFieldAnswer` gains a required `genderLabels: Record<string, string>` entry in `ResolveFieldAnswerOptions`; every caller must pass it.

- [ ] **Step 1: Write the failing test**

In `apps/frontend/src/domain/requirement-form/lib/resolve-field-answer.spec.ts`, extend the shared `opts` object (line 14-18):

```ts
const opts = {
  dash: '—',
  accepted: 'Accepted',
  formatDate: (d: Date) => `FMT:${d.toISOString().slice(0, 10)}`,
  genderLabels: {
    female: 'Female',
    male: 'Male',
    diverse: 'Diverse',
    other: 'Other',
    'prefer-not-to-say': 'Prefer not to say',
  },
};
```

Append two tests:

```ts
  it('maps gender system values to localized labels', () => {
    const result = resolveFieldAnswer(
      field({ type: 'SINGLE_CHOICE', systemKey: 'gender' }),
      [{ fieldId: 'f1', value: 'female' }],
      {},
      opts,
    );
    expect(result).toBe('Female');
  });

  it('passes unknown gender values through unchanged', () => {
    const result = resolveFieldAnswer(
      field({ type: 'SINGLE_CHOICE', systemKey: 'gender' }),
      [{ fieldId: 'f1', value: 'legacy-free-text' }],
      {},
      opts,
    );
    expect(result).toBe('legacy-free-text');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && bun test src/domain/requirement-form/lib/resolve-field-answer.spec.ts`
Expected: FAIL — the new tests return the raw value (`female`) instead of the label, and the type change flags `opts` in every existing test once type-checked.

- [ ] **Step 3: Write the implementation — resolveFieldAnswer**

In `apps/frontend/src/domain/requirement-form/lib/resolve-field-answer.ts`, extend the options type (lines 13-17):

```ts
export type ResolveFieldAnswerOptions = {
  dash: string;
  accepted: string;
  formatDate: (date: Date) => string;
  genderLabels: Record<string, string>;
};
```

Add the gender branch directly after `if (!raw) { return dash; }` (line 30-32):

```ts
  if (field.systemKey === 'gender') {
    return genderLabels[raw] ?? raw;
  }
```

- [ ] **Step 4: Write the implementation — submission-view**

In `apps/frontend/src/domain/requirement-form/components/submission-view.tsx`, add after the existing `const t = await getTranslations('RequirementForm.submission');`:

```ts
  const tGender = await getTranslations('RequirementForm.genderOptions');
```

and the import at the top:

```ts
import { GENDER_OPTION_VALUES } from '../gender-options';
```

Extend the `resolveFieldAnswer` call (line 56-60):

```tsx
                  {resolveFieldAnswer(field, submissionValues, profileData, {
                    dash: tCommon('dash'),
                    accepted: t('accepted'),
                    formatDate,
                    genderLabels: Object.fromEntries(
                      GENDER_OPTION_VALUES.map((v) => [v, tGender(v)]),
                    ),
                  })}
```

- [ ] **Step 5: Write the implementation — profile page**

In `apps/frontend/src/domain/user/components/personal-information-section.tsx`, add the import:

```ts
import { isGenderOptionValue } from '@/domain/requirement-form/gender-options';
```

Add after `const tSubtitles = ...`:

```ts
  const tGender = await getTranslations('RequirementForm.genderOptions');
```

and before the `fields` map (after `subtitleByKey`, line 45):

```ts
  const genderLabel = (value: string | null): string | null =>
    value && isGenderOptionValue(value) ? tGender(value) : value;
```

In the `fields` map, add a branch (insert between the `birth-date` branch and the final `else`):

```ts
    } else if (field.key === 'gender') {
      value = genderLabel(str(field.key));
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/frontend && bun test src/domain/requirement-form/lib/resolve-field-answer.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/domain/requirement-form/lib/resolve-field-answer.ts apps/frontend/src/domain/requirement-form/lib/resolve-field-answer.spec.ts apps/frontend/src/domain/requirement-form/components/submission-view.tsx apps/frontend/src/domain/user/components/personal-information-section.tsx
git commit -m "feat(frontend): show localized gender labels in review and profile"
```

---

### Task 5: Form builder — preset, required toggle, locked options

**Files:**
- Modify: `apps/frontend/src/domain/requirement-form/system-profile-fields.ts:24`
- Test: `apps/frontend/src/domain/requirement-form/system-profile-fields.spec.ts`
- Modify: `apps/frontend/src/domain/requirement-form/components/block-form.tsx` (FieldCard call ~line 328-351, props ~line 470-508, required Switch ~line 545-551, showOptions ~line 513-514)
- Modify: `apps/frontend/src/domain/requirement-form/components/field-form.tsx:246-250`

**Interfaces:**
- Consumes: `FieldType.SingleChoice` preset behavior defined here.
- Produces: no new exports. `BlockForm` gender fields are appended with `type: SINGLE_CHOICE`, empty options, `lockType: true`; admins can toggle their `required`; the options editor is hidden for them.

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/domain/requirement-form/system-profile-fields.spec.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { FieldType } from '@repo/data';
import { SYSTEM_PROFILE_FIELDS } from './system-profile-fields';

describe('SYSTEM_PROFILE_FIELDS', () => {
  it('defines gender as an optional single-choice system field', () => {
    const gender = SYSTEM_PROFILE_FIELDS.find((f) => f.key === 'gender');
    expect(gender?.type).toBe(FieldType.SingleChoice);
    expect(gender?.required).toBe(false);
    expect(gender?.labelKey).toBe('gender');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && bun test src/domain/requirement-form/system-profile-fields.spec.ts`
Expected: FAIL — gender's type is currently `FieldType.Text`.

- [ ] **Step 3: Write the implementation — preset**

In `apps/frontend/src/domain/requirement-form/system-profile-fields.ts` line 24, replace:

```ts
  { key: 'gender', labelKey: 'gender', type: FieldType.Text, required: false },
```

with:

```ts
  {
    key: 'gender',
    labelKey: 'gender',
    type: FieldType.SingleChoice,
    required: false,
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/frontend && bun test src/domain/requirement-form/system-profile-fields.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the implementation — block-form**

In `apps/frontend/src/domain/requirement-form/components/block-form.tsx`:

1. In the `FieldCard` usage (the `fields.map` block, ~line 328-351), add the prop:

```tsx
            systemKey={watchedFields[index]?.systemKey}
```

(pass it right after `isSystemField={!!watchedFields[index]?.systemKey}`.)

2. In the `FieldCard` function signature (~line 470-508), add `systemKey` to the destructured props and to the type:

```ts
  isSystemField,
  systemKey,
  lockType,
```

and in the props type:

```ts
  isSystemField: boolean;
  systemKey?: string;
  lockType: boolean;
```

3. Replace `showOptions` (lines 513-514):

```ts
  const showOptions =
    fieldType === FieldType.SingleChoice || fieldType === FieldType.MultiChoice;
```

with:

```ts
  const hasFixedOptions = systemKey === 'gender';
  const showOptions =
    (fieldType === FieldType.SingleChoice ||
      fieldType === FieldType.MultiChoice) &&
    !hasFixedOptions;
```

4. Replace the required Switch `disabled` prop (line 550):

```tsx
                disabled={isSystemField}
```

with:

```tsx
                disabled={isSystemField && systemKey !== 'gender'}
```

- [ ] **Step 6: Write the implementation — field-form binding hint**

In `apps/frontend/src/domain/requirement-form/components/field-form.tsx`, replace the auto-system-key hint (lines 246-250):

```tsx
          {autoSystemKey && (
            <p className="text-muted-foreground text-xs">
              {t('profileField', { key: autoSystemKey })}
            </p>
          )}
```

with:

```tsx
          {(autoSystemKey || (isLocked && manualSystemKey && !showSystemKeyPicker)) && (
            <p className="text-muted-foreground text-xs">
              {t('profileField', { key: autoSystemKey || manualSystemKey })}
            </p>
          )}
```

This keeps an existing gender binding visible (read-only) in the per-field editor, where the system-key picker no longer appears because gender is no longer a text-like type.

- [ ] **Step 7: Type-check the frontend**

Run: `cd apps/frontend && bun run check-types`
Expected: PASS, no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/domain/requirement-form/system-profile-fields.ts apps/frontend/src/domain/requirement-form/system-profile-fields.spec.ts apps/frontend/src/domain/requirement-form/components/block-form.tsx apps/frontend/src/domain/requirement-form/components/field-form.tsx
git commit -m "feat(frontend): gender preset as dropdown, required toggle, locked options"
```

---

### Task 6: Migrations — field type conversion + user data backfill

**Files:**
- Create: `apps/backend/src/database/migrations/<timestamp>_gender_field_single_choice/migration.sql`
- Create: `apps/backend/src/database/migrations/<timestamp>_gender_values_backfill/migration.sql`

**Interfaces:**
- Produces: no code interfaces. DB effect: `form_block_fields.type = 'SINGLE_CHOICE'` for `system_key = 'gender'`; every non-empty `user_profiles.data.gender` becomes one of the five option values.

- [ ] **Step 1: Scaffold the first custom migration**

Run: `cd apps/backend && bun run db:generate --custom --name gender_field_single_choice`
(If bun does not forward the flags, use `bunx drizzle-kit generate --custom --name gender_field_single_choice`.)
Expected: a new folder `src/database/migrations/<timestamp>_gender_field_single_choice/` containing an empty `migration.sql` and a `snapshot.json`.

- [ ] **Step 2: Write the field-type migration**

Replace the contents of `src/database/migrations/<timestamp>_gender_field_single_choice/migration.sql` with:

```sql
-- Gender becomes a select field. Rows bound to the gender system key are
-- single-choice fields whose fixed options are supplied in code (localised
-- DE/EN), not stored on the row, so their options stay empty. Stored
-- answers are untouched here; the user_profiles backfill is the next
-- migration. 'SINGLE_CHOICE' is the exact string the API stores.
UPDATE "form_block_fields" SET "type" = 'SINGLE_CHOICE' WHERE "system_key" = 'gender';
```

- [ ] **Step 3: Scaffold and write the backfill migration**

Run: `cd apps/backend && bun run db:generate --custom --name gender_values_backfill`

Replace the contents of `src/database/migrations/<timestamp>_gender_values_backfill/migration.sql` with:

```sql
-- Map legacy free-text gender answers onto the fixed option values.
-- Recognised spellings map to their option; "no answer" spellings map to
-- prefer-not-to-say; empty values are skipped by the WHERE clause;
-- anything unrecognised becomes 'other' so nothing is nulled and nobody
-- is excluded.
UPDATE "user_profiles" AS "up"
SET "data" = jsonb_set("up"."data", '{gender}', to_jsonb("m"."gender_value"::text))
FROM (
  SELECT
    "id",
    CASE
      WHEN lower(trim("data" ->> 'gender')) IN ('weiblich', 'w', 'f', 'female', 'frau', 'woman') THEN 'female'
      WHEN lower(trim("data" ->> 'gender')) IN ('männlich', 'm', 'male', 'mann', 'man') THEN 'male'
      WHEN lower(trim("data" ->> 'gender')) IN ('divers', 'diverse', 'inter', 'intergeschlechtlich', 'non-binary', 'nonbinary', 'genderqueer') THEN 'diverse'
      WHEN lower(trim("data" ->> 'gender')) IN ('keine angabe', 'no answer', 'prefer not to say', 'n/a', '-') THEN 'prefer-not-to-say'
      ELSE 'other'
    END AS "gender_value"
  FROM "user_profiles"
  WHERE NULLIF(trim("data" ->> 'gender'), '') IS NOT NULL
) AS "m"
WHERE "up"."id" = "m"."id";
```

- [ ] **Step 4: Migration safety review**

Dispatch a reviewer subagent with both `migration.sql` files, the spec section "Data migrations", and these checks: no NULLing of data, the WHERE clause skips empty/missing values, the CASE lists cover the spec's mapping table, the type string matches what the API stores (`SINGLE_CHOICE`), and both statements are idempotent (re-running gives the same result). Fix anything it flags.

- [ ] **Step 5: Apply and verify locally**

Run: `bun run db:up` (if Postgres is not running), then `cd apps/backend && bun run db:migrate`.
Expected: both migrations apply without errors.

Deploy note (from the spec): ship the application code first, then run the migrations. After the backfill, every stored gender value is a valid option, so the strict enum validation in Task 2 never blocks an unrelated profile save.

Verify the mapping on representative values (dev database may have no gender data, so exercise the CASE directly):

```sql
SELECT v AS input,
  CASE
    WHEN lower(trim(v)) IN ('weiblich', 'w', 'f', 'female', 'frau', 'woman') THEN 'female'
    WHEN lower(trim(v)) IN ('männlich', 'm', 'male', 'mann', 'man') THEN 'male'
    WHEN lower(trim(v)) IN ('divers', 'diverse', 'inter', 'intergeschlechtlich', 'non-binary', 'nonbinary', 'genderqueer') THEN 'diverse'
    WHEN lower(trim(v)) IN ('keine angabe', 'no answer', 'prefer not to say', 'n/a', '-') THEN 'prefer-not-to-say'
    ELSE 'other'
  END AS mapped
FROM (VALUES ('Weiblich'), ('F'), ('M'), ('non-binary'), ('keine Angabe'), ('N/A'), ('whatever'), ('')) AS t(v);
```

Expected: `Weiblich→female`, `F→female`, `M→male`, `non-binary→diverse`, `keine Angabe→prefer-not-to-say`, `N/A→prefer-not-to-say`, `whatever→other`, empty→(skipped by the real WHERE clause).

Also confirm the real backfill: `SELECT count(*) FROM user_profiles WHERE data ->> 'gender' IS NOT NULL;` returns 0 rows with values outside the five options:

```sql
SELECT data ->> 'gender' AS g, count(*) FROM user_profiles
WHERE data ? 'gender' GROUP BY 1;
```

Every non-empty value must be one of the five options.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/database/migrations/
git commit -m "feat(backend): migrate gender fields to single-choice and backfill values"
```

---

### Task 7: Backend integration test — gender submission flow

**Files:**
- Modify: `apps/backend/test/form-submission.service.spec.ts`

**Interfaces:**
- Consumes: backend `GENDER_OPTION_VALUES` rule from Task 2 (through `validateSystemKeyValue`).
- Produces: no new exports — regression coverage for the submission → `user_profiles.data` path.

- [ ] **Step 1: Write the failing test**

Append to `apps/backend/test/form-submission.service.spec.ts` (inside the top-level describe, after the `submit by share token` describe). Add `import { eq } from 'drizzle-orm';` to the imports at the top (the file already imports `* as schema` and `RequiredFormTargetType`).

```ts
  describe('gender system field', () => {
    const setupGenderForm = async (required: boolean) => {
      const { admin, rootUnit, unitA, volunteer } = await setupOrgWithUnits();
      const { form, block } = await createRequirementForm(db, {
        organizationId: rootUnit.organizationId,
        organizationUnitId: rootUnit.id,
        createdById: admin.id,
        required,
      });
      await setRequiredForms(db, {
        organizationUnitId: unitA.id,
        formIds: [form.id],
      });
      // The factory block ships a generic required text field; neutralise
      // it so only the gender field is enforced.
      await db
        .update(schema.formBlockFields)
        .set({ required: false })
        .where(eq(schema.formBlockFields.blockId, block.id));
      const [genderField] = await db
        .insert(schema.formBlockFields)
        .values({
          blockId: block.id,
          type: 'SINGLE_CHOICE',
          label: 'Gender',
          required,
          systemKey: 'gender',
          options: [],
          fieldOrder: 1,
        })
        .returning();
      if (!genderField) throw new Error('Failed to create gender field');
      return { form, unitA, volunteer, genderField };
    };

    const submit = (
      formId: string,
      unitId: string,
      userId: string,
      values: { fieldId: string; value: string }[],
    ) =>
      formSubmissionService.submitRequiredForm(
        {
          targetType: RequiredFormTargetType.ORGANIZATION_UNIT,
          targetId: unitId,
        },
        formId,
        { values },
        userId,
      );

    it('accepts a fixed option value and writes it to the user profile', async () => {
      const { form, unitA, volunteer, genderField } =
        await setupGenderForm(false);
      await submit(form.id, unitA.id, volunteer.id, [
        { fieldId: genderField.id, value: 'female' },
      ]);
      const profile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, volunteer.id),
      });
      expect(profile?.data.gender).toBe('female');
    });

    it('rejects a value outside the fixed list', async () => {
      const { form, unitA, volunteer, genderField } =
        await setupGenderForm(false);
      await expect(
        submit(form.id, unitA.id, volunteer.id, [
          { fieldId: genderField.id, value: 'Weiblich' },
        ]),
      ).rejects.toThrow('must be one of the available options');
    });

    it('enforces a required gender but accepts prefer-not-to-say', async () => {
      const { form, unitA, volunteer, genderField } =
        await setupGenderForm(true);
      await expect(
        submit(form.id, unitA.id, volunteer.id, []),
      ).rejects.toThrow('is required');
      await submit(form.id, unitA.id, volunteer.id, [
        { fieldId: genderField.id, value: 'prefer-not-to-say' },
      ]);
      const profile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, volunteer.id),
      });
      expect(profile?.data.gender).toBe('prefer-not-to-say');
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run db:up` (if needed), then `cd apps/backend && bun test test/form-submission.service.spec.ts`
Expected: FAIL — "rejects a value outside the fixed list" currently passes `Weiblich` because the old rule only capped length.

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd apps/backend && bun test test/form-submission.service.spec.ts`
Expected: PASS (the Task 2 rule is already in place; this test locks the behavior in).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/test/form-submission.service.spec.ts
git commit -m "test(backend): gender submission accepts options, rejects free text"
```

---

### Task 8: Docs + full verification

**Files:**
- Modify: `apps/backend/AGENTS.md` (Known constraints section, after the last bullet ~line 221)

**Interfaces:**
- Consumes: everything — this is the verification gate.

- [ ] **Step 1: Add the decision-log entry**

Append to the "Known constraints (decision-log extracts — architectural, must stay)" section of `apps/backend/AGENTS.md`:

```markdown
- **Gender is a fixed single-choice system field.** Five option values (`female`/`male`/`diverse`/`other`/`prefer-not-to-say`) are defined in code and mirrored frontend (`src/domain/requirement-form/gender-options.ts`) and backend (`GENDER_OPTION_VALUES` in `src/requirement-profile/constants.ts`); labels are localised client-side from `RequirementForm.genderOptions`. Gender field rows carry empty DB options — rendering and validation inject the fixed list by `systemKey`. (VOLI-1267)
```

- [ ] **Step 2: Run the full verification**

```bash
bun run lint
bun run check-types
cd apps/backend && bun test src && bun test test/
cd apps/frontend && bun test src
```

Expected: all green. (The backend integration suite needs Postgres; `bun run db:up` first if it is not running.)

- [ ] **Step 3: Commit**

```bash
git add apps/backend/AGENTS.md
git commit -m "docs: record gender fixed-option decision in backend AGENTS.md"
```
