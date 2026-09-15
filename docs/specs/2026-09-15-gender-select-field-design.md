# Gender system field: select list of options

Date: 2026-09-15
Ticket: VOLI-1267
Status: Approved design, pending implementation plan

## Problem

The gender system profile field is a free-text answer. Organisations use gender for statutory and funder reporting, so free text produces unnormalised answers that are painful to aggregate and clean. Once volunteers have answered, the data problem is permanent.

## Goal

Make gender a select field with a fixed set of options, localised in German and English, so reporting data is analysable and no volunteer is excluded.

## Decisions

| Question | Decision |
|---|---|
| Option list | `female`, `male`, `diverse`, `other`, `prefer-not-to-say` |
| "Other" | A plain option, with no free-text companion |
| Prefer not to say | An explicit option (and the field can also stay optional) |
| List control | Fixed system-wide; admins cannot edit the options |
| Requiredness | Admins can mark gender required on their requirement forms |
| Existing free-text data | Best-effort mapping to options; anything unrecognised becomes `other` |
| Implementation | Reuse `FieldType.SINGLE_CHOICE`; inject fixed options for the gender system key |

## Option catalog

New module `apps/frontend/src/domain/requirement-form/gender-options.ts`:

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

Labels live in both message catalogs under a new `RequirementForm.genderOptions` namespace. The stored value doubles as the message key:

| Value | en | de |
|---|---|---|
| `female` | Female | Weiblich |
| `male` | Male | Männlich |
| `diverse` | Diverse | Divers |
| `other` | Other | Andere |
| `prefer-not-to-say` | Prefer not to say | Keine Angabe |

The stored value is always the stable key; only the label is localised. A `useGenderOptions()` hook (client components) and a server-side equivalent built on `getTranslations()` convert the constant plus catalog into render-ready `{value, label}` pairs.

## Backend validation

`apps/backend/src/requirement-profile/constants.ts` gains the same five values in a `GENDER_OPTION_VALUES` constant. This mirrors the frontend list, following the codebase's existing convention of mirrored validators (a value accepted client-side is accepted by the backend, and vice versa).

In `apps/backend/src/requirement-profile/profile-validation.ts`, the gender case of `validateSystemKeyValue` changes from a 50-character maximum to a membership check against `GENDER_OPTION_VALUES`. An empty value still means "no answer" and stays valid: profile fields can be left blank and are only enforced where they are actually needed.

In `apps/backend/src/requirement-profile/services/form-submission.service.ts`, the `SINGLE_CHOICE` branch of `validateFieldValue` validates against the field's stored options. For `systemKey === 'gender'` it validates against the fixed list instead, because gender field rows carry no DB options.

## Frontend rendering

`FieldRenderer`'s `SINGLE_CHOICE` branch (`apps/frontend/src/domain/requirement-form/components/field-renderer.tsx`) is the single render point to change: when `field.systemKey === 'gender'`, it renders the localized fixed options instead of `field.options`. This covers every surface that renders through `FieldRenderer`:

- the volunteer profile edit form (`edit-identity-form.tsx`),
- volunteer-facing required forms,
- public share forms,
- the form builder preview.

Two display-only spots need a value-to-label mapping added:

- the volunteer profile page (`personal-information-section.tsx`, server-side via `getTranslations`),
- admin submission review (`resolve-field-answer.ts`, which today returns system-field values raw).

`buildFieldSchema` in the same file mirrors the backend: its `SINGLE_CHOICE` branch uses `z.enum(GENDER_OPTION_VALUES)` for gender, and the old free-text gender rule (50-character maximum) is deleted. Empty stays valid for optional fields; a required gender forces one of the five options.

## Form builder

Three changes:

- The gender preset in `apps/frontend/src/domain/requirement-form/system-profile-fields.ts` becomes `type: FieldType.SingleChoice` (still `required: false` by default, still `lockType`, so the type stays read-only).
- The options editor in `block-form.tsx` is hidden for gender: admins cannot add or remove options. Description and help text stay editable.
- The required switch in `block-form.tsx` is enabled for gender only; other system fields keep their preset locked behavior. A required gender is safe because "Prefer not to say" is always available.

Verification item: `field-form.tsx` offers the system-key picker only for text-like types. After the type change, confirm an existing gender binding still displays correctly there (read-only), and adjust the visibility condition if needed.

## Data migrations

Two SQL migrations, following the drizzle expand-and-contract practice:

1. `form_block_fields`: set `type = 'SINGLE_CHOICE'` where `system_key = 'gender'`. Existing gender fields in live forms become select fields.
2. `user_profiles.data.gender` backfill. Compare `lower(trim(value))` against known lists:

   | Target | Recognised legacy values |
   |---|---|
   | `female` | weiblich, w, f, female, frau, woman |
   | `male` | männlich, m, male, mann, man |
   | `diverse` | divers, diverse, inter, intergeschlechtlich, non-binary, nonbinary, genderqueer |
   | `prefer-not-to-say` | keine angabe, no answer, prefer not to say, n/a, - |
   | (unchanged) | empty or missing value |
   | `other` | anything else |

   Nothing is nulled and nobody is excluded: every value lands on a valid option or stays empty.

Deploy order: ship the code first, then run `bun run db:migrate`. After the backfill, every stored gender value is a valid option, so the strict enum validation never blocks an unrelated profile save.

## Error handling

An invalid gender value submitted to the API returns `BadRequestGraphQLError` with the field label, matching the existing system-field validation messages. The select UI prevents invalid input; the server validates anyway.

## Testing

- Backend unit (`profile-validation.spec.ts`): all five values accepted, unknown value rejected, empty accepted.
- Backend integration: form submission accepts a valid gender option, rejects an invalid one, enforces requiredness, and writes the value into `user_profiles.data`.
- Frontend unit (`field-renderer.spec.ts`): gender schema accepts option values and rejects free text; label-mapping helpers for the profile page and submission review.
- Migration: run both migrations against the dev database seeded with representative legacy values (`Weiblich`, `F`, `non-binary`, junk) and verify the mapping — nothing nulled, junk lands on `other`.

## Rollout and docs

No feature flag. Code ships, then migrations run on deploy. Add a one-line entry to the backend `AGENTS.md` decision log noting that gender is a fixed single-choice system field with value lists mirrored frontend and backend, under the same convention as the existing mirrored validators.

## Out of scope

- Admin-configurable gender options per organisation.
- A free-text "self-describe" companion for the `other` option.
- Changing requiredness behavior of system fields other than gender.
- CSV or data export of gender answers.
