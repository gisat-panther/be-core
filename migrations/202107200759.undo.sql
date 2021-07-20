DROP INDEX "dataSources"."ds_v_layername_idx";
DROP INDEX "dataSources"."ds_v_tablename_idx";
DROP INDEX "dataSources"."ds_v_fidcolumnname_idx";
DROP INDEX "dataSources"."ds_v_geometrycolumnname_idx";

DROP TRIGGER audit_trigger_row ON "dataSources"."vector";
DROP TRIGGER audit_trigger_stm ON "dataSources"."vector";