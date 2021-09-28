const chai = require('chai');
const { assert } = chai;
const fetch = require('node-fetch');

const db = require('../../../../src/db');
const product = require('../../product');
const config = require('../../../../config');

const USER = {
    admin: '3fdd158d-4b78-4d11-92c7-403b4adab4d8',
    regular: '4fc1d704-b2e5-4fb7-839a-5baf3ad494ee'
};

const exampleProduct = {
    name: "Argentina",
    id: "2020_21HTC_annualcropland_classification_WorldCerealPixelLSTM",
    sos: "2020-06-15",
    eos: "2020-09-15",
    season: "summer1",
    aez_id: "1",
    geometry: {
        type: "Polygon",
        coordinates: [
            [
                [
                    -60.787353515625,
                    -34.74612627525939
                ],
                [
                    -58.53515625,
                    -34.74612627525939
                ],
                [
                    -58.53515625,
                    -32.930318199070534
                ],
                [
                    -60.787353515625,
                    -32.930318199070534
                ],
                [
                    -60.787353515625,
                    -34.74612627525939
                ]
            ]
        ]
    },
    meta: [
        "reference_id"
    ],
    product: "annualcropland",
    type: "map",
    public: false,
    tiles: [
        {
            tile: "21HTC",
            path: "https: //gisat-gis.eu-central-1.linodeobjects.com/worldcereal/example/21HTC/2020_21HTC_annualcropland_classification_WorldCerealPixelLSTM.tif"
        },
        {
            tile: "22LHQ",
            path: "https: //gisat-gis.eu-central-1.linodeobjects.com/worldcereal/example/22LHQ/2020_22LHQ_annualcropland_classification_WorldCerealPixelLSTM.tif"
        }
    ],
    related_products: [
        "2020_21HTC_annualcropland_confidence_WorldCerealPixelLSTM",
        "2020_21HTC_annualcropland_metafeatures_WorldCerealPixelLSTM"
    ]
};

const exampleUsers = {
    user1: {
        key: "624d36dd-32d7-445f-93f5-893bca55471a",
        data: {
            email: "exampleWorldCerealUser@example.com",
            name: "Example WorldCereal User"
        }
    },
    user2: {
        key: "f9cbf921-470a-4b93-a707-74080588afd9",
        data: {
            email: "exampleWorldCerealUser2@example.com",
            name: "Example WorldCereal User 2"
        }
    }
}

function url(path) {
    return 'http://localhost:' + config.masterPort + path;
}

/**
    Workflow steps
        - Non-existing user tries to create product
        - Admin user creates two regular users
        - First regular user creates private product
        - First regular user obtains private product
        - Second regular user fail to obrain private product of first user
        - First regular user update product and set it as public
        - Second regular user obtain public product of first regular user
        - Second regular user try to delete public product of first regular user and fail
        - First regular user delete product
        - Admin user remove both regular users
 */

describe("Workflow", () => {
    before(async () => {
        await db
            .init();
    });

    after(async () => {
        await db
            .query(`
                BEGIN;
                DELETE FROM "user".users WHERE "key" = '${exampleUsers.user1.key}';
                DELETE FROM "user".users WHERE "key" = '${exampleUsers.user2.key}';
                DELETE FROM "specific"."worldCerealProductMetadata" WHERE "key" = '${product.getKeyByProductId(exampleProduct)}';
                DELETE FROM "user"."permissions" WHERE "resourceKey" = '${product.getKeyByProductId(exampleProduct)}';
                COMMIT;
            `);
    });

    it("Non-existing user tries to create product", async () => {
        const request = {
            method: "POST",
            headers: new fetch.Headers({
                "X-User-Info": "4c4844cc-76e0-47f0-8edc-29cddfc87cc0",
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(exampleProduct)
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product"),
            request
        );

        assert.strictEqual(response.status, 403);
    })

    it("Admin user creates first regular user", async () => {
        const request = {
            method: "POST",
            headers: new fetch.Headers({
                "X-User-Info": USER.admin,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(exampleUsers.user1)
        };

        const response = await fetch(
            url("/rest/project/worldCereal/user"),
            request
        );

        assert.strictEqual(response.status, 201);
    });

    it("Admin user creates second regular user", async () => {
        const request = {
            method: "POST",
            headers: new fetch.Headers({
                "X-User-Info": USER.admin,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(exampleUsers.user2)
        };

        const response = await fetch(
            url("/rest/project/worldCereal/user"),
            request
        );

        assert.strictEqual(response.status, 201);
    });

    it("First regular user creates private product", async () => {
        const request = {
            method: "POST",
            headers: new fetch.Headers({
                "X-User-Info": exampleUsers.user1.key,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(exampleProduct)
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product"),
            request
        );

        assert.strictEqual(response.status, 201);
    });

    it("First regular user obtain its own product", async () => {
        const request = {
            method: "POST",
            headers: new fetch.Headers({
                "X-User-Info": exampleUsers.user1.key,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({ key: product.getKeyByProductId(exampleProduct) })
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product/filtered"),
            request
        );

        assert.strictEqual(response.status, 200);

        const data = await response.json();

        assert.isAtLeast(data.products.length, 1);

        assert.strictEqual(data.products[0].key, product.getKeyByProductId(exampleProduct));
    });

    it("Second regular user fail to obtain private product of first regular user", async () => {
        const request = {
            method: "POST",
            headers: new fetch.Headers({
                "X-User-Info": exampleUsers.user2.key,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({ key: product.getKeyByProductId(exampleProduct) })
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product/filtered"),
            request
        );

        assert.strictEqual(response.status, 200);

        const data = await response.json();

        assert.strictEqual(data.products.length, 0);
    });

    it("First regular user update product and set it as public", async () => {
        const request = {
            method: "PUT",
            headers: new fetch.Headers({
                "X-User-Info": exampleUsers.user1.key,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({
                ...exampleProduct,
                public: true
            })
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product"),
            request
        );

        assert.strictEqual(response.status, 200);
    });

    it("Second regular user obtain public product of first regular user", async () => {
        const request = {
            method: "POST",
            headers: new fetch.Headers({
                "X-User-Info": exampleUsers.user2.key,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({ key: product.getKeyByProductId(exampleProduct) })
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product/filtered"),
            request
        );

        assert.strictEqual(response.status, 200);

        const data = await response.json();

        assert.isAtLeast(data.products.length, 1);

        assert.strictEqual(data.products[0].key, product.getKeyByProductId(exampleProduct));
    });

    it("Second regular user try to delete public product of first regular user and fail", async () => {
        const request = {
            method: "DELETE",
            headers: new fetch.Headers({
                "X-User-Info": exampleUsers.user2.key,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(exampleProduct)
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product"),
            request
        );

        assert.strictEqual(response.status, 403);
    })

    it("First regular user delete product", async () => {
        const request = {
            method: "DELETE",
            headers: new fetch.Headers({
                "X-User-Info": exampleUsers.user1.key,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify(exampleProduct)
        };

        const response = await fetch(
            url("/rest/project/worldCereal/product"),
            request
        );

        assert.strictEqual(response.status, 200);
    })

    it("Admin user delete first regular user", async () => {
        const request = {
            method: "DELETE",
            headers: new fetch.Headers({
                "X-User-Info": USER.admin,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({ key: exampleUsers.user1.key })
        };

        const response = await fetch(
            url("/rest/project/worldCereal/user"),
            request
        );

        assert.strictEqual(response.status, 200);
    });

    it("Admin user delete second regular user", async () => {
        const request = {
            method: "DELETE",
            headers: new fetch.Headers({
                "X-User-Info": USER.admin,
                "Content-Type": "application/json"
            }),
            body: JSON.stringify({ key: exampleUsers.user2.key })
        };

        const response = await fetch(
            url("/rest/project/worldCereal/user"),
            request
        );

        assert.strictEqual(response.status, 200);
    });
})