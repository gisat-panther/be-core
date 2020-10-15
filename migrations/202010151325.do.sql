ALTER TABLE "metadata"."period"
  DROP COLUMN "start",
  DROP COLUMN "end",
  ADD COLUMN "periodRange" TSRANGE;
