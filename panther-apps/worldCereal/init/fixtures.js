const fixturesLocal = require('../../../src/applications/fixtures/local');

const config = require('../../../config');

function exec() {
    try {
        if (config.projects.worldCereal.fixtures) {
            setTimeout(async () => {
                console.log("#WorldCereal# Fixtures init!");
                try {
                    await fixturesLocal.importLocal({ file: "fixtures.sql", path: `${process.cwd()}/panther-apps/worldCereal/fixtures.sql`, user: { type: "user" } });
                } catch(e) {
                    console.log("#WorldCereal#", e.message);
                }
            }, 1000);
        }
    } catch (e) {
        console.log(e.message);
    }
}

module.exports = {
    exec
}