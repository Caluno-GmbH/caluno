ALTER TABLE "organization_units" DROP CONSTRAINT "organization_units_Wl3widDJ46RJ_fkey";--> statement-breakpoint
ALTER TABLE "requirement_fulfillments" DROP CONSTRAINT "requirement_fulfillments_SSi8x4wpJ4c0_fkey";--> statement-breakpoint
ALTER TABLE "requirement_fulfillments" DROP CONSTRAINT "requirement_fulfillments_requirement_id_requirements_id_fkey";--> statement-breakpoint
ALTER TABLE "requirement_profile_requirements" DROP CONSTRAINT "requirement_profile_requirements_2bdUJ4zBfOtP_fkey";--> statement-breakpoint
ALTER TABLE "requirement_profile_requirements" DROP CONSTRAINT "requirement_profile_requirements_9WTdnZHUUErT_fkey";--> statement-breakpoint
ALTER TABLE "requirement_profile_submissions" DROP CONSTRAINT "requirement_profile_submissions_Exl1MZS3y1B6_fkey";--> statement-breakpoint
DROP TABLE "documents";--> statement-breakpoint
DROP TABLE "requirements";--> statement-breakpoint
DROP TABLE "requirement_fulfillments";--> statement-breakpoint
DROP TABLE "requirement_profiles";--> statement-breakpoint
DROP TABLE "requirement_profile_requirements";--> statement-breakpoint
DROP TABLE "requirement_profile_submissions";--> statement-breakpoint
DROP INDEX "idx_organization_units_required_profile_id";--> statement-breakpoint
ALTER TABLE "organization_units" DROP COLUMN "required_membership_requirement_profile_id";--> statement-breakpoint
DROP TYPE "requirement_type";--> statement-breakpoint
DROP TYPE "requirement_fulfillment_status";--> statement-breakpoint
DROP TYPE "requirement_profile_submission_status";