const { assert } = require('chai');
const mapserver = require('../../../../src/modules/map/mapserver.js');

describe("modules/map/mapserver", () => {
    it("getMapfileString", () => {
        const mapfileString = mapserver.getMapfileString({
            name: "example_map",
            projection: "EPSG:4326",
            config: [["ON_MISSING_DATA", "LOG"]],
            layers: [{
                name: "example_layer",
                projection: "EPSG:4326",
                status: true,
                processing: ["SCALE=AUTO"],
                styles: [{
                    expression: "[pixel] = 1",
                    color: "#000000"
                }]
            }]
        });

        const mapfileStringExpected =
            `MAP
  NAME map_example_map
  UNITS DD
  PROJECTION
    "init=epsg:4326"
  END
  WEB
    METADATA
      wms_enable_request "*"
      ows_enable_request "*"
    END
  END
  CONFIG "ON_MISSING_DATA" "LOG"
  LAYER
    NAME "layer_example_layer"
    STATUS ON
    PROJECTION
      "init=epsg:4326"
    END
    CLASS
      EXPRESSION ([pixel] = 1)
      STYLE
        COLOR "#000000"
      END
    END
    PROCESSING "SCALE=AUTO"
  END
END`;

        assert.strictEqual(mapfileString, mapfileStringExpected);
    })
})