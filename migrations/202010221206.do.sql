CREATE TABLE "public"."translations"(
  "resourceKey" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "value" JSONB,
  PRIMARY KEY("resourceKey", "resourceType", "locale", "field")
);
