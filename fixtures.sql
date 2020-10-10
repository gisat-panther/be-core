BEGIN;
-- groups:
-- guest: 52ddabec-d01a-49a0-bb4d-5ff931bd346e
-- user: e56f3545-57f5-44f9-9094-2750a69ef67e

TRUNCATE
    "user"."users",
    "user"."groups",
    "user"."permissions",
    "dataSources"."dataSource",
    "dataSources"."raster",
    "dataSources"."vector",
    "dataSources"."wms",
    "dataSources"."wmts",
    "metadata"."place",
    "metadata"."scope",
    "relations"."attributeDataSourceRelation",
    "specific"."lpisChangeCase"
    CASCADE;

INSERT INTO "user"."users"
("key", "email", "password", "phone", "name")
VALUES
('cad8ea0d-f95e-43c1-b162-0704bfc1d3f6', null, null, null, 'guest'),
-- all have password: test
('7c5acddd-3625-46ef-90b3-82f829afb258', 'test@example.com', '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
('2bf6c1da-991a-4592-acc1-b10192db9363', 'testWithGroups@example.com', '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
('e2f5d20e-2784-4690-a3f0-339c60b04245', 'testWithPhone@example.com', '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', '+420123456789', null),
('3e3f4300-1336-4043-baa3-b65a025c2d83', 'testWithPermissions@example.com', '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
-- this user should not have permissions with NOT NULL resourceKey
('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', 'admin@example.com', '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
-- this user should not have permissions with NULL resourceKey
('39ed471f-8383-4283-bb8a-303cb05cadef', 'specificPermsAdmin@example.com', '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null);

INSERT INTO "user"."groups"
("key", "name")
VALUES
('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'guest'),
('e56f3545-57f5-44f9-9094-2750a69ef67e', 'user'),
('742b6f3f-a77e-4267-8e96-1e4cea96dec3', 'test');

INSERT INTO "user"."userGroups"
("userKey", "groupKey")
VALUES
    -- user: guest
    -- groups: guest, user
    ('cad8ea0d-f95e-43c1-b162-0704bfc1d3f6', '52ddabec-d01a-49a0-bb4d-5ff931bd346e'),
    ('cad8ea0d-f95e-43c1-b162-0704bfc1d3f6', 'e56f3545-57f5-44f9-9094-2750a69ef67e'),
    -- user: testWithGroups@example.com
    -- groups: guest, user
    ('2bf6c1da-991a-4592-acc1-b10192db9363', '52ddabec-d01a-49a0-bb4d-5ff931bd346e'),
    ('2bf6c1da-991a-4592-acc1-b10192db9363', 'e56f3545-57f5-44f9-9094-2750a69ef67e'),
    -- user: -- testWithPermissions@example.com
    -- groups: test
    ('3e3f4300-1336-4043-baa3-b65a025c2d83', '742b6f3f-a77e-4267-8e96-1e4cea96dec3');

INSERT INTO "user"."permissions"
("key", "resourceKey", "resourceGroup", "resourceType", "permission")
VALUES
('ed6a9cb0-7662-4d85-bb9a-ed5b78396008', null, 'metadata', 'cases', 'view'),
('0da66083-77ad-4e66-9338-0c8344de9eba', null, 'metadata', 'cases', 'create'),
('42e8bdf8-19c8-4658-aded-b1c724539072', null, 'metadata', 'cases', 'update'),
('a307e381-8c12-4d0e-9934-0d739cce7fa2', null, 'metadata', 'scopes', 'view'),
('820c4a94-9588-4926-8ba0-2df7abe2eb7f', null, 'metadata', 'scopes', 'delete'),
('d221213b-a956-43b6-989e-32b73bee90f6', null, 'metadata', 'places', 'view'),
('6a7df854-4dc0-4093-b8a0-15e2e0a91ed0', null, 'metadata', 'places', 'delete'),
('0cc99d81-8038-49a0-8f3a-b5bd55b94513', null, 'metadata', 'periods', 'view'),
('6897b1fc-a3e3-4195-a41a-f492d4a9df2a', null, 'user', 'users', 'create'),
('913e3bae-e5dd-4600-a854-ca7b65199bbf', null, 'user', 'users', 'update'),
('9ac648e7-00d0-4196-be44-9ae2d7cfb598', null, 'user', 'users', 'delete'),
('828af8c1-5438-475b-9f91-af432745e83f', null, 'user', 'users', 'view'),
('9d2b52c0-ced8-4a3c-b5ae-ea97befd3305', null, 'dataSources', 'spatial', 'create'),
('2f8f7e58-2c55-4c06-90c6-a5a164c3f1f1', null, 'dataSources', 'spatial', 'update'),
('92901779-f29f-44a3-ab05-2a22b6a94848', null, 'dataSources', 'spatial', 'delete'),
('d116a380-4cf2-4241-9b88-3c0488848a05', null, 'dataSources', 'spatial', 'view'),
('5609b0da-6fac-4b47-ab88-b12f97114bdf', null, 'relations', 'attribute', 'create'),
('10061997-2e64-4dd9-b645-28eb5f937f65', null, 'relations', 'attribute', 'update'),
('4f617ffb-86ff-4f38-84b6-ea016afcbaa3', null, 'relations', 'attribute', 'view'),
('0585eda7-de9e-4aab-8f47-1c1085804054', null, 'relations', 'attribute', 'delete'),
('f2ead234-6402-4a6e-9374-b243647edc44', '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8', 'user', 'users', 'view'),
('4f2b3dc7-9b3f-4624-82c0-93d139e19baa', '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8', 'user', 'users', 'update'),
('e84dfa30-f2fc-4a1f-988c-b7f4e2489f2f', '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8', 'user', 'users', 'delete'),
('432348bc-6adf-4fd3-ac44-48a15f7d8ac6', '7c5acddd-3625-46ef-90b3-82f829afb258', 'user', 'users', 'view');

INSERT INTO "user"."userPermissions"
("userKey", "permissionKey")
VALUES
    -- testWithPermissions@example.com     ,  case:create
    ('3e3f4300-1336-4043-baa3-b65a025c2d83', '0da66083-77ad-4e66-9338-0c8344de9eba'),
    -- user: admin@example.com             ,  case:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', 'ed6a9cb0-7662-4d85-bb9a-ed5b78396008'),
    -- user: admin@example.com             ,  users:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '828af8c1-5438-475b-9f91-af432745e83f'),
    -- user: admin@example.com             ,  users:create
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '6897b1fc-a3e3-4195-a41a-f492d4a9df2a'),
    -- user: admin@example.com             ,  users:update
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '913e3bae-e5dd-4600-a854-ca7b65199bbf'),
    -- user: admin@example.com             ,  users:delete
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '9ac648e7-00d0-4196-be44-9ae2d7cfb598'),
    -- user: admin@example.com             , spatial:create
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '9d2b52c0-ced8-4a3c-b5ae-ea97befd3305'),
    -- user: admin@example.com             , spatial:update
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '2f8f7e58-2c55-4c06-90c6-a5a164c3f1f1'),
    -- user: admin@example.com             , spatial:delete
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '92901779-f29f-44a3-ab05-2a22b6a94848'),
    -- user: admin@example.com             , spatial:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', 'd116a380-4cf2-4241-9b88-3c0488848a05'),
    -- user: admin@example.com             , relations.attribute:create
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '5609b0da-6fac-4b47-ab88-b12f97114bdf'),
    -- user: admin@example.com             , relations.attribute:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '4f617ffb-86ff-4f38-84b6-ea016afcbaa3'),
    -- user: admin@example.com             , relations.attribute:update
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '10061997-2e64-4dd9-b645-28eb5f937f65'),
    -- user: admin@example.com             , relations.attribute:delete
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '0585eda7-de9e-4aab-8f47-1c1085804054'),
    -- user: specificPermsAdmin@example.com, users[key]:update
    ('39ed471f-8383-4283-bb8a-303cb05cadef', '4f2b3dc7-9b3f-4624-82c0-93d139e19baa'),
    -- user: specificPermsAdmin@example.com, users[key]:delete
    ('39ed471f-8383-4283-bb8a-303cb05cadef', 'e84dfa30-f2fc-4a1f-988c-b7f4e2489f2f'),
    -- user: specificPermsAdmin@example.com, users[key]:view
    ('39ed471f-8383-4283-bb8a-303cb05cadef', '432348bc-6adf-4fd3-ac44-48a15f7d8ac6'),
    ('39ed471f-8383-4283-bb8a-303cb05cadef', 'f2ead234-6402-4a6e-9374-b243647edc44');

INSERT INTO "user"."groupPermissions"
("groupKey", "permissionKey")
VALUES
    -- test                                , case:update
    ('742b6f3f-a77e-4267-8e96-1e4cea96dec3', '42e8bdf8-19c8-4658-aded-b1c724539072'),
    -- guest                               , case:update
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '42e8bdf8-19c8-4658-aded-b1c724539072'),
    -- test                                , scope:delete
    ('742b6f3f-a77e-4267-8e96-1e4cea96dec3', '820c4a94-9588-4926-8ba0-2df7abe2eb7f');

COMMIT;
