ALTER TABLE "user"."groupPermissions"
  DROP COLUMN "permissionSources";

ALTER TABLE "user"."userPermissions"
  DROP COLUMN "permissionSources";

DROP TABLE "public"."generatedPermissions";

ALTER TABLE "user"."permissions"
  DROP CONSTRAINT "permissions_uniq";
