const yaml = require('yaml');

function getMapproxyYamlString({ services = {}, grids = {}, sources = {}, caches = {}, layers = [] } = {}) {
    const mapproxyConfig = {
        globals: {
            mapserver: {
                binary: "/usr/bin/mapserv",
                working_dir: "/home/mapproxy/conf"
            }
        }
    };

    if (Object.keys(services).length) {
        mapproxyConfig.services = {};
        Object.entries(services).forEach(([service, options]) => {
            mapproxyConfig.services[service] = options;
        });
    }

    if (Object.keys(grids).length) {
        mapproxyConfig.grids = {};
        Object.entries(grids).forEach(([grid, options]) => {
            mapproxyConfig.grids[grid] = options;
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

    return yaml.stringify(mapproxyConfig, { version: '1.1' });
}

function getMapproxySeedYamlString({ seeds = {}, coverages = {}, cleanups = {} }) {
    const mapproxyConfig = {
        seeds,
        cleanups,
        coverages
    };

    return yaml.stringify(mapproxyConfig, { version: '1.1' });
}

module.exports = {
    getMapproxyYamlString,
    getMapproxySeedYamlString
}