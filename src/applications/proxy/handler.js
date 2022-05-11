const http = require('http');
const xmljs = require('xml-js');

const restHandler = require('../../modules/rest/handler');

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

function getWms(request, response) {
    restHandler
        .list('dataSources', {
            params: { types: 'spatial' },
            user: request.user,
            body: {
                filter: {
                    key: request.params.spatialDataSourceKey,
                    type: "wms"
                }
            }
        })
        .then((list) => {
            return Promise
                .resolve()
                .then(() => {
                    if (list.type && list.type === "success" && list.data.data.spatial.length === 1) {
                        const dataSource = list.data.data.spatial[0];
                        const query = new URLSearchParams(request.query);

                        if (!dataSource.data.configuration.mapproxy) {
                            throw new Error();
                        }

                        const dataSourceConfiguration = dataSource.data.configuration;

                        http
                            .get(
                                `${config.mapproxy.url}/${dataSourceConfiguration.mapproxy.instance}/service?${query.toString()}`,
                                (subResponse) => {

                                    if ((request.query.REQUEST || request.query.request).toLowerCase() === "getcapabilities") {
                                        const contentType = subResponse.headers['content-type'];
                                        let rawData = "";
                                        subResponse.on("data", (chunk) => rawData += chunk);
                                        subResponse.on("end", () => {
                                            const requestUrl = new URL(`${request.protocol}://${request.get("host")}${request.originalUrl}`);
                                            const updated = updateObjectWith(
                                                xmljs.xml2js(rawData),
                                                (property, value) => {
                                                    if (value === `${config.mapproxy.url}/${dataSourceConfiguration.mapproxy.instance}/service?`) {
                                                        return `${requestUrl.origin}${requestUrl.pathname}?`;
                                                    }
                                                }
                                            )
                                            response.set("Content-Type", contentType);
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
                })

        })
        .catch((error) => {
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