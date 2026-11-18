ALTER TABLE "reimbursement_bundle_deliveries" ADD COLUMN "email_status" "email_delivery_status";--> statement-breakpoint
UPDATE "reimbursement_bundle_deliveries" AS "d"
SET "email_status" = CASE
  WHEN "e"."status" = 'SENDING' THEN 'PENDING'::"email_delivery_status"
  ELSE "e"."status"
END
FROM "email_outbox" AS "e"
WHERE "d"."email_outbox_id" = "e"."id" AND "d"."method" = 'EMAIL';--> statement-breakpoint
-- The outbox only purged delivered bundle emails, so a missing row was sent.
UPDATE "reimbursement_bundle_deliveries"
SET "email_status" = 'SENT'
WHERE "method" = 'EMAIL' AND "email_status" IS NULL;
