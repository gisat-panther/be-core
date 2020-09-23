BEGIN;
-- groups:
-- guest: 52ddabec-d01a-49a0-bb4d-5ff931bd346e
-- user: e56f3545-57f5-44f9-9094-2750a69ef67e

TRUNCATE
    "user"."users",
    "user"."groups",
    "user"."permissions",
    "user"."userPermissions",
    "user"."groupPermissions",
    "dataSources"."dataSource",
    "dataSources"."attributeDataSource",
    "dataSources"."raster",
    "dataSources"."vector",
    "dataSources"."wms",
    "dataSources"."wmts",
    "metadata"."place",
    "metadata"."scope",
    "metadata"."attribute",
    "metadata"."period",
    "metadata"."style",
    "metadata"."layerTemplate",
    "metadata"."case",
    "relations"."spatialDataSourceRelation",
    "relations"."attributeDataSourceRelation"
    CASCADE;

INSERT INTO "user"."users"
    ("key", "email", "password", "phone", "name")
VALUES ('cad8ea0d-f95e-43c1-b162-0704bfc1d3f6', null, null, null, 'guest'),
       -- all have password: test
       ('7c5acddd-3625-46ef-90b3-82f829afb258', 'test@example.com',
        '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
       ('2bf6c1da-991a-4592-acc1-b10192db9363', 'testWithGroups@example.com',
        '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
       ('e2f5d20e-2784-4690-a3f0-339c60b04245', 'testWithPhone@example.com',
        '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', '+420123456789', null),
       ('3e3f4300-1336-4043-baa3-b65a025c2d83', 'testWithPermissions@example.com',
        '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
       -- this user should not have permissions with NOT NULL resourceKey
       ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', 'admin@example.com',
        '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
       -- this user should not have permissions with NULL resourceKey
       ('39ed471f-8383-4283-bb8a-303cb05cadef', 'specificPermsAdmin@example.com',
        '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null),
       -- this user should not have permissions with NULL resourceKey (for data endpoint testing purposes)
       ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'data@example.com',
        '$2a$04$iDjo0YV1HpIVGFqN1xFrUeuduvBdRs.o8HR5RVsRIz8OOLi/uOezS', null, null);

INSERT INTO "user"."groups"
    ("key", "name")
VALUES ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'guest'),
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
VALUES ('4e62ed9c-1e14-4321-a28c-a4b23bef5c8d', null, 'metadata', 'scopes', 'create'),
       ('5f863a7a-def2-4674-b519-6de4888da6cb', null, 'metadata', 'scopes', 'update'),
       ('820c4a94-9588-4926-8ba0-2df7abe2eb7f', null, 'metadata', 'scopes', 'delete'),
       ('a307e381-8c12-4d0e-9934-0d739cce7fa2', null, 'metadata', 'scopes', 'view'),

       ('c07dec24-781a-4033-9232-b69c26a8f01c', null, 'metadata', 'places', 'create'),
       ('b3a7299c-166a-42f9-809a-ef25266135cb', null, 'metadata', 'places', 'update'),
       ('6a7df854-4dc0-4093-b8a0-15e2e0a91ed0', null, 'metadata', 'places', 'delete'),
       ('d221213b-a956-43b6-989e-32b73bee90f6', null, 'metadata', 'places', 'view'),

       ('0da66083-77ad-4e66-9338-0c8344de9eba', null, 'metadata', 'cases', 'create'),
       ('42e8bdf8-19c8-4658-aded-b1c724539072', null, 'metadata', 'cases', 'update'),
       ('a739d64e-fb9e-44dc-8d2c-a2a287d302ee', null, 'metadata', 'cases', 'delete'),
       ('7d80f451-4ef9-4d09-beaa-576bc85375d2', null, 'metadata', 'cases', 'view'),

       ('f011a16a-63d7-4e43-acd3-547b0ecbe86c', null, 'metadata', 'periods', 'create'),
       ('b2c85f7f-f39d-47de-8156-e7a45c103a56', null, 'metadata', 'periods', 'update'),
       ('50e85aa0-b1c8-41ab-ad70-f56813ac06e9', null, 'metadata', 'periods', 'delete'),
       ('0cc99d81-8038-49a0-8f3a-b5bd55b94513', null, 'metadata', 'periods', 'view'),

       ('38500369-7da1-4fcc-a934-348ebb3ffc60', null, 'metadata', 'attributes', 'create'),
       ('41e9ab01-9bd3-4071-b710-c0e83748d7b9', null, 'metadata', 'attributes', 'update'),
       ('80ecec9c-3597-436d-a0f7-53ac19e4e788', null, 'metadata', 'attributes', 'delete'),
       ('402dd14a-db75-4aa6-b173-3dc360f1158e', null, 'metadata', 'attributes', 'view'),

       ('7d27260c-a8d6-45ec-b7f6-3995b9e19524', null, 'metadata', 'layerTemplates', 'create'),
       ('6c6e577b-0236-42c8-a379-05b9799fd79e', null, 'metadata', 'layerTemplates', 'update'),
       ('e1e52402-cb0f-4bdf-ac4a-831d684438c4', null, 'metadata', 'layerTemplates', 'delete'),
       ('6f4c6d5c-04f4-4dda-a831-30837e773f01', null, 'metadata', 'layerTemplates', 'view'),

       ('7b30f7be-98fa-40a0-b7aa-a7d0469864e6', null, 'metadata', 'styles', 'create'),
       ('e2c90e19-705e-4d02-a618-92a7ed2d51cd', null, 'metadata', 'styles', 'update'),
       ('26dcdc6a-bb92-4ec1-bbe9-dc507f064e1d', null, 'metadata', 'styles', 'delete'),
       ('33d976c6-43b2-46f7-9a8d-41a2535860a8', null, 'metadata', 'styles', 'view'),

       ('6897b1fc-a3e3-4195-a41a-f492d4a9df2a', null, 'user', 'users', 'create'),
       ('913e3bae-e5dd-4600-a854-ca7b65199bbf', null, 'user', 'users', 'update'),
       ('9ac648e7-00d0-4196-be44-9ae2d7cfb598', null, 'user', 'users', 'delete'),
       ('828af8c1-5438-475b-9f91-af432745e83f', null, 'user', 'users', 'view'),

       ('9d2b52c0-ced8-4a3c-b5ae-ea97befd3305', null, 'dataSources', 'spatial', 'create'),
       ('2f8f7e58-2c55-4c06-90c6-a5a164c3f1f1', null, 'dataSources', 'spatial', 'update'),
       ('92901779-f29f-44a3-ab05-2a22b6a94848', null, 'dataSources', 'spatial', 'delete'),
       ('d116a380-4cf2-4241-9b88-3c0488848a05', null, 'dataSources', 'spatial', 'view'),

       ('af856c50-fe8d-49ef-9896-629d10105a10', null, 'dataSources', 'attribute', 'create'),
       ('332a65ce-1ba8-4e87-82c2-af26851c007c', null, 'dataSources', 'attribute', 'update'),
       ('17faa1b0-7097-49bd-92c3-176c6cff8b40', null, 'dataSources', 'attribute', 'delete'),
       ('4f12d173-48ec-45b6-b134-57a1928156c3', null, 'dataSources', 'attribute', 'view'),

       ('5609b0da-6fac-4b47-ab88-b12f97114bdf', null, 'relations', 'attribute', 'create'),
       ('10061997-2e64-4dd9-b645-28eb5f937f65', null, 'relations', 'attribute', 'update'),
       ('0585eda7-de9e-4aab-8f47-1c1085804054', null, 'relations', 'attribute', 'delete'),
       ('4f617ffb-86ff-4f38-84b6-ea016afcbaa3', null, 'relations', 'attribute', 'view'),

       ('c93dade9-2b6a-4657-8456-a32479c934d8', null, 'relations', 'spatial', 'create'),
       ('7ac8b606-c69d-4fd2-807a-f0c21f3b798b', null, 'relations', 'spatial', 'update'),
       ('196be2a8-70fb-47ec-a22d-743b2437877e', null, 'relations', 'spatial', 'delete'),
       ('413a1a4c-ef1a-43aa-b93f-f5309dbab2e2', null, 'relations', 'spatial', 'view'),

       ('f2ead234-6402-4a6e-9374-b243647edc44', '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8', 'user', 'user', 'view'),
       ('4f2b3dc7-9b3f-4624-82c0-93d139e19baa', '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8', 'user', 'user', 'update'),
       ('e84dfa30-f2fc-4a1f-988c-b7f4e2489f2f', '8b162b2f-44ee-47a4-af6c-0bbc882b6bb8', 'user', 'user', 'delete'),
       ('432348bc-6adf-4fd3-ac44-48a15f7d8ac6', '7c5acddd-3625-46ef-90b3-82f829afb258', 'user', 'user', 'view');

INSERT INTO "user"."userPermissions"
    ("userKey", "permissionKey")
VALUES
    -- testWithPermissions@example.com     ,  case:create
    ('3e3f4300-1336-4043-baa3-b65a025c2d83', '0da66083-77ad-4e66-9338-0c8344de9eba'),
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
    -- user: admin@example.com             , relations.spatial:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '413a1a4c-ef1a-43aa-b93f-f5309dbab2e2'),
    -- user: specificPermsAdmin@example.com, users[key]:update
    ('39ed471f-8383-4283-bb8a-303cb05cadef', '4f2b3dc7-9b3f-4624-82c0-93d139e19baa'),
    -- user: specificPermsAdmin@example.com, users[key]:delete
    ('39ed471f-8383-4283-bb8a-303cb05cadef', 'e84dfa30-f2fc-4a1f-988c-b7f4e2489f2f'),
    -- user: specificPermsAdmin@example.com, users[key]:view
    ('39ed471f-8383-4283-bb8a-303cb05cadef', '432348bc-6adf-4fd3-ac44-48a15f7d8ac6'),
    ('39ed471f-8383-4283-bb8a-303cb05cadef', 'f2ead234-6402-4a6e-9374-b243647edc44'),
    -- user: admin@example.com             , metadata:scope:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', 'a307e381-8c12-4d0e-9934-0d739cce7fa2'),
    -- user: admin@example.com             , metadata:period:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '0cc99d81-8038-49a0-8f3a-b5bd55b94513'),
    -- user: admin@example.com             , metadata:style:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '33d976c6-43b2-46f7-9a8d-41a2535860a8'),
    -- user: admin@example.com             , dataSources:attribute:view
    ('2d069e3a-f77f-4a1f-aeda-50fd06c8c35d', '4f12d173-48ec-45b6-b134-57a1928156c3'),
    -- user: data@example.com
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '4e62ed9c-1e14-4321-a28c-a4b23bef5c8d'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '5f863a7a-def2-4674-b519-6de4888da6cb'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '820c4a94-9588-4926-8ba0-2df7abe2eb7f'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'a307e381-8c12-4d0e-9934-0d739cce7fa2'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'c07dec24-781a-4033-9232-b69c26a8f01c'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'b3a7299c-166a-42f9-809a-ef25266135cb'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '6a7df854-4dc0-4093-b8a0-15e2e0a91ed0'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'd221213b-a956-43b6-989e-32b73bee90f6'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '0da66083-77ad-4e66-9338-0c8344de9eba'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '42e8bdf8-19c8-4658-aded-b1c724539072'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'a739d64e-fb9e-44dc-8d2c-a2a287d302ee'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '7d80f451-4ef9-4d09-beaa-576bc85375d2'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'f011a16a-63d7-4e43-acd3-547b0ecbe86c'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'b2c85f7f-f39d-47de-8156-e7a45c103a56'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '50e85aa0-b1c8-41ab-ad70-f56813ac06e9'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '0cc99d81-8038-49a0-8f3a-b5bd55b94513'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '38500369-7da1-4fcc-a934-348ebb3ffc60'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '41e9ab01-9bd3-4071-b710-c0e83748d7b9'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '80ecec9c-3597-436d-a0f7-53ac19e4e788'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '402dd14a-db75-4aa6-b173-3dc360f1158e'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '7d27260c-a8d6-45ec-b7f6-3995b9e19524'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '6c6e577b-0236-42c8-a379-05b9799fd79e'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'e1e52402-cb0f-4bdf-ac4a-831d684438c4'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '6f4c6d5c-04f4-4dda-a831-30837e773f01'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '7b30f7be-98fa-40a0-b7aa-a7d0469864e6'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'e2c90e19-705e-4d02-a618-92a7ed2d51cd'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '26dcdc6a-bb92-4ec1-bbe9-dc507f064e1d'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '33d976c6-43b2-46f7-9a8d-41a2535860a8'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '6897b1fc-a3e3-4195-a41a-f492d4a9df2a'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '913e3bae-e5dd-4600-a854-ca7b65199bbf'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '9ac648e7-00d0-4196-be44-9ae2d7cfb598'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '828af8c1-5438-475b-9f91-af432745e83f'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '9d2b52c0-ced8-4a3c-b5ae-ea97befd3305'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '2f8f7e58-2c55-4c06-90c6-a5a164c3f1f1'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '92901779-f29f-44a3-ab05-2a22b6a94848'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'd116a380-4cf2-4241-9b88-3c0488848a05'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'af856c50-fe8d-49ef-9896-629d10105a10'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '332a65ce-1ba8-4e87-82c2-af26851c007c'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '17faa1b0-7097-49bd-92c3-176c6cff8b40'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '4f12d173-48ec-45b6-b134-57a1928156c3'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '5609b0da-6fac-4b47-ab88-b12f97114bdf'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '10061997-2e64-4dd9-b645-28eb5f937f65'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '4f617ffb-86ff-4f38-84b6-ea016afcbaa3'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '0585eda7-de9e-4aab-8f47-1c1085804054'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', 'c93dade9-2b6a-4657-8456-a32479c934d8'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '7ac8b606-c69d-4fd2-807a-f0c21f3b798b'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '196be2a8-70fb-47ec-a22d-743b2437877e'),
    ('80a01a05-0f23-4dc6-82c6-c811d37413aa', '413a1a4c-ef1a-43aa-b93f-f5309dbab2e2');

INSERT INTO "user"."groupPermissions"
    ("groupKey", "permissionKey")
VALUES
    -- test                                , case:update
    ('742b6f3f-a77e-4267-8e96-1e4cea96dec3', '42e8bdf8-19c8-4658-aded-b1c724539072'),
    -- guest                               , case:update
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '42e8bdf8-19c8-4658-aded-b1c724539072'),
    -- test                                , scope:delete
    ('742b6f3f-a77e-4267-8e96-1e4cea96dec3', '820c4a94-9588-4926-8ba0-2df7abe2eb7f'),
    -- guest - same as for data@example.com
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '4e62ed9c-1e14-4321-a28c-a4b23bef5c8d'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '5f863a7a-def2-4674-b519-6de4888da6cb'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '820c4a94-9588-4926-8ba0-2df7abe2eb7f'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'a307e381-8c12-4d0e-9934-0d739cce7fa2'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'c07dec24-781a-4033-9232-b69c26a8f01c'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'b3a7299c-166a-42f9-809a-ef25266135cb'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '6a7df854-4dc0-4093-b8a0-15e2e0a91ed0'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'd221213b-a956-43b6-989e-32b73bee90f6'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '0da66083-77ad-4e66-9338-0c8344de9eba'),
    -- ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '42e8bdf8-19c8-4658-aded-b1c724539072'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'a739d64e-fb9e-44dc-8d2c-a2a287d302ee'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '7d80f451-4ef9-4d09-beaa-576bc85375d2'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'f011a16a-63d7-4e43-acd3-547b0ecbe86c'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'b2c85f7f-f39d-47de-8156-e7a45c103a56'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '50e85aa0-b1c8-41ab-ad70-f56813ac06e9'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '0cc99d81-8038-49a0-8f3a-b5bd55b94513'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '38500369-7da1-4fcc-a934-348ebb3ffc60'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '41e9ab01-9bd3-4071-b710-c0e83748d7b9'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '80ecec9c-3597-436d-a0f7-53ac19e4e788'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '402dd14a-db75-4aa6-b173-3dc360f1158e'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '7d27260c-a8d6-45ec-b7f6-3995b9e19524'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '6c6e577b-0236-42c8-a379-05b9799fd79e'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'e1e52402-cb0f-4bdf-ac4a-831d684438c4'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '6f4c6d5c-04f4-4dda-a831-30837e773f01'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '7b30f7be-98fa-40a0-b7aa-a7d0469864e6'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'e2c90e19-705e-4d02-a618-92a7ed2d51cd'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '26dcdc6a-bb92-4ec1-bbe9-dc507f064e1d'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '33d976c6-43b2-46f7-9a8d-41a2535860a8'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '6897b1fc-a3e3-4195-a41a-f492d4a9df2a'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '913e3bae-e5dd-4600-a854-ca7b65199bbf'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '9ac648e7-00d0-4196-be44-9ae2d7cfb598'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '828af8c1-5438-475b-9f91-af432745e83f'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '9d2b52c0-ced8-4a3c-b5ae-ea97befd3305'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '2f8f7e58-2c55-4c06-90c6-a5a164c3f1f1'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '92901779-f29f-44a3-ab05-2a22b6a94848'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'd116a380-4cf2-4241-9b88-3c0488848a05'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'af856c50-fe8d-49ef-9896-629d10105a10'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '332a65ce-1ba8-4e87-82c2-af26851c007c'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '17faa1b0-7097-49bd-92c3-176c6cff8b40'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '4f12d173-48ec-45b6-b134-57a1928156c3'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '5609b0da-6fac-4b47-ab88-b12f97114bdf'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '10061997-2e64-4dd9-b645-28eb5f937f65'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '4f617ffb-86ff-4f38-84b6-ea016afcbaa3'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '0585eda7-de9e-4aab-8f47-1c1085804054'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', 'c93dade9-2b6a-4657-8456-a32479c934d8'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '7ac8b606-c69d-4fd2-807a-f0c21f3b798b'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '196be2a8-70fb-47ec-a22d-743b2437877e'),
    ('52ddabec-d01a-49a0-bb4d-5ff931bd346e', '413a1a4c-ef1a-43aa-b93f-f5309dbab2e2');

DROP TABLE IF EXISTS "public"."exampleSpatialAttributeData";

CREATE TABLE IF NOT EXISTS "public"."exampleSpatialAttributeData"
(
    key        uuid DEFAULT public.gen_random_uuid() NOT NULL,
    geometry   GEOMETRY,
    attribute1 TEXT,
    attribute2 INT
);

INSERT INTO "public"."exampleSpatialAttributeData"
    ("geometry", "attribute1", "attribute2")
VALUES (ST_GeomFromText(
                'POLYGON((14.224435 50.17743, 14.706787 50.17743, 14.706787 49.941901, 14.224435 49.941901, 14.224435 50.17743))',
                4326), 'praha-wkt-bbox', 1),
       (ST_GeomFromText(
                'POLYGON((16.42799 49.294371, 16.727835 49.294371, 16.727835 49.10988, 16.42799 49.10988, 16.42799 49.294371))',
                4326), 'brno-wkt-bbox', 2);

INSERT INTO "metadata"."scope"
    ("key", "nameDisplay")
VALUES ('c67eaa05-64e0-4b60-8552-7adb4962e93a', 'Scope');

INSERT INTO "metadata"."period"
    ("key", "nameDisplay")
VALUES ('6eca6523-0756-49cb-b39d-405dcafd2386', '2020');

INSERT INTO "metadata"."attribute"
    ("key", "nameDisplay")
VALUES ('f9f6dc0d-4b6a-4794-9243-5948d920239c', 'attribute1'),
       ('3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc', 'attribute2');

INSERT INTO "dataSources".vector
    ("key", "tableName", "fidColumnName", "geometryColumnName")
VALUES ('75d88ed5-6ad0-4ddd-a9f6-b03b60ea7dcb', 'exampleSpatialAttributeData', 'key', 'geometry');

INSERT INTO "dataSources"."dataSource"
    ("key", "type", "sourceKey")
VALUES ('cf55212e-2893-46d0-8a02-cbf10cb4471d', 'vector', '75d88ed5-6ad0-4ddd-a9f6-b03b60ea7dcb');

INSERT INTO "dataSources"."attributeDataSource"
    ("key", "tableName", "columnName", "fidColumnName")
VALUES ('7c11916a-20f4-4c6b-99a8-8b95bd1ec041', 'exampleSpatialAttributeData', 'attribute1', 'key'),
       ('d0329b4c-5214-4aea-8291-bc7443b643e7', 'exampleSpatialAttributeData', 'attribute2', 'key');

INSERT INTO "metadata"."layerTemplate"
    ("key", "nameDisplay")
VALUES ('b8cb9263-d656-4606-a326-a02e851ea0bb', 'exampleLayer');

INSERT INTO "relations"."spatialDataSourceRelation"
    ("scopeKey", "periodKey", "spatialDataSourceKey", "layerTemplateKey")
VALUES ('c67eaa05-64e0-4b60-8552-7adb4962e93a', '6eca6523-0756-49cb-b39d-405dcafd2386',
        'cf55212e-2893-46d0-8a02-cbf10cb4471d', 'b8cb9263-d656-4606-a326-a02e851ea0bb');

INSERT INTO "relations"."attributeDataSourceRelation"
("scopeKey", "periodKey", "attributeDataSourceKey", "attributeKey", "layerTemplateKey")
VALUES ('c67eaa05-64e0-4b60-8552-7adb4962e93a', '6eca6523-0756-49cb-b39d-405dcafd2386',
        '7c11916a-20f4-4c6b-99a8-8b95bd1ec041', 'f9f6dc0d-4b6a-4794-9243-5948d920239c',
        'b8cb9263-d656-4606-a326-a02e851ea0bb'),
       ('c67eaa05-64e0-4b60-8552-7adb4962e93a', '6eca6523-0756-49cb-b39d-405dcafd2386',
        'd0329b4c-5214-4aea-8291-bc7443b643e7', '3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc',
        'b8cb9263-d656-4606-a326-a02e851ea0bb');

INSERT INTO "metadata"."style"
    ("key", "definition")
VALUES ('492339a4-9a27-43ac-abf4-34f53b626a76', '{
    "rules": [
        {
            "styles": [
                {
                    "attributeKey": "f9f6dc0d-4b6a-4794-9243-5948d920239c"
                },
                {
                    "attributeKey": "3e5c7002-e2a3-4fb5-b2eb-ddfd81751ecc"
                }
            ]
        },
        {
            "styles": [
                {},
                {}
            ]
        }
    ]
}');

COMMIT;
