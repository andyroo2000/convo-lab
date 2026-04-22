CREATE OR REPLACE FUNCTION study_json_scalar_text(input jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH RECURSIVE walk(value) AS (
    SELECT input
    UNION ALL
    SELECT child.value
    FROM walk
    CROSS JOIN LATERAL (
      SELECT jsonb_array_elements(walk.value) AS value
      WHERE jsonb_typeof(walk.value) = 'array'
      UNION ALL
      SELECT jsonb_each.value
      FROM jsonb_each(walk.value)
      WHERE jsonb_typeof(walk.value) = 'object'
    ) AS child
  )
  SELECT trim(
    regexp_replace(
      COALESCE(
        string_agg(
          CASE jsonb_typeof(value)
            WHEN 'string' THEN trim(both '"' FROM value::text)
            WHEN 'number' THEN value::text
            WHEN 'boolean' THEN value::text
            ELSE NULL
          END,
          ' '
        ),
        ''
      ),
      '\s+',
      ' ',
      'g'
    )
  );
  FROM walk;
$$;

UPDATE "study_notes"
SET "searchText" = trim(
  regexp_replace(
    concat_ws(
      ' ',
      study_json_scalar_text(COALESCE("rawFieldsJson"::jsonb, '{}'::jsonb)),
      study_json_scalar_text(COALESCE("canonicalJson"::jsonb, '{}'::jsonb))
    ),
    '\s+',
    ' ',
    'g'
  )
)
WHERE "searchText" IS NOT NULL;

UPDATE "study_cards"
SET "searchText" = trim(
  regexp_replace(
    concat_ws(
      ' ',
      study_json_scalar_text(COALESCE("promptJson"::jsonb, '{}'::jsonb)),
      study_json_scalar_text(COALESCE("answerJson"::jsonb, '{}'::jsonb))
    ),
    '\s+',
    ' ',
    'g'
  )
)
WHERE "searchText" IS NOT NULL;

DROP FUNCTION study_json_scalar_text(jsonb);
