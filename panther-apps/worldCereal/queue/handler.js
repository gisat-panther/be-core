const queue = require('./index');
const product = require('../product');

function getRandomTime() {
    const min = 5000;
    const max = 15000;
    return Math.floor(Math.random() * (max - min)) + min;
}

function run() {
    setTimeout(() => {
        execute();
    }, getRandomTime());
}

async function executeGlobal() {
    try {
        const { globalProductKey, productKeys, user } = await queue.getNextGlobal();

        if (globalProductKey) {
            console.log(`#WorldCerealQueue# Processing global ${globalProductKey}`);

            await queue.setGlobal(globalProductKey, productKeys, 'running', user);

            try {
                await product.createGlobalQueued(globalProductKey, productKeys, user);

                console.log(`#WorldCerealQueue# Global ${globalProductKey} was successfully processed!`);

                await queue.setGlobal(globalProductKey, productKeys, 'done', user);
            } catch (e) {
                console.log(e);
                await queue.setGlobal(globalProductKey, productKeys, 'failed', user);
            }
        }
    } catch (e) {
        console.log(e);
    }
}

async function execute() {
    try {
        if (!await queue.isReady()) {
            return;
        }

        const { productKey, user } = await queue.getNext();

        if (productKey) {
            console.log(`#WorldCerealQueue# Processing ${productKey}`);

            await queue.set(productKey, 'running', user);

            try {
                await product.createQueued(productKey, user);

                console.log(`#WorldCerealQueue# ${productKey} was successfully processed!`);

                await queue.set(productKey, 'done', user);
            } catch (e) {
                console.log(e);
                await queue.set(productKey, 'failed', user);
            }
        } else {
            await executeGlobal();
        }
    } catch (e) {
        console.log(e);
    }

    run();
}

module.exports = {
    run
}