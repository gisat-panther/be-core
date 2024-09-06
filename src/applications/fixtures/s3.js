const axios = require('axios');
const https = require("https");
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getPublicObjects({ host, prefix, marker, objects = [] }) {
    let url = `${host}/?prefix=${prefix}`;

    if (marker) {
        url += `&marker=${marker}`;
    }

    const response = await axios(url, { httpsAgent });
    const responseJs = xmlParser.parse(response.data);

    objects = [
        ...objects,
        ...responseJs.ListBucketResult.Contents
    ]

    if (responseJs.ListBucketResult.NextMarker) {
        return getPublicObjects({ host, prefix, marker: responseJs.ListBucketResult.NextMarker, objects });
    } else {
        return objects;
    }
}

module.exports = {
    getPublicObjects
}