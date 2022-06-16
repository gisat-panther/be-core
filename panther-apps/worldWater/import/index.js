const {
    S3Client,
    ListObjectsCommand,
    GetObjectCommand
} = require('@aws-sdk/client-s3');

async function listS3ObjectKeys({ s3Client, bucket, marker, prefix, files = [] }) {
    const listCommand = new ListObjectsCommand({
        Bucket: bucket,
        Prefix: prefix,
        Marker: marker
    })
    
    const response = await s3Client.send(listCommand);

    response.Contents.forEach((object) => {
        if (object.Key.toLowerCase().endsWith(".tif") || object.Key.toLowerCase().endsWith(".tiff")) {
            files.push(object.Key);
        }
    })

    if (response.NextMarker) {
        return await listS3ObjectKeys({ s3Client, bucket, marker: response.NextMarker, prefix, files });
    } else {
        return files;
    }
}

async function getVsis3Paths(options) {
    const s3Client = new S3Client({
        endpoint: `${options.s3.protocol ? options.s3.protocol + '://' : ''}` + options.s3.endpoint,
        region: options.s3.endpoint,
        forcePathStyle: options.s3.forcePathStyle,
        credentials: options.s3.credentials
    });

    const s3ObjectKeys = await listS3ObjectKeys({ s3Client, bucket: options.s3.bucket, prefix: options.s3.prefix });
    const vsis3FilePaths = s3ObjectKeys.map((objectKey) => `/vsis3/${options.s3.bucket}/${objectKey}`);

    // vsis3FilePaths.forEach((s3FilePath) => {
    //     console.log(`gdalinfo --config "AWS_SECRET_ACCESS_KEY" "${options.s3.credentials.secretAccessKey}" --config "AWS_ACCESS_KEY_ID" "${options.s3.credentials.accessKeyId}" --config "AWS_S3_ENDPOINT" "${options.s3.endpoint}" --config "AWS_VIRTUAL_HOSTING" "TRUE" ${s3FilePath}`);
    // })

    return vsis3FilePaths;
}

async function getMapserverOptions(vsis3Paths) {

}

async function getMapproxyOptions(mapserverOptions) {
    
}

async function s3(options) {
    const vsis3Paths = await getVsis3Paths(options);
    const mapserverOptions = await getMapserverOptions(vsis3Paths);
    const mapproxyOptions = await getMapproxyOptions(mapserverOptions);

    return Promise.resolve({ message: "not implemented", vsis3Paths });
}

module.exports = {
    s3
}