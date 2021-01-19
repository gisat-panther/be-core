DROP TRIGGER "audit_action" ON "audit"."logged_actions";
DROP FUNCTION "audit"."notify_audit_action"();

ALTER TABLE "user"."groupPermissions"
  DROP COLUMN "permissionSources";

DROP TABLE "public"."generatedPermissions";

ALTER TABLE "user"."permissions"
  DROP CONSTRAINT "permissions_uniq";
