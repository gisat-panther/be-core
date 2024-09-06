CREATE TABLE "dataSources"."cog" (
    key uuid DEFAULT public.gen_random_uuid() NOT NULL,
    url TEXT,
    configuration JSONB
);

ALTER TABLE ONLY "dataSources"."cog"
    ADD CONSTRAINT "ds_cog_pkey" PRIMARY KEY (key);

SELECT audit.audit_table('"dataSources"."cog"');