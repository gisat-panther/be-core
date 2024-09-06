const { assert } = require('chai');
const mapproxy = require('../../../../src/modules/map/mapproxy');

describe('modules/map/mapproxy', () => {
    it('getMapproxyYamlString', () => {
        const mapproxyYamlString = mapproxy.getMapproxyYamlString({
            services: {
                demo: {},
                wms: {
                    md: {
                        title: "MapProxy Example WMS"
                    }
                }
            },
            sources: {
                exampleSource: {
                    type: "wms",
                    req: {
                        url: "https://example.com/wms",
                        layers: "exampleLayer",
                        format: "image/tiff",
                        transparent: true
                    },
                    coverage: {
                        datasource: "/tmp/datasource.shp",
                        srs: "EPSG:4326"
                    },
                    supported_srs: ["EPSG:4326"]
                }
            },
            caches: {
                exampleCache: {
                    sources: ["exampleSource"],
                    grids: ["GLOBAL_WEBMERCATOR"],
                    meta_buffer: 256,
                    meta_size: [4, 4],
                    link_single_color_images: true,
                    image: {
                        format: "image/png",
                        mode: "RGBA",
                        transparent: true,
                        resampling_method: "nearest",
                        colors: 0
                    },
                    cache: {
                        type: "sqlite",
                        directory: "/tmp/cache/exampleCache",
                        tile_lock_dir: "/tmp/cache/exampleCache/lock"
                    }
                }
            },
            layers: [{
                name: "exampleLayer",
                title: "Example Layer",
                sources: ["exampleCache"]
            }]
        });

        const mapproxyYamlStringExpected =
            `globals:
  mapserver:
    binary: /usr/bin/mapserv
services:
  demo: {}
  wms:
    md:
      title: MapProxy Example WMS
sources:
  exampleSource:
    type: wms
    req:
      url: https://example.com/wms
      layers: exampleLayer
      format: image/tiff
      transparent: true
    coverage:
      datasource: /tmp/datasource.shp
      srs: EPSG:4326
    supported_srs:
      - EPSG:4326
caches:
  exampleCache:
    sources:
      - exampleSource
    grids:
      - GLOBAL_WEBMERCATOR
    meta_buffer: 256
    meta_size:
      - 4
      - 4
    link_single_color_images: true
    image:
      format: image/png
      mode: RGBA
      transparent: true
      resampling_method: nearest
      colors: 0
    cache:
      type: sqlite
      directory: /tmp/cache/exampleCache
      tile_lock_dir: /tmp/cache/exampleCache/lock
layers:
  - name: exampleLayer
    title: Example Layer
    sources:
      - exampleCache
`;

        assert.strictEqual(mapproxyYamlString, mapproxyYamlStringExpected);
    });
});