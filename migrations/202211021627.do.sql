ALTER TABLE "relations"."caseRelation"
  ADD COLUMN "scopeKey" UUID,
  ADD CONSTRAINT "caseRelation_scopeKey_fkey" FOREIGN KEY ("scopeKey") REFERENCES "metadata"."scope"("key") ON DELETE CASCADE;