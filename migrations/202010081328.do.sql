CREATE TABLE "user"."hashes"(
  "key" UUID DEFAULT "public".gen_random_uuid() NOT NULL,
  PRIMARY KEY("key")
);

CREATE TABLE "user"."hashPermissions"(
  "hashKey" UUID NOT NULL,
  "permissionKey" UUID NOT NULL,
  FOREIGN KEY("hashKey") REFERENCES "user"."hashes"("key") ON DELETE CASCADE,
  FOREIGN KEY("permissionKey") REFERENCES "user"."permissions"("key") ON DELETE CASCADE,
  PRIMARY KEY("hashKey", "permissionKey")
);

CREATE VIEW "user"."v_hashPermissions" AS
 SELECT "p"."resourceGroup",
    "p"."resourceType",
    "p"."resourceKey",
    "p"."permission",
    "hp"."hashKey"
   FROM
     "user"."permissions" "p"
     JOIN "user"."hashPermissions" "hp" ON "hp"."permissionKey" = "p"."key";
