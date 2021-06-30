ALTER TABLE ONLY "relations"."placeRelation" ADD COLUMN "scopeKey" UUID;

ALTER TABLE "relations"."placeRelation"
    ADD CONSTRAINT "placeRelation_scopeKey_fkey" FOREIGN KEY ("scopeKey") REFERENCES "metadata"."scope"("key") ON DELETE CASCADE,
    ADD CONSTRAINT "placeRelation_parentPlaceKey_scopeKey_uniq" UNIQUE ("parentPlaceKey", "scopeKey");