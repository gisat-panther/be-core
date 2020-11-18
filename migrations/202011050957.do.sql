CREATE TABLE "public"."customColumns"(
    "resourceGroup" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY("resourceGroup")
);
