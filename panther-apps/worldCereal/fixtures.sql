INSERT INTO "user"."users"
    ("key", "email", "password", "phone", "name")
VALUES
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', 'worldCerealAdmin@example.com', null, null, null),
    ('4fc1d704-b2e5-4fb7-839a-5baf3ad494ee', 'worldCerealUser@example.com', null, null, null)
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
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '998c5760-e42e-457f-aa6d-247af6352c73'),
    ('4fc1d704-b2e5-4fb7-839a-5baf3ad494ee', '2597df23-94d9-41e0-91f3-7ea633ae27f2')
ON CONFLICT DO NOTHING;

INSERT INTO "user"."permissions"
    ("key", "resourceKey", "resourceGroup", "resourceType", "permission")
VALUES
    ('b809c988-cfff-427d-9572-1e40a2fe92fe', null, 'specific', 'worldCerealProductMetadata', 'create'),
    ('6897b1fc-a3e3-4195-a41a-f492d4a9df2a', null, 'user', 'users', 'create')
ON CONFLICT DO NOTHING;

INSERT INTO "user"."groupPermissions"
    ("groupKey", "permissionKey")
VALUES
    ('998c5760-e42e-457f-aa6d-247af6352c73', 'b809c988-cfff-427d-9572-1e40a2fe92fe'),
    ('998c5760-e42e-457f-aa6d-247af6352c73', '6897b1fc-a3e3-4195-a41a-f492d4a9df2a'),
    ('2597df23-94d9-41e0-91f3-7ea633ae27f2', 'b809c988-cfff-427d-9572-1e40a2fe92fe')
ON CONFLICT DO NOTHING;