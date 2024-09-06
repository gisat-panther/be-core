ALTER TABLE "application"."accesses" DROP COLUMN "__customColumns";
ALTER TABLE "application"."accesses" DROP COLUMN "createdAt";

DROP TRIGGER audit_trigger_row ON "application"."accesses";
DROP TRIGGER audit_trigger_stm ON "application"."accesses";