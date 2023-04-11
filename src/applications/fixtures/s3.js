const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

async function getPublicObjects({ host, prefix, marker, objects = [] }) {
    let url = `${host}/?prefix=${prefix}`;

    if (marker) {
        url += `&marker=${marker}`;
    }
    
    const response = await axios(url);
    const responseJs = xmlParser.parse(response.data);

    objects = [
        ...objects,
        ...responseJs.ListBucketResult.Contents
    ]

    if (responseJs.ListBucketResult.NextMarker) {
        return getPublicObjects({host, prefix, marker: responseJs.ListBucketResult.NextMarker, objects});
    } else {
        return objects;
    }
}

module.exports = {
    getPublicObjects
}