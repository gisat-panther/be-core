CREATE TABLE "dataSources"."timeSerieDataSource" (
    key uuid DEFAULT public.gen_random_uuid() NOT NULL,
    "nameInternal" text,
    "attribution" text,
    "tableName" text
);

CREATE TABLE "relations"."timeSerieDataSourceRelation" (
    key uuid DEFAULT public.gen_random_uuid() NOT NULL,
    "scopeKey" uuid,
    "periodKey" uuid,
    "placeKey" uuid,
    "timeSerieDataSourceKey" uuid,
    "layerTemplateKey" uuid,
    "scenarioKey" uuid,
    "caseKey" uuid,
    "attributeKey" uuid,
    "applicationKey" text
);

ALTER TABLE ONLY "dataSources"."timeSerieDataSource"
    ADD CONSTRAINT time_serie_data_source_pkey PRIMARY KEY (key);

ALTER TABLE ONLY "relations"."timeSerieDataSourceRelation"
    ADD CONSTRAINT time_serie_data_source_relation_pkey PRIMARY KEY (key);

CREATE INDEX "ds_tsds_nameinternal_idx" ON "dataSources"."timeSerieDataSource" ("nameInternal");
CREATE INDEX "ds_tsds_tablename_idx" ON "dataSources"."timeSerieDataSource" ("tableName");
CREATE INDEX "r_tsdsr_scopekey_idx" ON "relations"."timeSerieDataSourceRelation" ("scopeKey");
CREATE INDEX "r_tsdsr_periodkey_idx" ON "relations"."timeSerieDataSourceRelation" ("periodKey");
CREATE INDEX "r_tsdsr_placekey_idx" ON "relations"."timeSerieDataSourceRelation" ("placeKey");
CREATE INDEX "r_tsdsr_timeseriedatasourcekey_idx" ON "relations"."timeSerieDataSourceRelation" ("timeSerieDataSourceKey");
CREATE INDEX "r_tsdsr_layertemplatekey_idx" ON "relations"."timeSerieDataSourceRelation" ("layerTemplateKey");
CREATE INDEX "r_tsdsr_scenariokey_idx" ON "relations"."timeSerieDataSourceRelation" ("scenarioKey");
CREATE INDEX "r_tsdsr_casekey_idx" ON "relations"."timeSerieDataSourceRelation" ("caseKey");
CREATE INDEX "r_tsdsr_applicationkey_idx" ON "relations"."timeSerieDataSourceRelation" ("applicationKey");
CREATE INDEX "r_tsdsr_attributekey_idx" ON "relations"."timeSerieDataSourceRelation" ("attributeKey");

SELECT audit.audit_table('"dataSources"."timeSerieDataSource"');
SELECT audit.audit_table('"relations"."timeSerieDataSourceRelation"');

ALTER TABLE "dataSources"."timeSerieDataSource" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "relations"."timeSerieDataSourceRelation" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "dataSources"."timeSerieDataSource" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "dataSources"."timeSerieDataSource" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'dataSources'
    AND "a"."table_name" = 'timeSerieDataSource'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "timeSerieDataSource_createdAt_idx" ON "dataSources"."timeSerieDataSource" ("createdAt");
ALTER TABLE "relations"."timeSerieDataSourceRelation" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "relations"."timeSerieDataSourceRelation" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'relations'
    AND "a"."table_name" = 'timeSerieDataSourceRelation'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "timeSerieDataSourceRelation_createdAt_idx" ON "relations"."timeSerieDataSourceRelation" ("createdAt");

ALTER TABLE "relations"."timeSerieDataSourceRelation"
  ADD CONSTRAINT "timeSerieDataSourceRelation_scopeKey_fkey" FOREIGN KEY ("scopeKey") REFERENCES "metadata"."scope"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_periodKey_fkey" FOREIGN KEY ("periodKey") REFERENCES "metadata"."period"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_placeKey_fkey" FOREIGN KEY ("placeKey") REFERENCES "metadata"."place"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_timeSerieDataSourceKey_fkey" FOREIGN KEY ("timeSerieDataSourceKey") REFERENCES "dataSources"."timeSerieDataSource"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_layerTemplateKey_fkey" FOREIGN KEY ("layerTemplateKey") REFERENCES "metadata"."layerTemplate"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_scenarioKey_fkey" FOREIGN KEY ("scenarioKey") REFERENCES "metadata"."scenario"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_caseKey_fkey" FOREIGN KEY ("caseKey") REFERENCES "metadata"."case"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_attributeKey_fkey" FOREIGN KEY ("attributeKey") REFERENCES "metadata"."attribute"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "timeSerieDataSourceRelation_applicationKey_fkey" FOREIGN KEY ("applicationKey") REFERENCES "application"."application"("key") ON DELETE CASCADE;