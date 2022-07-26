const fetch = require('node-fetch');

const auth = require('../auth/index.js');

const config = require('../../../config.js');

const {
    geovileApi,
    appParams
} = require('../constants.js');

function getValidBodyForApp(app, params) {
    let body = {};

    if (appParams[app]) {
        for (const appParam of appParams[app]) {
            if (params.hasOwnProperty(appParam)) {
                body[appParam] = params[appParam];
            }
        }
    }

    return body;
}

async function callAppApi(app, params, authToken) {
    if (!authToken) {
        authToken = await auth.getToken();
    }
    
    const response = await fetch(
        `${geovileApi}/apps/${app}`,
        {
            method: "post",
            headers: {
                "Authorization": `Bearer ${authToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(getValidBodyForApp(app, params))
        }
    )

    if (response.status === 202) {
        return await response.json();
    }
}

module.exports = {
    callAppApi,
    getValidBodyForApp
}