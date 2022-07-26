const fetch = require('node-fetch');

const { geovileApi } = require('../constants.js');

const config = require('../../../config.js');

async function getToken() {
    try {
        const response = await fetch(
            `${geovileApi}/auth/get_bearer_token`,
            {
                method: "post",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    client_id: config.projects.cure.auth.clientId,
                    client_secret: config.projects.cure.auth.clientSecret
                })
            }
        )

        const body = await response.json();

        return body.access_token;
    } catch (e) {
        return null;
    }
}

module.exports = {
    getToken
}