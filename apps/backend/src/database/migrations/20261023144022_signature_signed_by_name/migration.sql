ALTER TABLE "contract_signatures" ADD COLUMN "signed_by_name" text;--> statement-breakpoint
ALTER TABLE "invoice_signatures" ADD COLUMN "signed_by_name" text;--> statement-breakpoint

-- Backfill with the current name: the name at signing was never recorded.
UPDATE "contract_signatures" cs
SET "signed_by_name" = u."name"
FROM "users" u
WHERE cs."signed_by_user_id" = u."id"
  AND cs."signed_at" IS NOT NULL
  AND cs."signed_by_name" IS NULL;
--> statement-breakpoint
UPDATE "invoice_signatures" s
SET "signed_by_name" = u."name"
FROM "users" u
WHERE s."signed_by_user_id" = u."id"
  AND s."signed_at" IS NOT NULL
  AND s."signed_by_name" IS NULL;
