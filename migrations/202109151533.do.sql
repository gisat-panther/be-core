ALTER TABLE "specific"."worldCerealProductMetadata" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "specific"."worldCerealProductMetadata" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'specific'
    AND "a"."table_name" = 'worldCerealProductMetadata'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "worldCerealProductMetadata_createdAt_idx" ON "specific"."worldCerealProductMetadata" ("createdAt");