-- FormSubmission per OrgUnit: drop shares, add organization_unit_id,
-- one submission per former share, anchor latest values on OrganizationUserProfile.

-- 1. Drop submissions that were never shared (cascade values).
DELETE FROM "form_submissions" AS fs
WHERE NOT EXISTS (
  SELECT 1 FROM "form_submission_shares" AS s WHERE s."submission_id" = fs."id"
);--> statement-breakpoint

-- 2. Staging: one new submission id per share.
CREATE TABLE "_form_submission_share_migrate" (
  "new_submission_id" uuid PRIMARY KEY,
  "old_submission_id" uuid NOT NULL,
  "organization_unit_id" uuid NOT NULL,
  "form_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "submitted_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint

INSERT INTO "_form_submission_share_migrate" (
  "new_submission_id",
  "old_submission_id",
  "organization_unit_id",
  "form_id",
  "user_id",
  "submitted_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  s."submission_id",
  s."organization_unit_id",
  fs."form_id",
  fs."user_id",
  fs."submitted_at",
  fs."created_at",
  fs."updated_at"
FROM "form_submission_shares" AS s
INNER JOIN "form_submissions" AS fs ON fs."id" = s."submission_id";--> statement-breakpoint

-- 3. Add nullable organization_unit_id, insert per-share copies, drop olds + shares.
ALTER TABLE "form_submissions" ADD COLUMN "organization_unit_id" uuid;--> statement-breakpoint

INSERT INTO "form_submissions" (
  "id",
  "form_id",
  "user_id",
  "organization_unit_id",
  "submitted_at",
  "created_at",
  "updated_at"
)
SELECT
  m."new_submission_id",
  m."form_id",
  m."user_id",
  m."organization_unit_id",
  m."submitted_at",
  m."created_at",
  m."updated_at"
FROM "_form_submission_share_migrate" AS m;--> statement-breakpoint

INSERT INTO "form_submission_values" (
  "id",
  "submission_id",
  "field_id",
  "value",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  m."new_submission_id",
  v."field_id",
  v."value",
  v."created_at",
  v."updated_at"
FROM "_form_submission_share_migrate" AS m
INNER JOIN "form_submission_values" AS v ON v."submission_id" = m."old_submission_id";--> statement-breakpoint

DELETE FROM "form_submissions"
WHERE "id" IN (
  SELECT DISTINCT "old_submission_id" FROM "_form_submission_share_migrate"
);--> statement-breakpoint

DROP TABLE "_form_submission_share_migrate";--> statement-breakpoint

DROP TABLE "form_submission_shares";--> statement-breakpoint

ALTER TABLE "form_submissions" ALTER COLUMN "organization_unit_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "form_submissions" ADD CONSTRAINT "uq_form_submissions_user_form_unit" UNIQUE("user_id","form_id","organization_unit_id");--> statement-breakpoint

CREATE INDEX "idx_form_submissions_organization_unit_id" ON "form_submissions" ("organization_unit_id");--> statement-breakpoint

ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_organization_unit_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;--> statement-breakpoint

-- 4. Profile link column.
ALTER TABLE "form_submission_values" ADD COLUMN "organization_user_profile_id" uuid;--> statement-breakpoint

-- 5. Ensure an OrganizationUserProfile for every user that has submissions.
INSERT INTO "organization_user_profiles" (
  "id",
  "organization_id",
  "user_id",
  "status",
  "user_profile_access_approved",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  pairs."organization_id",
  pairs."user_id",
  'PENDING',
  false,
  now(),
  now()
FROM (
  SELECT DISTINCT fs."user_id", ou."organization_id"
  FROM "form_submissions" AS fs
  INNER JOIN "organization_units" AS ou ON ou."id" = fs."organization_unit_id"
) AS pairs
WHERE NOT EXISTS (
  SELECT 1
  FROM "organization_user_profiles" AS oup
  WHERE oup."user_id" = pairs."user_id"
    AND oup."organization_id" = pairs."organization_id"
);--> statement-breakpoint

-- 6. Connect the latest FormSubmissionValue per (user, org, field) to the profile.
UPDATE "form_submission_values" AS v
SET "organization_user_profile_id" = latest."organization_user_profile_id"
FROM (
  SELECT DISTINCT ON (fs."user_id", ou."organization_id", v."field_id")
    v."id" AS "value_id",
    oup."id" AS "organization_user_profile_id"
  FROM "form_submission_values" AS v
  INNER JOIN "form_submissions" AS fs ON fs."id" = v."submission_id"
  INNER JOIN "organization_units" AS ou ON ou."id" = fs."organization_unit_id"
  INNER JOIN "organization_user_profiles" AS oup
    ON oup."user_id" = fs."user_id"
    AND oup."organization_id" = ou."organization_id"
  ORDER BY fs."user_id", ou."organization_id", v."field_id", v."updated_at" DESC, v."id" DESC
) AS latest
WHERE v."id" = latest."value_id";--> statement-breakpoint

CREATE INDEX "idx_form_submission_values_organization_user_profile_id" ON "form_submission_values" ("organization_user_profile_id");--> statement-breakpoint

CREATE UNIQUE INDEX "uq_form_submission_values_profile_field" ON "form_submission_values" ("organization_user_profile_id","field_id") WHERE "organization_user_profile_id" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "form_submission_values" ADD CONSTRAINT "form_submission_values_organization_user_profile_id_fkey" FOREIGN KEY ("organization_user_profile_id") REFERENCES "organization_user_profiles"("id") ON DELETE SET NULL;
