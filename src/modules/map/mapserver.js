function getMapfileString({ name, projection, config = [], layers = [] }) {
    const mapfileLines = [];

    mapfileLines.push("MAP");

    if (name) {
        mapfileLines.push(`  NAME map_${name}`);
    }

    mapfileLines.push(`  UNITS DD`);

    if (projection) {
        mapfileLines.push(`  PROJECTION`);
        mapfileLines.push(`    "init=${projection.toLowerCase()}"`);
        mapfileLines.push(`  END`);
    }

    mapfileLines.push(`  WEB`);
    mapfileLines.push(`    METADATA`);
    mapfileLines.push(`      wms_enable_request "*"`);
    mapfileLines.push(`      ows_enable_request "*"`);
    mapfileLines.push(`    END`);
    mapfileLines.push(`  END`);

    config.forEach(([property, value]) => {
        mapfileLines.push(`  CONFIG "${property}" "${value}"`);
    })

    layers.forEach((layer) => {
        mapfileLines.push(`  LAYER`);
        mapfileLines.push(`    NAME "layer_${layer.name}"`);
        mapfileLines.push(`    STATUS ${layer.status ? "ON" : "OFF"}`);

        if (layer.data) {
            mapfileLines.push(`    DATA "${layer.data}"`);
        }

        if (layer.tileIndex && layer.tileItem) {
            mapfileLines.push(`    TILEINDEX "${layer.tileIndex}"`);
            mapfileLines.push(`    TILEITEM "${layer.tileItem}"`);
        }

        if (layer.type) {
            mapfileLines.push(`    TYPE ${layer.type.toUpperCase()}`);
        }

        if (layer.projection) {
            mapfileLines.push(`    PROJECTION`);
            mapfileLines.push(`      "init=${layer.projection.toLowerCase()}"`);
            mapfileLines.push(`    END`);
        }

        if (layer.styles) {
            layer.styles.forEach((style) => {
                if (style.expression && style.color) {
                    mapfileLines.push(`    CLASS`);
                    mapfileLines.push(`      EXPRESSION (${style.expression})`);
                    mapfileLines.push(`      STYLE`);
                    mapfileLines.push(`        COLOR "${style.color}"`);
                    mapfileLines.push(`      END`);
                    mapfileLines.push(`    END`);
                }
            });
        }

        if (layer.processing) {
            layer.processing.forEach((definition) => {
                mapfileLines.push(`    PROCESSING "${definition}"`);
            })
        }

        mapfileLines.push(`  END`);
    });

    mapfileLines.push("END");

    return mapfileLines.join("\n");
}

module.exports = {
    getMapfileString
}