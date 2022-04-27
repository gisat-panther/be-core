const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Response } = require('node-fetch');
const mime = require('mime-types');

const restHandler = require('../../modules/rest/handler');

const config = require('../../../config.js');

function getValueFromObjectByPath(object, path) {
    return path.split('.').reduce((a, v) => a[v], object);
}

function download(request, response) {
    const dataSourceKey = request.params.dataSourceKey;
    const itemKey = request.params.itemKey;
    const user = request.user;

    restHandler.list(
        "dataSources",
        {
            params: {
                types: "spatial"
            },
            user,
            body: {
                "filter": {
                    key: dataSourceKey
                }
            }
        }
    ).then(async (result) => {
        if (
            result.type === "success"
            && result.data.data.spatial.length
            && result.data.data.spatial[0].data
            && result.data.data.spatial[0].data.configuration
            && result.data.data.spatial[0].data.configuration.download
            && result.data.data.spatial[0].data.configuration.download.items
            && result.data.data.spatial[0].data.configuration.download.items[itemKey]
        ) {
            const downloadConfiguration = result.data.data.spatial[0].data.configuration.download;
            if (downloadConfiguration.storageType === "s3" && downloadConfiguration.credentials.source === "localConfig") {
                const s3Config = getValueFromObjectByPath(config, downloadConfiguration.credentials.path);
                const s3Client = new S3Client({
                    forcePathStyle: true,
                    region: "eu-west-1",
                    endpoint: `https://${s3Config.AWS_S3_ENDPOINT}`,
                    credentials: {
                        accessKeyId: s3Config.AWS_ACCESS_KEY_ID,
                        secretAccessKey: s3Config.AWS_SECRET_ACCESS_KEY
                    }
                });

                const s3ObjectPath = result.data.data.spatial[0].data.configuration.download.items[itemKey];
                const bucket = s3ObjectPath.replace("s3://", "").split("/")[0];
                const objectKey = s3ObjectPath.replace("s3://", "").replace(`${bucket}/`, "");
                const fileName = path.basename(objectKey);
                const contentType = mime.lookup(objectKey);

                const getObjectCommand = new GetObjectCommand({
                    Bucket: bucket,
                    Key: objectKey
                });

                const s3Response = await s3Client.send(getObjectCommand);
                const fetchResponse = new Response(s3Response.Body);

                response.type(contentType);
                response.set("Content-Disposition", `attachment;filename=${fileName}`);
                response.send(
                    Buffer.from(
                        await fetchResponse.arrayBuffer()
                    )
                );

            } else {
                throw new Error();
            }
        } else {
            throw new Error();
        }

    }).catch((error) => {
        console.log(error);
        response.status(404).end();
    })
}

module.exports = {
    download
}