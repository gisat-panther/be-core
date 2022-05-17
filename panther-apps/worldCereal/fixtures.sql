INSERT INTO "user"."users"
    ("key", "email", "password", "phone", "name")
VALUES
    ('c728b264-5c97-4f4c-81fe-1500d4c4dfbd', 'worldCerealAdmin@example.com', null, null, null),
    ('4fc1d704-b2e5-4fb7-839a-5baf3ad494ee', 'worldCerealUser@example.com', null, null, null),
    ('1e70bb3c-3575-406d-8d1d-d64359ec0027', 'vito_user', null, null, null),
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'gisat_user', null, null, null),
    ('441fb13d-abb6-4775-a732-907e5e5f0e58', 'iiasa_user', null, null, null),
    ('3c8f1575-3a32-497e-9a77-0a75f0bcf86d', 'cs_user', null, null, null),
    ('cbbf5f25-684d-4236-bd33-613f21a16dac', 'esa_user', null, null, null),
    ('5db9613d-f8da-4167-bde6-11f9d84df775', 'cs_admin', null, null, null),
    ('8c676118-a49e-4817-8b3f-edc742fdf43c', 'demo_rdm', null, null, null),
    ('a7365eb7-e986-4660-8eed-3dd3a6350024', 'ewoc_internal', null, null, null)
ON CONFLICT DO NOTHING;

INSERT INTO "user"."groups"
    ("key", "name")
VALUES
    ('2dbc2120-b826-4649-939b-fff5a4a01866', 'worldCerealPublic'),
    ('2597df23-94d9-41e0-91f3-7ea633ae27f2', 'worldCerealUser'),
    ('998c5760-e42e-457f-aa6d-247af6352c73', 'worldCerealAdmin')
ON CONFLICT DO NOTHING;

INSERT INTO "user"."userGroups"
    ("userKey", "groupKey")
VALUES
    -- user: worldCerealAdmin@example.com | group: worldCerealAdmin
    ('c728b264-5c97-4f4c-81fe-1500d4c4dfbd', '998c5760-e42e-457f-aa6d-247af6352c73'),
    -- user: worldCerealAdmin@example.com | group: worldCerealPublic
    ('c728b264-5c97-4f4c-81fe-1500d4c4dfbd', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: worldCerealUser@example.com | group: worldCerealUser
    ('4fc1d704-b2e5-4fb7-839a-5baf3ad494ee', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: worldCerealUser@example.com | group: worldCerealPublic
    ('4fc1d704-b2e5-4fb7-839a-5baf3ad494ee', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    
    -- user: vito_user | group: worldCerealUser
    ('1e70bb3c-3575-406d-8d1d-d64359ec0027', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: vito_user | group: worldCerealPublic
    ('1e70bb3c-3575-406d-8d1d-d64359ec0027', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: gisat_user | group: worldCerealUser
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: gisat_user | group: worldCerealPublic
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '2dbc2120-b826-4649-939b-fff5a4a01866'),    
    -- user: iiasa_user | group: worldCerealUser
    ('441fb13d-abb6-4775-a732-907e5e5f0e58', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: iiasa_user | group: worldCerealPublic
    ('441fb13d-abb6-4775-a732-907e5e5f0e58', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: cs_user | group: worldCerealUser
    ('3c8f1575-3a32-497e-9a77-0a75f0bcf86d', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: cs_user | group: worldCerealPublic
    ('3c8f1575-3a32-497e-9a77-0a75f0bcf86d', '2dbc2120-b826-4649-939b-fff5a4a01866'),    
    -- user: esa_user | group: worldCerealUser
    ('cbbf5f25-684d-4236-bd33-613f21a16dac', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: esa_user | group: worldCerealPublic
    ('cbbf5f25-684d-4236-bd33-613f21a16dac', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: cs_admin | group: worldCerealUser
    ('5db9613d-f8da-4167-bde6-11f9d84df775', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: cs_admin | group: worldCerealPublic
    ('5db9613d-f8da-4167-bde6-11f9d84df775', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: demo_rdm | group: worldCerealUser
    ('8c676118-a49e-4817-8b3f-edc742fdf43c', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: demo_rdm | group: worldCerealPublic
    ('8c676118-a49e-4817-8b3f-edc742fdf43c', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: ewoc_internal | group: worldCerealUser
    ('a7365eb7-e986-4660-8eed-3dd3a6350024', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: ewoc_internal | group: worldCerealPublic
    ('a7365eb7-e986-4660-8eed-3dd3a6350024', '2dbc2120-b826-4649-939b-fff5a4a01866')
ON CONFLICT DO NOTHING;

INSERT INTO "user"."permissions"
    ("key", "resourceKey", "resourceGroup", "resourceType", "permission")
VALUES
    ('b809c988-cfff-427d-9572-1e40a2fe92fe', null, 'specific', 'worldCerealProductMetadata', 'create'),
    ('a405e8cf-13e0-4d9a-b039-91e4f8854b07', null, 'specific', 'worldCerealProductMetadata', 'view'),
    ('fd5aba3a-c8f8-493c-a304-a75e19c64df6', null, 'specific', 'worldCerealProductMetadata', 'update'),
    ('647a7004-2a62-445d-a78d-43ac8b1bdb6e', null, 'specific', 'worldCerealProductMetadata', 'delete'),
    ('6897b1fc-a3e3-4195-a41a-f492d4a9df2a', null, 'user', 'users', 'create'),
    ('5d53367f-03c4-4f93-b682-65d1e873f342', null, 'dataSources', 'spatial', 'create'),
    ('67e3e60f-3313-4186-889d-6216347fd326', null, 'dataSources', 'spatial', 'update'),
    ('97e3cee5-bcfe-43a3-8d3e-fd8e4fa036b3', null, 'dataSources', 'spatial', 'view'),
    ('d367e5f1-b876-4f3f-a55b-9a6196e2404d', null, 'dataSources', 'spatial', 'delete')
ON CONFLICT DO NOTHING;

INSERT INTO "user"."groupPermissions"
    ("groupKey", "permissionKey")
VALUES
    -- group: worldCerealAdmin | null specific worldCerealProductMetadata create
    ('998c5760-e42e-457f-aa6d-247af6352c73', 'b809c988-cfff-427d-9572-1e40a2fe92fe'),
    -- group: worldCerealAdmin | null specific worldCerealProductMetadata view
    ('998c5760-e42e-457f-aa6d-247af6352c73', 'a405e8cf-13e0-4d9a-b039-91e4f8854b07'),
    -- group: worldCerealAdmin | null specific worldCerealProductMetadata update
    ('998c5760-e42e-457f-aa6d-247af6352c73', 'fd5aba3a-c8f8-493c-a304-a75e19c64df6'),
    -- group: worldCerealAdmin | null specific worldCerealProductMetadata delete
    ('998c5760-e42e-457f-aa6d-247af6352c73', '647a7004-2a62-445d-a78d-43ac8b1bdb6e'),

    -- group: worldCerealAdmin | null user users create
    ('998c5760-e42e-457f-aa6d-247af6352c73', '6897b1fc-a3e3-4195-a41a-f492d4a9df2a'),

    -- group: worldCerealUser | null specific worldCerealProductMetadata create
    ('2597df23-94d9-41e0-91f3-7ea633ae27f2', 'b809c988-cfff-427d-9572-1e40a2fe92fe'),
    -- group: worldCerealUser | null specific worldCerealProductMetadata update
    ('2597df23-94d9-41e0-91f3-7ea633ae27f2', 'fd5aba3a-c8f8-493c-a304-a75e19c64df6'),

    -- group: worldCerealAdmin | null dataSources spatial create
    ('998c5760-e42e-457f-aa6d-247af6352c73', '5d53367f-03c4-4f93-b682-65d1e873f342'),
    -- group: worldCerealAdmin | null dataSource spatial view
    ('998c5760-e42e-457f-aa6d-247af6352c73', '97e3cee5-bcfe-43a3-8d3e-fd8e4fa036b3'),
    -- group: worldCerealAdmin | null dataSources spatual update
    ('998c5760-e42e-457f-aa6d-247af6352c73', '67e3e60f-3313-4186-889d-6216347fd326'),
    -- group: worldCerealAdmin | null dataSource spatial delete
    ('998c5760-e42e-457f-aa6d-247af6352c73', 'd367e5f1-b876-4f3f-a55b-9a6196e2404d'),

    -- group: worldCerealUser | null dataSources spatial create
    ('2597df23-94d9-41e0-91f3-7ea633ae27f2', '5d53367f-03c4-4f93-b682-65d1e873f342'),
    -- group: worldCerealUser | null dataSources spatial update
    ('2597df23-94d9-41e0-91f3-7ea633ae27f2', '67e3e60f-3313-4186-889d-6216347fd326')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "worldCerealStacs" (
    "key" UUID PRIMARY KEY,
    "productKey" UUID NOT NULL,
    "owner" UUID NOT NULL,
    "stac" JSONB NOT NULL,
    "geometry" GEOMETRY NOT NULL,
    "tile" TEXT NOT NULL
);