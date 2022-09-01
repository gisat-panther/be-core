const mapserver = require('../../../src/modules/map/mapserver.js');

describe("JsonToMap", () => {
    it("Execute", () => {
        const json = {
            name: "example",
            units: "dd",
            projection: [
                "init=epsg:4326"
            ],
            web: {
                metadata: {

                }
            },
            config: [],
            layer: [
                {
                    name: "example-layer",
                    status: "ON",
                    data: "some-data",
                    type: "raster",
                    projection: [
                        "init=epsg:4326"
                    ],
                    template: "some-template",
                    class: [
                        {
                            name: "Maximum water extent",
                            expression: "[pixel] = 1",
                            style: {
                                color: "#38acff",
                            }
                        },
                        {
                            name: "Not water",
                            expression: "[pixel] = 0",
                            style: {
                                color: "#38acff",
                            }
                        }
                    ]
                }
            ]
        };

        const mapfile = mapserver.getMapfileString2(json);
        
        console.log(mapfile);
    })
})