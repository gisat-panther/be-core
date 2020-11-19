ALTER TABLE "user"."groupPermissions"
  ADD COLUMN "permissionSources" TEXT[] NOT NULL DEFAULT '{manual}';

CREATE TABLE "public"."generatedPermissions"(
  "name" TEXT NOT NULL,
  "last_event" BIGINT NOT NULL,
  PRIMARY KEY("name")
);

ALTER TABLE "user"."permissions"
  ADD CONSTRAINT "permissions_uniq" UNIQUE("resourceGroup", "resourceType", "resourceKey", "permission");
