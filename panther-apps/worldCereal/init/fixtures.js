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
                    await fixturesRemote.importRemote({ file: "global.geojson", url: `http://gisat-gis.eu-central-1.linodeobjects.com/worldcereal/fixtures/production/global.geojson`, user: { key: "ba621c03-bc65-4669-8df9-fc621143a99f", realKey: "ba621c03-bc65-4669-8df9-fc621143a99f", type: "user" } });
                } catch (e) {
                    console.log("#WorldCereal# global.geojson |", e.message);
                }

                try {
                    await fixturesRemote.importRemote({ file: "brazil.geojson", url: `http://gisat-gis.eu-central-1.linodeobjects.com/worldcereal/fixtures/production/brazil.geojson`, user: { key: "ba621c03-bc65-4669-8df9-fc621143a99f", realKey: "ba621c03-bc65-4669-8df9-fc621143a99f", type: "user" } });
                } catch (e) {
                    console.log("#WorldCereal# brazil.geojson |", e.message);
                }

                try {
                    await fixturesRemote.importRemote({ file: "ukraine.geojson", url: `http://gisat-gis.eu-central-1.linodeobjects.com/worldcereal/fixtures/production/ukraine.geojson`, user: { key: "ba621c03-bc65-4669-8df9-fc621143a99f", realKey: "ba621c03-bc65-4669-8df9-fc621143a99f", type: "user" } });
                } catch (e) {
                    console.log("#WorldCereal# ukraine.geojson |", e.message);
                }

                try {
                    await fixturesRemote.importRemote({ file: "fixtures.json", url: `http://gisat-gis.eu-central-1.linodeobjects.com/worldcereal/fixtures/production/fixtures.json`, user: { key: "ba621c03-bc65-4669-8df9-fc621143a99f", realKey: "ba621c03-bc65-4669-8df9-fc621143a99f", type: "user" } });
                } catch (e) {
                    console.log("#WorldCereal# fixtures.json |", e.message);
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