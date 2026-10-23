# Delete form with submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can delete requirement forms that have submissions; answers are hard-deleted; attachments detach; profile latest values live in a new independent table.

**Architecture:** Split profile field values out of `form_submission_values` into `organization_user_profile_field_values`. Expand `deleteRequirementForm` to detach required-form links, delete submissions, then delete the form (`restrict` FK kept). Add `requirementFormDeleteImpact` for the confirm dialog. Admin UI unlocks delete with acknowledgement checkbox.

**Tech Stack:** NestJS + Drizzle + GraphQL, `@repo/data`, Next.js admin UI

**Spec:** `docs/specs/2026-10-23-delete-form-with-submissions-design.md`

## Global Constraints

- Keep `form_submissions.form_id` `onDelete: 'restrict'`; delete submissions explicitly in the service before the form.
- Do not wipe profile field values on form delete; only on `FormBlockField` delete (FK cascade).
- Hard-delete answers (`form_submissions` + `form_submission_values`).
- Detach org units, events, shifts, shift instances (never block delete for attachments).

---

### Task 1: Schema + migration for profile field values

**Files:**
- Create: `apps/backend/src/requirement-profile/schemas/organization-user-profile-field-value.schema.ts`
- Modify: `form-submission-value.schema.ts` (drop `organizationUserProfileId`)
- Modify: `requirement-profiles.relations.ts`, `database/schema` exports
- Generate migration + custom backfill SQL

- [x] Add schema table unique on `(organizationUserProfileId, fieldId)`
- [x] Remove profile FK from `form_submission_values`
- [x] `bun run db:generate` then edit migration to backfill latest values before dropping column
- [x] `bun run db:migrate`

### Task 2: Submit path + prefill

**Files:**
- Modify: `form-submission.service.ts`
- Tests: unit and/or integration covering upsert + prefill

- [x] Upsert profile field values on submit; stop writing `organizationUserProfileId` on submission values
- [x] `findStoredFieldValues` reads new table
- [x] Tests green

### Task 3: Delete + impact query

**Files:**
- Modify: `requirement-form.service.ts` (delete)
- Modify: `required-form.service.ts` (detach all + list attachments for impact)
- Add impact model + query resolver
- GraphQL in `packages/data` + codegen
- Integration tests for delete with submissions / attachments

- [x] Delete: detach → delete submissions → delete form
- [x] `requirementFormDeleteImpact`
- [x] Wire `@repo/data` repository + hooks if needed
- [x] Tests green

### Task 4: Admin UI

**Files:**
- Modify: `forms-table.tsx`, `form-card.tsx`, confirm dialog
- Messages en/de

- [x] Remove submission lock
- [x] Impact-aware confirm + acknowledgement checkbox
- [x] Wire delete action

### Task 5: Verify

- [x] Backend unit + relevant integration tests
- [x] `bun run check-types` for touched packages
