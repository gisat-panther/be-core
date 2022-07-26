
const Joi = require('joi');

const db = require('../db/index.js');
const security = require('../../../src/security.js');

async function register(params) {
    const paramsSchema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    });

    const validatedParams = paramsSchema.validate(params);

    if (!validatedParams.error) {
        const passwordHash = await security.hashPassword(validatedParams.value.password);
        return db.createUser(validatedParams.value.email, passwordHash);
    }
}

module.exports = {
    register
}