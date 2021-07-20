ALTER INDEX "dataSources"."vector_pkey" RENAME TO "tiled_vector_pkey";

CREATE TABLE "dataSources"."vector" AS TABLE "dataSources"."tiledVector" WITH NO DATA;

ALTER TABLE ONLY "dataSources".vector
    ADD CONSTRAINT "vector_pkey" PRIMARY KEY (key);

CREATE INDEX "ds_v_layername_idx" ON "dataSources"."vector" ("layerName");
CREATE INDEX "ds_v_tablename_idx" ON "dataSources"."vector" ("tableName");
CREATE INDEX "ds_v_fidcolumnname_idx" ON "dataSources"."vector" ("fidColumnName");
CREATE INDEX "ds_v_geometrycolumnname_idx" ON "dataSources"."vector" ("geometryColumnName");

SELECT audit.audit_table('"dataSources"."vector"');