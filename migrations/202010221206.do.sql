CREATE TABLE "public"."translations"(
  "resourceKey" TEXT NOT NULL,
  "resourceGroup" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "value" JSONB,
  PRIMARY KEY("resourceKey", "resourceGroup", "resourceType", "locale", "field")
);
