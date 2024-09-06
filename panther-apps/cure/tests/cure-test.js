const chai = require('chai');
const auth = require('../auth/index.js');
const handler = require('../handler.js');
const services = require('../services/index.js');

describe("auth", () => {
    it("should return bearer access token as a string", async () => {
        const token = await auth.getToken();
        chai.expect(token).to.be.a("string");
    })
})

describe("order service", () => {
    it("app8", async () => {
        const order = await handler.executeOrder({realKey: "453f3756-ac4c-4fed-b442-b8aa16f8abe5"}, {app: "app8", city: "Copenhagen"});
        chai.expect(order).to.be.a("object");
    })

    it("body parser", () => {
        const body = services.getValidBodyForApp("app8", {app: "app8", city: "Copenhagen"})
        chai.expect(body).to.be.a("object");
    })
})