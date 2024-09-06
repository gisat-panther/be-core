const queue = require('./index');
const product = require('../product');

const config = require('../../../config');

function getRandomTime() {
    const min = 5000;
    const max = 15000;
    return Math.floor(Math.random() * (max - min)) + min;
}

function run() {
    if (
        config.projects
        && config.projects.worldCereal
        && config.projects.worldCereal.ingestion
    ) {
        setTimeout(() => {
            execute();
        }, getRandomTime());
    }
}

async function executeProduct() {
    try {
        const { globalProductKey, productKeys, user } = await queue.getNextGlobal();

        if (globalProductKey) {
            console.log(`#WorldCerealQueue# Processing ${globalProductKey}`);

            await queue.setGlobal(globalProductKey, productKeys, 'running', user);

            try {
                await product.createProduct(globalProductKey, productKeys, user);

                console.log(`#WorldCerealQueue# ${globalProductKey} was successfully processed!`);

                await queue.setGlobal(globalProductKey, productKeys, 'done', user);
            } catch (e) {
                console.log(e);
                await queue.setGlobal(globalProductKey, productKeys, 'failed', user);
            }
        }
    } catch(e) {
        console.log(e);
    }
}

async function execute() {
    try {
        if (!await queue.isReady()) {
            return;
        }
        await executeProduct();
    } catch (e) {
        console.log(e);
    }

    run();
}

module.exports = {
    run
}