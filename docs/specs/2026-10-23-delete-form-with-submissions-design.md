# Delete requirement forms that have submissions

Date: 2026-10-23  
Status: Approved design, pending implementation plan

## Problem

Org admins cannot delete a requirement form once anyone has submitted it. Forms created while learning the product (e.g. code of conduct, personal data) stay forever next to real ones. Editing forms with submissions stays deferred; deletion is the smaller, shippable fix. Guidance to “create a new form instead” produces near-duplicates and clutters pickers at volunteer scale.

## Goal

An organisation admin can delete a form even when it has submissions. Before delete they see impact (submission count, attachments). Answers are hard-deleted (GDPR-defensible). Attachments on org units / events / shifts / shift instances are warned about and detached. Profile-stored latest field values are **not** wiped by form delete.

## Decisions

| Question | Decision |
|---|---|
| Org-unit required forms | Same as shifts/events: warn, then detach |
| Profile values on form delete | Do **not** wipe; only wipe when the `FormBlockField` is deleted |
| Profile storage | New table independent of submissions; copy latest submitted value there |
| Confirmation | Informative warning + acknowledgement checkbox before confirm enabled |
| Approach | Hard delete + `requirementFormDeleteImpact` query + profile field-values table |
| Submission FK | Keep `form_submissions.form_id` `onDelete: 'restrict'`; service must delete submissions explicitly before the form |
| Editing / versioning | Out of scope |

## Data model

### New table: `organization_user_profile_field_values`

Domain / GraphQL name: `OrganizationUserProfileFieldValue`.

| Column | Notes |
|---|---|
| `id` | Standard id |
| `organization_user_profile_id` | FK → `organization_user_profiles`, `onDelete: cascade` |
| `field_id` | FK → `form_block_fields`, `onDelete: cascade` (sole wipe path for profile field values) |
| `value` | `jsonb`, same shape as `form_submission_values.value` |
| timestamps | As elsewhere |

Unique on `(organization_user_profile_id, field_id)`.

### Migration

1. Create `organization_user_profile_field_values`.
2. Backfill from `form_submission_values` where `organization_user_profile_id IS NOT NULL`. For duplicate `(profile, field)` rows, keep the latest by `updated_at`.
3. Drop the partial unique index and column `organization_user_profile_id` from `form_submission_values` (expand → backfill → contract in the same release as the submit-path rewrite).

### Unchanged

- `form_submissions` / `form_submission_values` remain the form-scoped answer record.
- System keys (`gender`, etc.) continue to write via the existing user profile path — not this table.
- Shared form blocks/fields are not deleted when a form is deleted.

## Delete behavior & API

### `deleteRequirementForm(id)`

Same mutation, new semantics. Single transaction:

1. Auth / org checks as today (`REQUIREMENT_PROFILE_EDIT`, unit in org).
2. Detach all required-form links for this form across **organization units, events, shifts, and shift instances**.
3. **Explicitly delete** all `form_submissions` for this form (DB cascade removes `form_submission_values`).
4. Delete the `requirement_forms` row (block refs already cascade).

Do **not** touch `organization_user_profile_field_values`.

Keep `form_submissions.form_id` → `onDelete: 'restrict'`. If step 3 is skipped or fails, step 4 must fail at the DB. No cascade-from-form delete of submissions.

Remove app-level guards that currently reject delete when the form has submissions or is required by any target.

### `requirementFormDeleteImpact(id)` (new query)

For the confirm dialog. Same permission as delete.

Returns:

- `submissionCount`
- `attachments[]`: `{ targetType, targetId, name }` for every org unit / event / shift / shift instance that currently requires the form

### Field delete

When a `FormBlockField` is deleted, matching profile field values are removed via `field_id` FK cascade. No other code path deletes them.

## Submit path

In `form-submission.service`:

- Continue writing `form_submissions` + `form_submission_values` (no profile FK on values).
- After a successful submit, **upsert** `organization_user_profile_field_values` for each custom field (latest value wins on `(profileId, fieldId)`).
- Remove disconnect/relink logic that used `form_submission_values.organizationUserProfileId`.
- `myStoredFormFieldValues` reads from the new table.
- System keys unchanged.

## Admin UI

- Remove the lock when `submissionCount > 0` (forms table and form card).
- Delete opens a richer confirm dialog:
  - Form name
  - Submission count and explicit copy that **answers will be permanently deleted**
  - Attachment list from `requirementFormDeleteImpact` with copy that they will be **detached**, not deleted
  - Checkbox acknowledging permanent deletion of answers — confirm disabled until checked
- Zero submissions / zero attachments: same flow (quieter copy); checkbox still required.
- On success: form disappears from the form list and from required-form pickers.

i18n: new strings under `RequirementForm` (en + de).

## Errors & edge cases

| Case | Behavior |
|---|---|
| Form not found / wrong org | Existing not-found / auth errors |
| Submissions still present at form delete (bug/race) | `restrict` FK fails; surface as conflict/failure — no silent partial delete |
| Impact query on missing form | Not found |
| Confirm without checkbox | UI only; API does not require a confirm token |
| Concurrent submit during delete | Transaction + `restrict`; one side errors; no intentional half-state |
| Migration duplicates `(profile, field)` | Keep latest by `updated_at` |

## Testing

- Migration: linked values land in the new table; column removed; latest-wins.
- Submit: writes submission values + upserts profile field values; prefill reads new table.
- Delete: detaches all target types; deletes submissions then form; profile field values remain; form absent from list/pickers.
- Leftover submissions block form delete at the DB if the service skips submission delete.
- Field delete removes profile field values for that field.
- UI: lock gone; confirm disabled until acknowledgement; impact counts/attachments shown.

## Out of scope

- Editing a form that has submissions
- Form versioning
- Soft-delete of forms
