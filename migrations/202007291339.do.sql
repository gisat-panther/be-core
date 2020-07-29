ALTER TABLE "user"."permissions"
  ADD COLUMN "resourceGroup" TEXT;

DROP INDEX "user"."user_permissions_resource_idx";
CREATE INDEX "user_permissions_resource_idx" ON "user"."permissions" ("resourceGroup", "resourceType", "resourceKey");

DROP VIEW "user"."v_userPermissions";
CREATE VIEW "user"."v_userPermissions" AS
 SELECT p."resourceGroup",
    p."resourceType",
    p."resourceKey",
    p.permission,
    up."userKey"
   FROM ("user".permissions p
     JOIN "user"."userPermissions" up ON ((up."permissionKey" = p.key)))
UNION
 SELECT p."resourceGroup",
    p."resourceType",
    p."resourceKey",
    p.permission,
    ug."userKey"
   FROM (("user".permissions p
     JOIN "user"."groupPermissions" gp ON ((gp."permissionKey" = p.key)))
     JOIN "user"."userGroups" ug ON ((ug."groupKey" = gp."groupKey")));
