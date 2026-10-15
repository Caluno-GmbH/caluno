-- Choice-field options become plain strings (the former label). Answers that
-- stored a distinct option value are remapped to the label first so existing
-- submissions stay valid against the new option list.
--
-- The candidates are de-duplicated per (field, old value): option values were
-- not required to be unique before this change, so two options of one field can
-- share a value while carrying different labels. Without the de-duplication the
-- correlated subquery in the second statement would return more than one row
-- and abort the whole migration. The lowest label wins, so the remap stays
-- deterministic either way.
WITH candidates AS (
  SELECT
    f."id" AS field_id,
    e->>'value' AS old_value,
    e->>'label' AS new_value
  FROM "form_block_fields" f
  CROSS JOIN LATERAL jsonb_array_elements(f."options") AS e
  WHERE f."options" IS NOT NULL
    AND jsonb_typeof(f."options") = 'array'
    AND jsonb_typeof(e) = 'object'
    AND COALESCE(btrim(e->>'value'), '') <> ''
    AND COALESCE(btrim(e->>'label'), '') <> ''
    AND e->>'value' <> e->>'label'
),
maps AS (
  SELECT DISTINCT ON (c.field_id, c.old_value)
    c.field_id,
    c.old_value,
    c.new_value
  FROM candidates c
  ORDER BY c.field_id, c.old_value, c.new_value
)
UPDATE "form_submission_values" v
SET "value" = to_jsonb(m.new_value)
FROM maps m
WHERE v."field_id" = m.field_id
  AND jsonb_typeof(v."value") = 'string'
  AND v."value" #>> '{}' = m.old_value;
--> statement-breakpoint
WITH candidates AS (
  SELECT
    f."id" AS field_id,
    e->>'value' AS old_value,
    e->>'label' AS new_value
  FROM "form_block_fields" f
  CROSS JOIN LATERAL jsonb_array_elements(f."options") AS e
  WHERE f."options" IS NOT NULL
    AND jsonb_typeof(f."options") = 'array'
    AND jsonb_typeof(e) = 'object'
    AND COALESCE(btrim(e->>'value'), '') <> ''
    AND COALESCE(btrim(e->>'label'), '') <> ''
    AND e->>'value' <> e->>'label'
),
maps AS (
  SELECT DISTINCT ON (c.field_id, c.old_value)
    c.field_id,
    c.old_value,
    c.new_value
  FROM candidates c
  ORDER BY c.field_id, c.old_value, c.new_value
)
UPDATE "form_submission_values" v
SET "value" = (
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(
        COALESCE(
          (
            SELECT m.new_value
            FROM maps m
            WHERE m.field_id = v."field_id"
              AND m.old_value = elem #>> '{}'
          ),
          elem #>> '{}'
        )
      )
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(v."value") WITH ORDINALITY AS t(elem, ord)
)
WHERE jsonb_typeof(v."value") = 'array'
  AND EXISTS (
    SELECT 1 FROM maps m WHERE m.field_id = v."field_id"
  );
--> statement-breakpoint
UPDATE "form_block_fields"
SET "options" = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(elem) = 'string' THEN elem
      ELSE to_jsonb(
        COALESCE(
          NULLIF(btrim(elem->>'label'), ''),
          NULLIF(btrim(elem->>'value'), ''),
          ''
        )
      )
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements("options") WITH ORDINALITY AS t(elem, ord)
)
WHERE "options" IS NOT NULL
  AND jsonb_typeof("options") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("options") AS e
    WHERE jsonb_typeof(e) = 'object'
  );
