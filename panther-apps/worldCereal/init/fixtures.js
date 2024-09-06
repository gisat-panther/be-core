const fixturesLocal = require('../../../src/applications/fixtures/local');
const fixturesRemote = require('../../../src/applications/fixtures/remote');

const config = require('../../../config');

function exec() {
    try {
        if (
            config.projects
            && config.projects.worldCereal
            && config.projects.worldCereal.fixtures
        ) {
            setTimeout(async () => {
                console.log("#WorldCereal# Fixtures init!");
                try {
                    await fixturesLocal.importLocal({ file: "fixtures.sql", path: `${process.cwd()}/panther-apps/worldCereal/fixtures.sql`, user: { type: "user" } });
                } catch (e) {
                    console.log("#WorldCereal# fixtures.sql |", e.message);
                }

                try {
                    await fixturesRemote.s3({ s3: {
                        host: "https://gisat-gis.eu-central-1.linodeobjects.com",
                        prefix: "worldcereal/fixtures/production/"
                    }, user: { key: "ba621c03-bc65-4669-8df9-fc621143a99f", realKey: "ba621c03-bc65-4669-8df9-fc621143a99f", type: "user" } })
                } catch (e) {
                    console.log("#WorldCereal# S3 import errors:", JSON.stringify(e, null, 2));
                }
            }, 10000);
        }
    } catch (e) {
        console.log(e.message);
    }
}

module.exports = {
    exec
}