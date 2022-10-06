const http = require('http');
const https = require('https');
const xmljs = require('xml-js');

const restHandler = require('../../modules/rest/handler');
const cache = require('./cache');

const config = require('../../../config.js');

function updateObjectWith(object, modifier) {
    Object.entries(object).forEach(([property, value]) => {
        if (typeof value === "object") {
            updateObjectWith(value, modifier);
        } else {
            object[property] = modifier(property, value) || value;
        }
    })

    return object;
}

async function getSpatialDataSourceByKeyAndUser(spatialDataSourceKey, user) {
    const userKey = user.realKey;
    const cacheKey = `${userKey}-${spatialDataSourceKey}`;

    let spatialDataSource = await cache.get(cacheKey);

    if (!spatialDataSource) {
        await restHandler
            .list('dataSources', {
                params: { types: 'spatial' },
                user: user,
                body: {
                    filter: {
                        key: spatialDataSourceKey,
                        type: "wms"
                    }
                }
            })
            .then(async (list) => {
                if (list.type && list.type === "success" && list.data.data.spatial.length === 1) {
                    spatialDataSource = list.data.data.spatial[0];
                    await cache.set(cacheKey, spatialDataSource, 3600);
                }
            });
    }

    return spatialDataSource;
}

function getWms(request, response) {
    getSpatialDataSourceByKeyAndUser(request.params.spatialDataSourceKey, request.user)
        .then((spatialDataSource) => {
            if (spatialDataSource) {
                const query = new URLSearchParams(request.query);

                if (!spatialDataSource.data.configuration.mapproxy) {
                    throw new Error();
                }

                const dataSourceConfiguration = spatialDataSource.data.configuration;

                (config.mapproxy.url.toLowerCase().startsWith("https") ? https : http)
                    .get(
                        `${config.mapproxy.url}/${dataSourceConfiguration.mapproxy.instance}/service?${query.toString()}`,
                        (subResponse) => {
                            for (const header of Object.keys(subResponse.headers)) {
                                response.set(header, subResponse.headers[header]);
                            }

                            if ((request.query.REQUEST || request.query.request) && (request.query.REQUEST || request.query.request).toLowerCase() === "getcapabilities") {
                                let rawData = "";
                                subResponse.on("data", (chunk) => rawData += chunk);
                                subResponse.on("end", () => {
                                    const requestUrl = new URL(`${request.protocol}://${request.get("host")}${request.originalUrl}`);
                                    const updated = updateObjectWith(
                                        xmljs.xml2js(rawData),
                                        (property, value) => {
                                            if (property === "xlink:href" && value.includes(`/${dataSourceConfiguration.mapproxy.instance}`)) {
                                                return `${config.url}${requestUrl.pathname}?`;
                                            }
                                        }
                                    )
                                    response.send(xmljs.js2xml(updated));
                                })
                            } else {
                                subResponse.pipe(response)
                            }
                        }
                    );
            } else {
                throw new Error();
            }
        }).catch((error) => {
            console.log(error);
            response.status(401).end();
        })
}

function getWmts(request, response) {
    restHandler
        .list('dataSources', {
            params: { types: 'spatial' },
            user: request.user,
            body: {
                filter: {
                    key: request.params.spatialDataSourceKey,
                    type: "wmts"
                }
            }
        })
        .then((list) => {
            return Promise
                .resolve()
                .then(() => {
                    if (list.type && list.type === "success" && list.data.data.spatial.length === 1) {
                        const dataSource = list.data.data.spatial[0];

                        if (!dataSource.data.configuration.mapproxy) {
                            throw new Error();
                        }

                        const dataSourceConfiguration = dataSource.data.configuration;

                        http
                            .get(
                                `${config.mapproxy.url}/${dataSourceConfiguration.mapproxy.instance}/wmts/${dataSourceConfiguration.mapproxy.layer}/${dataSourceConfiguration.mapproxy.grid}/${request.params.z}/${request.params.x}/${request.params.y}.${request.params.ext}`,
                                (subResponse) => {
                                    subResponse.pipe(response)
                                }
                            );
                    } else {
                        throw new Error();
                    }
                })

        })
        .catch((error) => {
            console.log(error);
            response.status(401).end();
        })
}

module.exports = {
    get: {
        wms: getWms,
        wmts: getWmts
    }
}