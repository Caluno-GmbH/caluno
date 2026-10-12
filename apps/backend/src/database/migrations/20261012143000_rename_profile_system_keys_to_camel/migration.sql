-- Align requirement-form systemKeys with users column names (camelCase).
-- preferred-name → preferredName, account-holder → accountHolder.
-- Submitted answers are left alone (historical record).
UPDATE "form_block_fields"
SET "system_key" = 'preferredName'
WHERE "system_key" = 'preferred-name';
--> statement-breakpoint
UPDATE "form_block_fields"
SET "system_key" = 'accountHolder'
WHERE "system_key" = 'account-holder';
