ALTER TABLE IF EXISTS "dataSources".vector RENAME TO "tiledVector";

UPDATE "dataSources"."dataSource" SET "type" = 'tiledVector' WHERE "type" = 'vector';