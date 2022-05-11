const yaml = require('yaml');

function getMapproxyYamlString({services = {}, sources = {}, caches = {}, layers = [], demo = false} = {}) {
    const mapproxyConfig = {
        globals: {
            mapserver: {
                binary: "/usr/bin/mapserv"
            }
        }
    };

    if (Object.keys(services).length) {
        mapproxyConfig.services = {};
        Object.entries(services).forEach(([service, options]) => {
            mapproxyConfig.services[service] = options;
        });
    }

    if (Object.keys(sources).length) {
        mapproxyConfig.sources = {};
        Object.entries(sources).forEach(([source, options]) => {
            mapproxyConfig.sources[source] = options
        });
    }

    if (Object.keys(caches).length) {
        mapproxyConfig.caches = {};
        Object.entries(caches).forEach(([cache, options]) => {
            mapproxyConfig.caches[cache] = options;
        })
    }

    if (layers.length) {
        mapproxyConfig.layers = layers;
    }

    return yaml.stringify(mapproxyConfig);
}

module.exports = {
    getMapproxyYamlString
}