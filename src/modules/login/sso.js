const config = require('../../../config');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const _ = require('lodash/fp');
const db = require('../../db');
const info = require('./info');

const providers = {
    google: {
        column: 'googleId',
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

function useGoogle(plan) {
    const googleConfig = config.sso.google;
    if (googleConfig.clientId == null && googleConfig.clientSecret == null) {
        return;
    }

    passport.use(
        new GoogleStrategy(
            {
                clientID: googleConfig.clientId,
                clientSecret: googleConfig.clientSecret,
                callbackURL: `${config.url}/api/login/sso/google`,
            },
            async function (accessToken, refreshToken, profile, cb) {
                const id = profile.id;
                const email = _.get('value', _.first(profile.emails));

                const userKey = await createUserWithProvider(providers.google, {
                    id,
                    email,
                });

                cb(null, userKey);
            }
        )
    );

    return {
        path: '/api/login/sso/google',
        method: 'get',
        swagger: {
            tags: ['login'],
        },
        middlewares: [
            passport.authenticate('google', {
                scope: ['email'],
                session: false,
                assignProperty: 'ssoUser',
            }),
        ],
        handler: async function (request, response) {
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
        },
    };
}

function createRouter(plan) {
    return [useGoogle(plan)].filter((v) => v != null);
}

module.exports = {
    createRouter,
};
