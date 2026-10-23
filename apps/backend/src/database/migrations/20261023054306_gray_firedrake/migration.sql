ALTER TABLE "organization_user_profiles" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "organization_user_profiles" DROP COLUMN "user_profile_access_approved";--> statement-breakpoint
DROP TYPE "organization_user_profile_status";