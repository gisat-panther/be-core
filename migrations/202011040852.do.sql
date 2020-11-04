ALTER TABLE "application"."configuration" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "application"."layerTree" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "dataSources"."attributeDataSource" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "dataSources"."dataSource" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."areaTree" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."areaTreeLevel" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."attribute" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."attributeSet" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."case" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."layerTemplate" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."period" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."place" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."scenario" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."scope" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."style" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "metadata"."tag" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "relations"."areaRelation" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "relations"."attributeDataSourceRelation" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "relations"."spatialDataSourceRelation" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "specific"."esponFuoreIndicator" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "specific"."lpisChangeCase" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "user"."groups" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "user"."permissions" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "user"."users" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "views"."view" ADD COLUMN "__customColumns" JSONB NOT NULL DEFAULT '{}';
