ALTER TABLE "relations"."viewRelation"
  ADD COLUMN "tagKey" UUID,
  ADD CONSTRAINT "viewRelation_tagKey_fkey" FOREIGN KEY ("tagKey") REFERENCES "metadata"."tag"("key") ON DELETE CASCADE;