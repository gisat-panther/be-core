ALTER TABLE "user"."groupPermissions"
  ADD COLUMN "permissionSources" TEXT[] NOT NULL DEFAULT '{manual}';

CREATE TABLE "public"."generatedPermissions"(
  "name" TEXT NOT NULL,
  "last_event" BIGINT NOT NULL,
  PRIMARY KEY("name")
);

ALTER TABLE "user"."permissions"
  ADD CONSTRAINT "permissions_uniq" UNIQUE("resourceGroup", "resourceType", "resourceKey", "permission");

CREATE FUNCTION "audit"."notify_audit_action"() RETURNS TRIGGER AS $body$
    BEGIN
        PERFORM pg_notify('audit_action', '');
        RETURN NULL;
    END;
$body$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_action" AFTER INSERT ON "audit"."logged_actions"
    EXECUTE PROCEDURE "audit"."notify_audit_action"();
