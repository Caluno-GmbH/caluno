-- Gender becomes a select field. Rows bound to the gender system key are
-- single-choice fields whose fixed options are supplied in code (localised
-- DE/EN), not stored on the row, so their options stay empty. Stored
-- answers are untouched here; the user_profiles backfill is the next
-- migration. 'SINGLE_CHOICE' is the exact string the API stores.
UPDATE "form_block_fields" SET "type" = 'SINGLE_CHOICE' WHERE "system_key" = 'gender';
