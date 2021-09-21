INSERT INTO "user"."users"
    ("key", "email", "password", "phone", "name")
VALUES
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', 'worldCerealAdmin@example.com', null, null, null);

INSERT INTO "user"."permissions"
    ("key", "resourceKey", "resourceGroup", "resourceType", "permission")
VALUES
    ('b809c988-cfff-427d-9572-1e40a2fe92fe', null, 'specific', 'worldCerealProductMetadata', 'create'),
    ('9c125676-996d-48a0-b973-5adda3e4e195', null, 'specific', 'worldCerealProductMetadata', 'update'),
    ('3754fae3-5f42-4640-98f3-022a7a4e28af', null, 'specific', 'worldCerealProductMetadata', 'delete'),
    ('0cf6b1fd-39d3-401a-8ad3-69c99367f9c5', null, 'specific', 'worldCerealProductMetadata', 'view'),
    ('6897b1fc-a3e3-4195-a41a-f492d4a9df2a', null, 'user', 'users', 'create'),
    ('913e3bae-e5dd-4600-a854-ca7b65199bbf', null, 'user', 'users', 'update'),
    ('9ac648e7-00d0-4196-be44-9ae2d7cfb598', null, 'user', 'users', 'delete'),
    ('828af8c1-5438-475b-9f91-af432745e83f', null, 'user', 'users', 'view');

INSERT INTO "user"."userPermissions"
    ("userKey", "permissionKey")
VALUES
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', 'b809c988-cfff-427d-9572-1e40a2fe92fe'),
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '9c125676-996d-48a0-b973-5adda3e4e195'),
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '3754fae3-5f42-4640-98f3-022a7a4e28af'),
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '0cf6b1fd-39d3-401a-8ad3-69c99367f9c5'),
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '6897b1fc-a3e3-4195-a41a-f492d4a9df2a'),
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '913e3bae-e5dd-4600-a854-ca7b65199bbf'),
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '9ac648e7-00d0-4196-be44-9ae2d7cfb598'),
    ('3fdd158d-4b78-4d11-92c7-403b4adab4d8', '828af8c1-5438-475b-9f91-af432745e83f');