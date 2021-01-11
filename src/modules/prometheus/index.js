const pc = require('prom-client');
const cluster = require('cluster');

/**
 * @param {{app: import('express').Router}} options
 */
function init({app}) {
    pc.collectDefaultMetrics();
    if (!cluster.isMaster) {
        return;
    }

    const aggregatorRegistry = new pc.AggregatorRegistry();
    app.get('/metrics', async function (request, response) {
        try {
            const metrics = await aggregatorRegistry.clusterMetrics();
            response.set('Content-Type', aggregatorRegistry.contentType);
            response.send(metrics);
        } catch (e) {
            console.error(e);
            response.statusCode = 500;
            response.end();
        }
    });
}

module.exports = {
    init,
};
