CREATE INDEX "logged_actions_rd_key_idx" ON "audit"."logged_actions"( ("row_data"->'key') );
CREATE INDEX "logged_actions_rd_userKey_idx" ON "audit"."logged_actions"( ("row_data"->'userKey') );
CREATE INDEX "logged_actions_rd_parentScopeKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentScopeKey') );
CREATE INDEX "logged_actions_rd_parentPlaceKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentPlaceKey') );
CREATE INDEX "logged_actions_rd_parentPeriodKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentPeriodKey') );
CREATE INDEX "logged_actions_rd_parentAttributeSetKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentAttributeSetKey') );
CREATE INDEX "logged_actions_rd_parentAttributeKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentAttributeKey') );
CREATE INDEX "logged_actions_rd_parentLayerTemplateKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentLayerTemplateKey') );
CREATE INDEX "logged_actions_rd_parentScenarioKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentScenarioKey') );
CREATE INDEX "logged_actions_rd_parentCaseKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentCaseKey') );
CREATE INDEX "logged_actions_rd_parentAreaTreeKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentAreaTreeKey') );
CREATE INDEX "logged_actions_rd_parentAreaTreeLevelKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentAreaTreeLevelKey') );
CREATE INDEX "logged_actions_rd_parentStyleKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentStyleKey') );
CREATE INDEX "logged_actions_rd_parentConfigurationKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentConfigurationKey') );
CREATE INDEX "logged_actions_rd_parentLayerTreeKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentLayerTreeKey') );
CREATE INDEX "logged_actions_rd_parentViewKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentViewKey') );
CREATE INDEX "logged_actions_rd_parentEsponFuoreIndicatorKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentEsponFuoreIndicatorKey') );
CREATE INDEX "logged_actions_rd_parentLpisChangeCaseKey_idx" ON "audit"."logged_actions"( ("row_data"->'parentLpisChangeCaseKey') );
