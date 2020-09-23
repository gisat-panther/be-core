ALTER TABLE "relations"."areaRelation"
  DROP CONSTRAINT "areaRelation_areaTreeKey_fkey",
  DROP CONSTRAINT "areaRelation_areaTreeLevelKey_fkey",
  DROP CONSTRAINT "areaRelation_spatialDataSourceKey_fkey",
  DROP CONSTRAINT "areaRelation_scopeKey_fkey",
  DROP CONSTRAINT "areaRelation_placeKey_fkey",
  DROP CONSTRAINT "areaRelation_periodKey_fkey",
  DROP CONSTRAINT "areaRelation_caseKey_fkey",
  DROP CONSTRAINT "areaRelation_scenarioKey_fkey",
  DROP CONSTRAINT "areaRelation_applicationKey_fkey";

ALTER TABLE "relations"."attributeDataSourceRelation"
  DROP CONSTRAINT "attributeDataSourceRelation_scopeKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_periodKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_placeKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_attributeDataSourceKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_layerTemplateKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_scenarioKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_caseKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_attributeSetKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_attributeKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_areaTreeLevelKey_fkey",
  DROP CONSTRAINT "attributeDataSourceRelation_applicationKey_fkey";

ALTER TABLE "relations"."permissionsRelation"
  DROP CONSTRAINT "permissionsRelation_parentPermissionsKey_fkey",
  DROP CONSTRAINT "permissionsRelation_usersKey_fkey",
  DROP CONSTRAINT "permissionsRelation_groupsKey_fkey";

ALTER TABLE "relations"."spatialDataSourceRelation"
  DROP CONSTRAINT "spatialDataSourceRelation_scopeKey_fkey",
  DROP CONSTRAINT "spatialDataSourceRelation_periodKey_fkey",
  DROP CONSTRAINT "spatialDataSourceRelation_placeKey_fkey",
  DROP CONSTRAINT "spatialDataSourceRelation_spatialDataSourceKey_fkey",
  DROP CONSTRAINT "spatialDataSourceRelation_layerTemplateKey_fkey",
  DROP CONSTRAINT "spatialDataSourceRelation_scenarioKey_fkey",
  DROP CONSTRAINT "spatialDataSourceRelation_caseKey_fkey",
  DROP CONSTRAINT "spatialDataSourceRelation_applicationKey_fkey";

ALTER TABLE "relations"."usersRelation"
  DROP CONSTRAINT "usersRelation_parentUsersKey_fkey",
  DROP CONSTRAINT "usersRelation_groupsKey_fkey";

ALTER TABLE "specific"."lpisChangeCase"
  ALTER COLUMN "caseKey" TYPE TEXT USING "caseKey"::text,
  DROP CONSTRAINT "lpisChangeCase_caseKey_fkey";
