-- Map legacy free-text gender answers onto the fixed option values.
-- Recognised spellings map to their option; "no answer" spellings map to
-- prefer-not-to-say; empty values are skipped by the WHERE clause;
-- anything unrecognised becomes 'other' so nothing is nulled and nobody
-- is excluded.
UPDATE "user_profiles" AS "up"
SET "data" = jsonb_set("up"."data", '{gender}', to_jsonb("m"."gender_value"::text))
FROM (
  SELECT
    "id",
    CASE
      WHEN lower(trim("data" ->> 'gender')) IN ('weiblich', 'w', 'f', 'female', 'frau', 'woman') THEN 'female'
      WHEN lower(trim("data" ->> 'gender')) IN ('männlich', 'm', 'male', 'mann', 'man') THEN 'male'
      WHEN lower(trim("data" ->> 'gender')) IN ('divers', 'diverse', 'inter', 'intergeschlechtlich', 'non-binary', 'nonbinary', 'genderqueer') THEN 'diverse'
      WHEN lower(trim("data" ->> 'gender')) IN ('keine angabe', 'no answer', 'prefer not to say', 'prefer-not-to-say', 'n/a', '-') THEN 'prefer-not-to-say'
      ELSE 'other'
    END AS "gender_value"
  FROM "user_profiles"
  WHERE NULLIF(trim("data" ->> 'gender'), '') IS NOT NULL
) AS "m"
WHERE "up"."id" = "m"."id";
