BEGIN;

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
    ('a7365eb7-e986-4660-8eed-3dd3a6350024', 'ewoc_internal', null, null, null),
    ('0abe901d-c320-4a93-8c1c-444176ed0f2c', 'worldcereal', null, null, null),
    ('10a90703-2370-4e45-9697-675a5d62b0f4', 'demo_consortium', null, null, null),
    ('590314e1-e676-433b-8791-03ae9477fe5c', 'demo_public', null, null, null)
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
    ('a7365eb7-e986-4660-8eed-3dd3a6350024', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: worldcereal | group: worldCerealUser
    ('0abe901d-c320-4a93-8c1c-444176ed0f2c', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: worldcereal | group: worldCerealPublic
    ('0abe901d-c320-4a93-8c1c-444176ed0f2c', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: demo_consortium | group: worldCerealUser
    ('10a90703-2370-4e45-9697-675a5d62b0f4', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: demo_consortium | group: worldCerealPublic
    ('10a90703-2370-4e45-9697-675a5d62b0f4', '2dbc2120-b826-4649-939b-fff5a4a01866'),
    -- user: demo_public | group: worldCerealUser
    ('590314e1-e676-433b-8791-03ae9477fe5c', '2597df23-94d9-41e0-91f3-7ea633ae27f2'),
    -- user: demo_public | group: worldCerealPublic
    ('590314e1-e676-433b-8791-03ae9477fe5c', '2dbc2120-b826-4649-939b-fff5a4a01866')
ON CONFLICT DO NOTHING;

INSERT INTO "user"."permissions"
    ("key", "resourceKey", "resourceGroup", "resourceType", "permission")
VALUES
    -- group: specific, type: worldCerealProductMetadata
    ('b809c988-cfff-427d-9572-1e40a2fe92fe', null, 'specific', 'worldCerealProductMetadata', 'create'),
    ('a405e8cf-13e0-4d9a-b039-91e4f8854b07', null, 'specific', 'worldCerealProductMetadata', 'view'),
    ('fd5aba3a-c8f8-493c-a304-a75e19c64df6', null, 'specific', 'worldCerealProductMetadata', 'update'),
    ('647a7004-2a62-445d-a78d-43ac8b1bdb6e', null, 'specific', 'worldCerealProductMetadata', 'delete'),
    -- group: user, type: users
    ('6897b1fc-a3e3-4195-a41a-f492d4a9df2a', null, 'user', 'users', 'create'),
    -- group: dataSources, type: spatial
    ('5d53367f-03c4-4f93-b682-65d1e873f342', null, 'dataSources', 'spatial', 'create'),
    ('67e3e60f-3313-4186-889d-6216347fd326', null, 'dataSources', 'spatial', 'update'),
    ('97e3cee5-bcfe-43a3-8d3e-fd8e4fa036b3', null, 'dataSources', 'spatial', 'view'),
    ('d367e5f1-b876-4f3f-a55b-9a6196e2404d', null, 'dataSources', 'spatial', 'delete'),
    -- group: dataSources, type: attribute
    ('49cab426-0f1b-490b-adfc-6c7326bb6a7d', null, 'dataSources', 'attribute', 'create'),
    ('de98054c-fc37-413d-86dd-1fc76e321f5f', null, 'dataSources', 'attribute', 'update'),
    ('87e5c22e-984c-4c33-96a7-cdb007a23f28', null, 'dataSources', 'attribute', 'view'),
    -- group: application, type: applications
    ('b8317af3-7d07-4b86-9cf2-21c1ecf50adb', null, 'application', 'applications', 'create'),
    ('a62344f5-5a3e-476d-bd0b-663dc20ce061', null, 'application', 'applications', 'update'),
    ('6f3d8503-906d-4fcf-bcab-85b4dfcfc226', null, 'application', 'applications', 'view'),
    -- group: application, type: configurations
    ('57ca9ad7-396b-4a00-a86b-572d7a923d23', null, 'application', 'configurations', 'create'),
    ('ef9a75eb-504f-46f3-a09d-f3c9ca0b4e8b', null, 'application', 'configurations', 'update'),
    ('fe21e05d-0d50-464f-a803-ae619427aad4', null, 'application', 'configurations', 'view'),
    -- group: metadata, type: areaTrees
    ('72ef241e-5d67-4ea5-ac20-b325e287a1ab', null, 'metadata', 'areaTrees', 'create'),
    ('03ba02db-acc7-48b3-8a40-369a67b02a7e', null, 'metadata', 'areaTrees', 'update'),
    ('46823010-754a-41f1-a09b-1c3a0fb1eb97', null, 'metadata', 'areaTrees', 'view'),
    -- group: metadata, type: areaTreeLevels
    ('f67e3ee5-5aac-4e1b-941e-b315854ab85e', null, 'metadata', 'areaTreeLevels', 'create'),
    ('71d22470-9b69-4cab-abaa-efd3c56e096d', null, 'metadata', 'areaTreeLevels', 'update'),
    ('09a6ebdd-2f7b-4972-ac8a-57bfaf4939bf', null, 'metadata', 'areaTreeLevels', 'view'),
    -- group: metadata, type: attributes
    ('df51fd6c-76f9-4e8b-8aad-6e112668ae8f', null, 'metadata', 'attributes', 'create'),
    ('b1a6f4c7-1cde-4b0e-9ff3-dbb25e159baa', null, 'metadata', 'attributes', 'update'),
    ('18770cdc-9721-42ed-9973-b5a0785bdddd', null, 'metadata', 'attributes', 'view'),
    -- group: metadata, type: cases
    ('4f7bb65a-d5c2-4f99-81e3-41b0ab25eb61', null, 'metadata', 'cases', 'create'),
    ('205dad2f-08f9-4d64-a870-51e5202b0019', null, 'metadata', 'cases', 'update'),
    ('545a2810-52fd-4d77-83d5-1ecc8088b5c0', null, 'metadata', 'cases', 'view'),
    -- group: metadata, type: periods
    ('4afe742d-e17e-4dfe-9fe3-6f982417719a', null, 'metadata', 'periods', 'create'),
    ('e11c11dd-e68e-4429-b9cc-c17c63f99534', null, 'metadata', 'periods', 'update'),
    ('7129e185-d161-42db-86f2-bd1f9c82ae76', null, 'metadata', 'periods', 'view'),
    -- group: metadata, type: places
    ('8d5141cb-6354-444a-951a-8d1b3e5f4a35', null, 'metadata', 'places', 'create'),
    ('a0ca5660-e0a9-4d52-ab26-4cc588f3a600', null, 'metadata', 'places', 'update'),
    ('37b47652-d3a1-437c-949e-f5e391de19ac', null, 'metadata', 'places', 'view'),
    -- group: metadata, type: scopes
    ('b2002e2b-a2cc-4533-8c20-d899a7021e1e', null, 'metadata', 'scopes', 'create'),
    ('b1b7eff7-efb3-492a-8dff-d97bf08c2623', null, 'metadata', 'scopes', 'update'),
    ('8897a287-793f-4ee5-b757-39a3893d85b9', null, 'metadata', 'scopes', 'view'),
    -- group: metadata, type: styles
    ('d09ca5a1-d433-4f99-ac77-c26c454aff4d', null, 'metadata', 'styles', 'create'),
    ('8802ff19-7886-4a4b-a746-3f303a3530f7', null, 'metadata', 'styles', 'update'),
    ('9138f519-ea93-4baf-8f77-ca72cbd00d39', null, 'metadata', 'styles', 'view'),
    -- group: relations, type: spatial
    ('2dbfa904-99d5-49b8-a574-bab9ce95ed78', null, 'relations', 'spatial', 'create'),
    ('0b2d0c9a-65b2-4871-aa52-a0d62600d3f9', null, 'relations', 'spatial', 'update'),
    ('42fe17c2-a275-4f9d-994c-22d96e4ab3c9', null, 'relations', 'spatial', 'view'),
    -- group: relations, type: attribute
    ('9fbc0b14-7c9b-4ca8-9c74-e590c7c9daeb', null, 'relations', 'attribute', 'create'),
    ('be73b2ae-623a-4d57-8723-672234823370', null, 'relations', 'attribute', 'update'),
    ('16b16691-2d50-455b-8a23-1aa8f519ba9b', null, 'relations', 'attribute', 'view'),
    -- group: relations, type: area
    ('98c67e29-aaac-42a2-9f05-fec3243f9fd3', null, 'relations', 'area', 'create'),
    ('81e237df-ff2a-40b7-80f0-baf19f5dba21', null, 'relations', 'area', 'update'),
    ('e6837797-42bd-46c9-9767-3bda5d058ce2', null, 'relations', 'area', 'view')
ON CONFLICT DO NOTHING;

INSERT INTO "user"."userPermissions"
    ("userKey", "permissionKey")
VALUES
    -- user: gisat_user | permission: application > applications > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'b8317af3-7d07-4b86-9cf2-21c1ecf50adb'),
    -- user: gisat_user | permission: application > applications > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'a62344f5-5a3e-476d-bd0b-663dc20ce061'),
    -- user: gisat_user | permission: application > configurations > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '57ca9ad7-396b-4a00-a86b-572d7a923d23'),
    -- user: gisat_user | permission: application > configurations > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'ef9a75eb-504f-46f3-a09d-f3c9ca0b4e8b'),
    -- user: gisat_user | permission: metadata > areaTrees > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '72ef241e-5d67-4ea5-ac20-b325e287a1ab'),
    -- user: gisat_user | permission: metadata > areaTrees > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '03ba02db-acc7-48b3-8a40-369a67b02a7e'),
    -- user: gisat_user | permission: metadata > areaTreeLevels > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'f67e3ee5-5aac-4e1b-941e-b315854ab85e'),
    -- user: gisat_user | permission: metadata > areaTreeLevels > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '71d22470-9b69-4cab-abaa-efd3c56e096d'),
    -- user: gisat_user | permission: metadata > attributes > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'df51fd6c-76f9-4e8b-8aad-6e112668ae8f'),
    -- user: gisat_user | permission: metadata > attributes > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'b1a6f4c7-1cde-4b0e-9ff3-dbb25e159baa'),
    -- user: gisat_user | permission: metadata > cases > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '4f7bb65a-d5c2-4f99-81e3-41b0ab25eb61'),
    -- user: gisat_user | permission: metadata > cases > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '205dad2f-08f9-4d64-a870-51e5202b0019'),
    -- user: gisat_user | permission: metadata > periods > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '4afe742d-e17e-4dfe-9fe3-6f982417719a'),
    -- user: gisat_user | permission: metadata > periods > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'e11c11dd-e68e-4429-b9cc-c17c63f99534'),
    -- user: gisat_user | permission: metadata > places > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '8d5141cb-6354-444a-951a-8d1b3e5f4a35'),
    -- user: gisat_user | permission: metadata > places > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'a0ca5660-e0a9-4d52-ab26-4cc588f3a600'),
    -- user: gisat_user | permission: metadata > scopes > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'b2002e2b-a2cc-4533-8c20-d899a7021e1e'),
    -- user: gisat_user | permission: metadata > scopes > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'b1b7eff7-efb3-492a-8dff-d97bf08c2623'),
    -- user: gisat_user | permission: metadata > styles > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'd09ca5a1-d433-4f99-ac77-c26c454aff4d'),
    -- user: gisat_user | permission: metadata > styles > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '8802ff19-7886-4a4b-a746-3f303a3530f7'),
    -- user: gisat_user | permission: dataSources > spatial > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '5d53367f-03c4-4f93-b682-65d1e873f342'),
    -- user: gisat_user | permission: dataSources > spatial > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '67e3e60f-3313-4186-889d-6216347fd326'),
    -- user: gisat_user | permission: dataSources > attribute > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '49cab426-0f1b-490b-adfc-6c7326bb6a7d'),
    -- user: gisat_user | permission: dataSources > attribute > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'de98054c-fc37-413d-86dd-1fc76e321f5f'),
    -- user: gisat_user | permission: relations > spatial > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '2dbfa904-99d5-49b8-a574-bab9ce95ed78'),
    -- user: gisat_user | permission: relations > spatial > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '0b2d0c9a-65b2-4871-aa52-a0d62600d3f9'),
    -- user: gisat_user | permission: relations > attribute > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '9fbc0b14-7c9b-4ca8-9c74-e590c7c9daeb'),
    -- user: gisat_user | permission: relations > attribute > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', 'be73b2ae-623a-4d57-8723-672234823370'),
    -- user: gisat_user | permission: relations > area > create
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '98c67e29-aaac-42a2-9f05-fec3243f9fd3'),
    -- user: gisat_user | permission: relations > area > update
    ('ba621c03-bc65-4669-8df9-fc621143a99f', '81e237df-ff2a-40b7-80f0-baf19f5dba21')
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
    ('2597df23-94d9-41e0-91f3-7ea633ae27f2', '67e3e60f-3313-4186-889d-6216347fd326'),

    -- group guest | null applications applications view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '6f3d8503-906d-4fcf-bcab-85b4dfcfc226'),
    -- group guest | null applications configurations view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'fe21e05d-0d50-464f-a803-ae619427aad4'),
    -- group guest | null metadata areaTrees view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '46823010-754a-41f1-a09b-1c3a0fb1eb97'),
    -- group guest | null metadata areaTreeLevels view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '09a6ebdd-2f7b-4972-ac8a-57bfaf4939bf'),
    -- group guest | null metadata attributes view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '18770cdc-9721-42ed-9973-b5a0785bdddd'),
    -- group guest | null metadata cases view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '545a2810-52fd-4d77-83d5-1ecc8088b5c0'),
    -- group guest | null metadata periods view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '7129e185-d161-42db-86f2-bd1f9c82ae76'),
    -- group guest | null metadata places view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '37b47652-d3a1-437c-949e-f5e391de19ac'),
    -- group guest | null metadata scopes view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '8897a287-793f-4ee5-b757-39a3893d85b9'),
    -- group guest | null metadata styles view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '9138f519-ea93-4baf-8f77-ca72cbd00d39'),
    -- group guest | null dataSources spatial view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '97e3cee5-bcfe-43a3-8d3e-fd8e4fa036b3'),
    -- group guest | null dataSources attribute view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '87e5c22e-984c-4c33-96a7-cdb007a23f28'),
    -- group guest | null relations spatial view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '42fe17c2-a275-4f9d-994c-22d96e4ab3c9'),
    -- group guest | null relations attribute view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '16b16691-2d50-455b-8a23-1aa8f519ba9b'),
    -- group guest | null relations area view
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'e6837797-42bd-46c9-9767-3bda5d058ce2')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "worldCerealStacs" (
    "key" UUID PRIMARY KEY,
    "productKey" UUID NOT NULL,
    "owner" UUID NOT NULL,
    "stac" JSONB NOT NULL,
    "geometry" GEOMETRY NOT NULL,
    "tile" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "worldCerealQueue" (
    "key" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productKey" UUID NOT NULL,
    "user" JSONB NOT NULL,
    "state" TEXT NOT NULL,
    "time" TIMESTAMP,
    UNIQUE("productKey")
);

CREATE TABLE IF NOT EXISTS "worldCerealGlobalQueue" (
    "key" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productKeys" UUID[] NOT NULL,
    "user" JSONB NOT NULL,
    "state" TEXT NOT NULL,
    "time" TIMESTAMP
);

COMMIT;