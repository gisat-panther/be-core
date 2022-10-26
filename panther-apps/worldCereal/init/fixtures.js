const fixturesLocal = require('../../../src/applications/fixtures/local');

const config = require('../../../config');

function exec() {
    try {
        if (config.projects.worldCereal.fixtures) {
            setTimeout(async () => {
                console.log("#WorldCereal# Fixtures init!");
                await fixturesLocal.importLocal({file: "fixtures.sql", path: `${process.cwd()}/panther-apps/worldCereal/fixtures.sql`});
            }, 1000);
        }
    } catch(e) {

    }
}

module.exports = {
    exec
}