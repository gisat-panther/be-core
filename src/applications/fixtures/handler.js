const rest = require('./rest');

async function restImport(request, response) {
    return rest.importFixtures(request, response);
}

module.exports = {
    restImport,
}