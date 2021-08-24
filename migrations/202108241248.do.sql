ALTER TABLE "application"."application" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "application"."application" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'application'
    AND "a"."table_name" = 'application'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "application_createdAt_idx" ON "application"."application" ("createdAt");
ALTER TABLE "application"."configuration" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "application"."configuration" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'application'
    AND "a"."table_name" = 'configuration'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "configuration_createdAt_idx" ON "application"."configuration" ("createdAt");
ALTER TABLE "application"."layerTree" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "application"."layerTree" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'application'
    AND "a"."table_name" = 'layerTree'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "layerTree_createdAt_idx" ON "application"."layerTree" ("createdAt");
ALTER TABLE "dataSources"."attributeDataSource" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "dataSources"."attributeDataSource" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'dataSources'
    AND "a"."table_name" = 'attributeDataSource'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "attributeDataSource_createdAt_idx" ON "dataSources"."attributeDataSource" ("createdAt");
ALTER TABLE "dataSources"."dataSource" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "dataSources"."dataSource" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'dataSources'
    AND "a"."table_name" = 'dataSource'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "dataSource_createdAt_idx" ON "dataSources"."dataSource" ("createdAt");
ALTER TABLE "metadata"."areaTree" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."areaTree" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'areaTree'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "areaTree_createdAt_idx" ON "metadata"."areaTree" ("createdAt");
ALTER TABLE "metadata"."areaTreeLevel" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."areaTreeLevel" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'areaTreeLevel'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "areaTreeLevel_createdAt_idx" ON "metadata"."areaTreeLevel" ("createdAt");
ALTER TABLE "metadata"."attribute" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."attribute" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'attribute'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "attribute_createdAt_idx" ON "metadata"."attribute" ("createdAt");
ALTER TABLE "metadata"."attributeSet" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."attributeSet" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'attributeSet'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "attributeSet_createdAt_idx" ON "metadata"."attributeSet" ("createdAt");
ALTER TABLE "metadata"."case" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."case" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'case'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "case_createdAt_idx" ON "metadata"."case" ("createdAt");
ALTER TABLE "metadata"."layerTemplate" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."layerTemplate" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'layerTemplate'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "layerTemplate_createdAt_idx" ON "metadata"."layerTemplate" ("createdAt");
ALTER TABLE "metadata"."period" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."period" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'period'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "period_createdAt_idx" ON "metadata"."period" ("createdAt");
ALTER TABLE "metadata"."place" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."place" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'place'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "place_createdAt_idx" ON "metadata"."place" ("createdAt");
ALTER TABLE "metadata"."scenario" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."scenario" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'scenario'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "scenario_createdAt_idx" ON "metadata"."scenario" ("createdAt");
ALTER TABLE "metadata"."scope" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."scope" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'scope'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "scope_createdAt_idx" ON "metadata"."scope" ("createdAt");
ALTER TABLE "metadata"."style" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."style" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'style'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "style_createdAt_idx" ON "metadata"."style" ("createdAt");
ALTER TABLE "metadata"."tag" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "metadata"."tag" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'metadata'
    AND "a"."table_name" = 'tag'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "tag_createdAt_idx" ON "metadata"."tag" ("createdAt");
ALTER TABLE "relations"."areaRelation" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "relations"."areaRelation" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'relations'
    AND "a"."table_name" = 'areaRelation'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "areaRelation_createdAt_idx" ON "relations"."areaRelation" ("createdAt");
ALTER TABLE "relations"."attributeDataSourceRelation" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "relations"."attributeDataSourceRelation" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'relations'
    AND "a"."table_name" = 'attributeDataSourceRelation'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "attributeDataSourceRelation_createdAt_idx" ON "relations"."attributeDataSourceRelation" ("createdAt");
ALTER TABLE "relations"."spatialDataSourceRelation" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "relations"."spatialDataSourceRelation" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'relations'
    AND "a"."table_name" = 'spatialDataSourceRelation'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "spatialDataSourceRelation_createdAt_idx" ON "relations"."spatialDataSourceRelation" ("createdAt");
ALTER TABLE "specific"."esponFuoreIndicator" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "specific"."esponFuoreIndicator" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'specific'
    AND "a"."table_name" = 'esponFuoreIndicator'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "esponFuoreIndicator_createdAt_idx" ON "specific"."esponFuoreIndicator" ("createdAt");
ALTER TABLE "specific"."lpisChangeCase" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "specific"."lpisChangeCase" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'specific'
    AND "a"."table_name" = 'lpisChangeCase'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "lpisChangeCase_createdAt_idx" ON "specific"."lpisChangeCase" ("createdAt");
ALTER TABLE "user"."groups" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "user"."groups" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'user'
    AND "a"."table_name" = 'groups'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "groups_createdAt_idx" ON "user"."groups" ("createdAt");
ALTER TABLE "user"."permissions" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "user"."permissions" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'user'
    AND "a"."table_name" = 'permissions'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "permissions_createdAt_idx" ON "user"."permissions" ("createdAt");
ALTER TABLE "user"."users" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "user"."users" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'user'
    AND "a"."table_name" = 'users'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "users_createdAt_idx" ON "user"."users" ("createdAt");
ALTER TABLE "views"."view" ADD COLUMN "createdAt" TIMESTAMP DEFAULT statement_timestamp();
UPDATE "views"."view" "t"
SET "createdAt" = (
    SELECT
    "a"."action_tstamp_stm" as "createdAt"
    FROM
    "audit"."logged_actions" "a"
    WHERE
    "a"."schema_name" = 'views'
    AND "a"."table_name" = 'view'
    AND "a"."action" = 'I'
    AND "a"."row_data" OPERATOR("public".->) 'key' = "t"."key":: text
    LIMIT 1
);
CREATE INDEX "view_createdAt_idx" ON "views"."view" ("createdAt");
