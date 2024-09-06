ALTER TABLE "specific"."worldCerealProductMetadata" RENAME COLUMN "bbox" TO "geometry";
CREATE INDEX ON "specific"."worldCerealProductMetadata" USING gist("geometry");