CREATE TABLE "application"."accesses" (
    "key" uuid DEFAULT public.gen_random_uuid() NOT NULL,
    "data" JSONB
);

ALTER TABLE ONLY "application"."accesses"
    ADD CONSTRAINT application_accesses_pkey PRIMARY KEY (key);

ALTER TABLE "application"."accesses" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "application"."accesses" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "application"."accesses" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'application'
    AND "a"."table_name" = 'accesses'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "accesses_createdAt_idx" ON "application"."accesses" ("createdAt");

SELECT audit.audit_table('"application"."accesses"');