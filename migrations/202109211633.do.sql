ALTER TABLE "user"."userPermissions"
  ADD COLUMN "permissionSources" TEXT[] NOT NULL DEFAULT '{manual}';
