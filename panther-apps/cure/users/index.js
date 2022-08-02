
const Joi = require('joi');

const db = require('../db/index.js');
const security = require('../../../src/security.js');

const { groupKeys } = require('../constants.js');

async function register(params) {
    const paramsSchema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    });

    const validatedParams = paramsSchema.validate(params);

    if (!validatedParams.error) {
        const passwordHash = await security.hashPassword(validatedParams.value.password);
        const userKey = await db.createUser(validatedParams.value.email, passwordHash);
        return await db.assingUserToGroups(userKey, groupKeys);
    }
}

module.exports = {
    register
}