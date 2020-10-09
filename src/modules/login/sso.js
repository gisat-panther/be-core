const config = require('../../../config');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const _ = require('lodash/fp');
const db = require('../../db');
const info = require('./info');

/**
 * @typedef {Object} Provider
 * @property {string} name
 * @property {string} column
 */

const providers = {
    google: {
        name: 'google',
        column: 'googleId',
    },
    facebook: {
        name: 'facebook',
        column: 'facebookId',
    },
};

function firstRow(result) {
    return result.rows[0];
}

function findUserByProviderId({column}, id) {
    return db
        .query(`SELECT "key" FROM "user"."users" WHERE "${column}" = $1`, [id])
        .then(firstRow);
}

function setProviderIdToUser({column}, {id, email}) {
    return db
        .query(
            `
UPDATE
  "user"."users"
SET
  "${column}" = $1
WHERE
  "email" = $2
RETURNING
  "key"`,
            [id, email]
        )
        .then(firstRow);
}

function createUser({column}, {id, email}) {
    return db
        .query(
            `
INSERT INTO "user"."users"
  ("email", "${column}")
VALUES
  ($1, $2)
RETURNING "key"`,
            [email, id]
        )
        .then(firstRow);
}

async function asyncOr(fns) {
    for (let fn of fns) {
        const res = await fn();
        if (res) {
            return res;
        }
    }
}

function createUserWithProvider(provider, {id, email}) {
    return asyncOr([
        () => findUserByProviderId(provider, id),
        () => setProviderIdToUser(provider, {id, email}),
        () => createUser(provider, {id, email}),
    ]);
}

function createSsoHandler(plan) {
    return async function (request, response) {
        const data = {
            type: 'sso_response',
            data: await info.getWithToken(plan, request.ssoUser),
        };

        const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Logged in</title>
</head>
<body>
<script>
  window.opener.postMessage(${JSON.stringify(data)}, '*')
</script>
</body>
</html>`;

        response.status(200).send(html);
    };
}

/**
 * @param {Provider} provider
 * @param {{id: string, email: string}} user
 */
function validateProviderUser({name}, {id, email}) {
    if (id == null) {
        return Error(`User received from provider ${name} has no id.`);
    }

    if (email == null) {
        return Error(`User received from provider ${name} has no email.`);
    }
}

/**
 * @param {Provider} provider
 */
function createVerifyCallback(provider) {
    return async function (accessToken, refreshToken, profile, cb) {
        const id = profile.id;
        const email = _.get('value', _.first(profile.emails));
        const providerUser = {id, email};
        const violation = validateProviderUser(provider, providerUser);

        if (violation != null) {
            return cb(violation);
        }

        const userKey = await createUserWithProvider(provider, providerUser);

        if (userKey == null) {
            return cb(
                new Error(`Couldn't find user for provider ${provider.name}`)
            );
        }

        cb(null, userKey);
    };
}

function useGoogle(plan) {
    const googleConfig = config.sso.google;
    if (googleConfig.clientId == null && googleConfig.clientSecret == null) {
        return;
    }

    const provider = providers.google;

    passport.use(
        new GoogleStrategy(
            {
                clientID: googleConfig.clientId,
                clientSecret: googleConfig.clientSecret,
                callbackURL: `${config.url}/api/login/sso/${provider.name}`,
            },
            createVerifyCallback(provider)
        )
    );

    return {
        path: `/api/login/sso/${provider.name}`,
        method: 'get',
        swagger: {
            tags: ['login'],
        },
        middlewares: [
            passport.authenticate(provider.name, {
                scope: ['email'],
                session: false,
                assignProperty: 'ssoUser',
            }),
        ],
        handler: createSsoHandler(plan),
    };
}

function useFacebook(plan) {
    const facebookConfig = config.sso.facebook;
    if (facebookConfig.appId == null && facebookConfig.appSecret == null) {
        return;
    }

    const provider = providers.facebook;

    passport.use(
        new FacebookStrategy(
            {
                clientID: facebookConfig.appId,
                clientSecret: facebookConfig.appSecret,
                callbackURL: `${config.url}/api/login/sso/${provider.name}`,
                profileFields: ['email'],
            },
            createVerifyCallback(provider)
        )
    );

    return {
        path: `/api/login/sso/${provider.name}`,
        method: 'get',
        swagger: {
            tags: ['login'],
        },
        middlewares: [
            passport.authenticate(provider.name, {
                scope: ['email'],
                session: false,
                assignProperty: 'ssoUser',
            }),
        ],
        handler: createSsoHandler(plan),
    };
}

function createRouter(plan) {
    return [useGoogle(plan), useFacebook(plan)].filter((v) => v != null);
}

module.exports = {
    createRouter,
};
