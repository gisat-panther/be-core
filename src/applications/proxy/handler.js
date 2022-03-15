const http = require('http');

const restHandler = require('../../modules/rest/handler');

const config = require('../../../config.js');

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

                        console.log(query.toString());

                        http
                            .get(
                                `${config.mapproxy.url}/${dataSourceConfiguration.mapproxy.instance}/service?${query.toString()}`,
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