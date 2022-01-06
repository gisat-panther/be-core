curl --location --request POST 'http://localhost:9850/rest/project/worldCereal/product' \
--header 'X-User-Info: 3fdd158d-4b78-4d11-92c7-403b4adab4d8' \
--header 'Content-Type: application/json' \
--data-raw '{
    "stac_version": "1.0.0",
    "stac_extensions": [
        "https://stac-extensions.github.io/eo/v1.0.0/schema.json",
        "https://stac-extensions.github.io/projection/v1.0.0/schema.json",
        "https://stac-extensions.github.io/scientific/v1.0.0/schema.json",
        "https://stac-extensions.github.io/view/v1.0.0/schema.json",
        "https://stac-extensions.github.io/remote-data/v1.0.0/schema.json",
        "https://stac-extensions.github.io/mgrs/v1.0.0/schema.json"
    ],
    "type": "Feature",
    "id": "2019_summer2_34190_activecropland_classification_37MBR",
    "bbox": [
        36.29611392372609,
        -4.609788718434252,
        37.28740670399458,
        -3.614480435290947
    ],
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                37.28740670399458,
                -4.609788718434252
            ],
            [
                37.28740670399458,
                -3.614480435290947
            ],
            [
                36.29611392372609,
                -3.614480435290947
            ],
            [
                36.29611392372609,
                -4.609788718434252
            ],
            [
                37.28740670399458,
                -4.609788718434252
            ]
        ]
    },
    "collection": "esa-worldcereal-activecropland",
    "links": [
        {
            "rel": "self",
            "href": "https://s3.waw2-1.cloudferro.com/swift/v1/AUTH_b33f63f311844f2fbf62c5741ff0f734/ewoc-prd/37MBR/2019_summer2/2019_summer2_34190_activecropland_metadata_37MBR.json"
        },
        {
            "rel": "website",
            "href": "worldcereal.org"
        }
    ],
    "properties": {
        "title": "A worldcereal product",
        "description": "...",
        "datetime": "2021-11-12T07:53:16.003Z",
        "created": "2021-11-12T07:53:16.003Z",
        "updated": "2021-11-12T07:53:16.003Z",
        "license": "TBD",
        "rd:sat_id": "Sentinel-2,Sentinel-1",
        "mgrs:utm_zone": 37,
        "mgrs:latitude_band": "M",
        "mgrs:grid_square": "BR",
        "proj:epsg": 32737,
        "proj:shape": [
            10980,
            10980
        ],
        "gsd": 10.0,
        "instruments": [
            "Sentinel-2 MSI",
            "Sentinel-1 C-band SAR"
        ],
        "start_datetime": "2019-02-17",
        "end_datetime": "2019-08-06",
        "season": "summer2",
        "aez_id": 34190,
        "aez_group": 34000,
        "model": "None",
        "users": [
            "0000"
        ],
        "training_refids": {
            "reference_id": 0
        },
        "product": "activecropland",
        "type": "map",
        "public": "false",
        "related_products": [
            "2019_summer2_34190_activecropland_classification_37MBR"
        ],
        "tile_collection_id": "2019_summer2_34190_activecropland_0000"
    },
    "assets": {
        "product": {
            "href": "https://s3.waw2-1.cloudferro.com/swift/v1/AUTH_b33f63f311844f2fbf62c5741ff0f734/ewoc-prd/37MBR/2019_summer2/2019_summer2_34190_activecropland_classification_37MBR.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "activecropland classification",
            "roles": [
                "data"
            ]
        },
        "metafeatures": {
            "href": "https://s3.waw2-1.cloudferro.com/swift/v1/AUTH_b33f63f311844f2fbf62c5741ff0f734/ewoc-prd/37MBR/2019_summer2/2019_summer2_34190_activecropland_metafeatures_37MBR.tif",
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "activecropland meta-features",
            "roles": [
                "data"
            ]
        }
    }
}'