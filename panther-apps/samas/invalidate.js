const { exit } = require('node:process');
const config = require('../../config.js');
const fsp = require('node:fs/promises');

const prefix = process.argv[2];

async function run() {
    if (!prefix) {
        console.log(`Prefix is not set. Use: node invalidate.js <prefix>`);
        exit(1);
    }

    console.log(`Invalidating objects with prefix "${prefix}"`);

    const objects = JSON.parse(await fsp.readFile(`${config.projects.samas.paths.mapproxyConf}/SAMAS-objects.json`));
    
    for (const [key, object] of Object.entries(objects)) {
        if (object.Key.startsWith(prefix)) {
           object.Size = 0;

           console.log(`Object ${key} (${object.Key}) invalidated!`);
        }
    }

    await fsp.writeFile(`${config.projects.samas.paths.mapproxyConf}/SAMAS-objects.json`, JSON.stringify(objects, null, 2));
}

run();