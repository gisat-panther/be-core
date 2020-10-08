CREATE TABLE "user"."hashes"(
  "key" UUID DEFAULT "public".gen_random_uuid() NOT NULL
);

CREATE TABLE "user"."hashPermissions"(
  "hashKey" UUID NOT NULL,
  "permissionKey" UUID NOT NULL,
  PRIMARY KEY("hashKey", "permissionKey")
);
