ALTER TABLE "relations"."areaRelation"
  ADD CONSTRAINT "areaRelation_areaTreeKey_fkey" FOREIGN KEY ("areaTreeKey") REFERENCES "metadata"."areaTree"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_areaTreeLevelKey_fkey" FOREIGN KEY ("areaTreeLevelKey") REFERENCES "metadata"."areaTreeLevel"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_spatialDataSourceKey_fkey" FOREIGN KEY ("spatialDataSourceKey") REFERENCES "dataSources"."dataSource"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_scopeKey_fkey" FOREIGN KEY ("scopeKey") REFERENCES "metadata"."scope"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_placeKey_fkey" FOREIGN KEY ("placeKey") REFERENCES "metadata"."place"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_periodKey_fkey" FOREIGN KEY ("periodKey") REFERENCES "metadata"."period"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_caseKey_fkey" FOREIGN KEY ("caseKey") REFERENCES "metadata"."case"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_scenarioKey_fkey" FOREIGN KEY ("scenarioKey") REFERENCES "metadata"."scenario"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "areaRelation_applicationKey_fkey" FOREIGN KEY ("applicationKey") REFERENCES "application"."application"("key") ON DELETE CASCADE;

ALTER TABLE "relations"."attributeDataSourceRelation"
  ADD CONSTRAINT "attributeDataSourceRelation_scopeKey_fkey" FOREIGN KEY ("scopeKey") REFERENCES "metadata"."scope"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_periodKey_fkey" FOREIGN KEY ("periodKey") REFERENCES "metadata"."period"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_placeKey_fkey" FOREIGN KEY ("placeKey") REFERENCES "metadata"."place"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_attributeDataSourceKey_fkey" FOREIGN KEY ("attributeDataSourceKey") REFERENCES "dataSources"."attributeDataSource"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_layerTemplateKey_fkey" FOREIGN KEY ("layerTemplateKey") REFERENCES "metadata"."layerTemplate"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_scenarioKey_fkey" FOREIGN KEY ("scenarioKey") REFERENCES "metadata"."scenario"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_caseKey_fkey" FOREIGN KEY ("caseKey") REFERENCES "metadata"."case"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_attributeSetKey_fkey" FOREIGN KEY ("attributeSetKey") REFERENCES "metadata"."attributeSet"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_attributeKey_fkey" FOREIGN KEY ("attributeKey") REFERENCES "metadata"."attribute"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_areaTreeLevelKey_fkey" FOREIGN KEY ("areaTreeLevelKey") REFERENCES "metadata"."areaTreeLevel"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "attributeDataSourceRelation_applicationKey_fkey" FOREIGN KEY ("applicationKey") REFERENCES "application"."application"("key") ON DELETE CASCADE;

ALTER TABLE "relations"."permissionsRelation"
  ADD CONSTRAINT "permissionsRelation_parentPermissionsKey_fkey" FOREIGN KEY ("parentPermissionsKey") REFERENCES "user"."permissions"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "permissionsRelation_usersKey_fkey" FOREIGN KEY ("usersKey") REFERENCES "user"."users"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "permissionsRelation_groupsKey_fkey" FOREIGN KEY ("groupsKey") REFERENCES "user"."groups"("key") ON DELETE CASCADE;

ALTER TABLE "relations"."spatialDataSourceRelation"
  ADD CONSTRAINT "spatialDataSourceRelation_scopeKey_fkey" FOREIGN KEY ("scopeKey") REFERENCES "metadata"."scope"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "spatialDataSourceRelation_periodKey_fkey" FOREIGN KEY ("periodKey") REFERENCES "metadata"."period"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "spatialDataSourceRelation_placeKey_fkey" FOREIGN KEY ("placeKey") REFERENCES "metadata"."place"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "spatialDataSourceRelation_spatialDataSourceKey_fkey" FOREIGN KEY ("spatialDataSourceKey") REFERENCES "dataSources"."dataSource"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "spatialDataSourceRelation_layerTemplateKey_fkey" FOREIGN KEY ("layerTemplateKey") REFERENCES "metadata"."layerTemplate"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "spatialDataSourceRelation_scenarioKey_fkey" FOREIGN KEY ("scenarioKey") REFERENCES "metadata"."scenario"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "spatialDataSourceRelation_caseKey_fkey" FOREIGN KEY ("caseKey") REFERENCES "metadata"."case"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "spatialDataSourceRelation_applicationKey_fkey" FOREIGN KEY ("applicationKey") REFERENCES "application"."application"("key") ON DELETE CASCADE;

ALTER TABLE "relations"."usersRelation"
  ADD CONSTRAINT "usersRelation_parentUsersKey_fkey" FOREIGN KEY ("parentUsersKey") REFERENCES "user"."users"("key") ON DELETE CASCADE,
  ADD CONSTRAINT "usersRelation_groupsKey_fkey" FOREIGN KEY ("groupsKey") REFERENCES "user"."groups"("key") ON DELETE CASCADE;

ALTER TABLE "specific"."lpisChangeCase"
  ALTER COLUMN "caseKey" TYPE UUID USING "caseKey"::uuid,
  ADD CONSTRAINT "lpisChangeCase_caseKey_fkey" FOREIGN KEY ("caseKey") REFERENCES "metadata"."case"("key") ON DELETE CASCADE;
