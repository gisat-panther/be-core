How to create WMS from data stored in S3 bucket.

1. Store your data ( raster or vector files ) in s3 bucket
2. Put SLD style files alongside your spatial data. 
    If you want style all files in directory with same style, name it "default.sld". 
    If you want style only some files in directory, name style same as file you want to style, eg.: "name-of-file-i-want-to-style.sld"
    **note: SLD styles are currently supported only for raster files**
3. Make POST request to <protocol>://<host>/<path-to-backend>/rest/wmsCreator/s3 (currently https://ptr.gisat.cz/backend/rest/wmsCreator/s3) with payload
    ```
    {
        "epsg": 4326,   // set to EPSG code from source DATA
        "featureinfo": true,    // enabled getFeatureInfo WMS functionality
        "template": "mapserver-template-string" || undefined,  // alows you to modifiy format of response payload of getFeatureInfo, if not set, default format will be used. https://mapserver.org/mapfile/template.html
        "public": true,
        "s3": {
            "prefix": "path/to/your/data/", // can be set only to part of the path, eg.: "to/your/"
            "bucket": "bucket-name", // name of target bucket, we are currently store data in "gisat-gis"
            "forcePathStyle": true, // usually has to be set to true for buckets outside of AWS
            "region": "US", // depends of s3 provider
            "endpoint": "eu-central-1.linodeobjects.com",
            "protocol": "https",
            "credentials": {
                    "accessKeyId": "your-access-key",
                    "secretAccessKey": "your-access-secret-key"
            }   // credentials will be stored in mapserver/mapproxy configuration files, it can be updated in future
        }
    }
    ```
4. Whole process could take several minutes, depends on how many files has to be processed.
    If there is no error, backend sould response with status code 200 and with list of paths to created WMS.
    For example:
    ```
        HTTP/1.1 200 OK
        X-Powered-By: Express
        Vary: Origin
        Access-Control-Allow-Credentials: true
        Content-Type: application/json; charset=utf-8
        Content-Length: 1457
        ETag: W/"5b1-MzlmW3xJJPSen5nl5/1paiPFFlM"
        Date: Mon, 19 Jun 2023 10:27:34 GMT
        Connection: close

        {
            "wms": [
                {
                "url": "https://ptr.gisat.cz/mapproxy/esaWorldWater_productExplorer_waterExtentRasters_Colombia_1_2_Water_classification/wms",
                "capabilities": "https://ptr.gisat.cz/mapproxy/esaWorldWater_productExplorer_waterExtentRasters_Colombia_1_2_Water_classification/wms?REQUEST=GetCapabilities",
                "layers": [
                    {
                    "name": "Colombia_2017_water_classification",
                    "source": "https://gisat-gis.eu-central-1.linodeobjects.com/esaWorldWater/productExplorer/waterExtentRasters/Colombia/1_2_Water_classification/Colombia_2017_water_classification.tif"
                    },
                    {
                    "name": "Colombia_2018_water_classification",
                    "source": "https://gisat-gis.eu-central-1.linodeobjects.com/esaWorldWater/productExplorer/waterExtentRasters/Colombia/1_2_Water_classification/Colombia_2018_water_classification.tif"
                    },
                    {
                    "name": "Colombia_2019_water_classification",
                    "source": "https://gisat-gis.eu-central-1.linodeobjects.com/esaWorldWater/productExplorer/waterExtentRasters/Colombia/1_2_Water_classification/Colombia_2019_water_classification.tif"
                    },
                    {
                    "name": "Colombia_2020_water_classification",
                    "source": "https://gisat-gis.eu-central-1.linodeobjects.com/esaWorldWater/productExplorer/waterExtentRasters/Colombia/1_2_Water_classification/Colombia_2020_water_classification.tif"
                    },
                    {
                    "name": "Colombia_2021_water_classification",
                    "source": "https://gisat-gis.eu-central-1.linodeobjects.com/esaWorldWater/productExplorer/waterExtentRasters/Colombia/1_2_Water_classification/Colombia_2021_water_classification.tif"
                    }
                ],
                "epsg": 4326
                }
            ]
        }

    ```