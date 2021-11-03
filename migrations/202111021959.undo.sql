DROP INDEX "dataSources"."ds_tsds_nameinternal_idx";
DROP INDEX "dataSources"."ds_tsds_tablename_idx";
DROP INDEX "relations"."r_tsdsr_scopekey_idx";
DROP INDEX "relations"."r_tsdsr_periodkey_idx";
DROP INDEX "relations"."r_tsdsr_placekey_idx";
DROP INDEX "relations"."r_tsdsr_timeseriedatasourcekey_idx";
DROP INDEX "relations"."r_tsdsr_layertemplatekey_idx";
DROP INDEX "relations"."r_tsdsr_scenariokey_idx";
DROP INDEX "relations"."r_tsdsr_casekey_idx";
DROP INDEX "relations"."r_tsdsr_applicationkey_idx";
DROP INDEX "relations"."r_tsdsr_attributekey_idx";

DROP TRIGGER audit_trigger_row ON "dataSources"."timeSerieDataSource";
DROP TRIGGER audit_trigger_stm ON "dataSources"."timeSerieDataSource";
DROP TRIGGER audit_trigger_row ON "relations"."timeSerieDataSourceRelation";
DROP TRIGGER audit_trigger_stm ON "relations"."timeSerieDataSourceRelation";

ALTER TABLE "dataSources"."timeSerieDataSource" DROP COLUMN "__customColumns";
ALTER TABLE "relations"."timeSerieDataSourceRelation" DROP COLUMN "__customColumns";

ALTER TABLE "dataSources"."timeSerieDataSource" DROP COLUMN "createdAt";
ALTER TABLE "relations"."timeSerieDataSourceRelation" DROP COLUMN "createdAt";

ALTER TABLE "relations"."timeSerieDataSourceRelation"
  DROP CONSTRAINT "timeSerieDataSourceRelation_scopeKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_periodKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_placeKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_timeSerieDataSourceKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_layerTemplateKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_scenarioKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_caseKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_attributeKey_fkey",
  DROP CONSTRAINT "timeSerieDataSourceRelation_applicationKey_fkey";
