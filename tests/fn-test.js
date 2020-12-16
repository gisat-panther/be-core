const {assert} = require('chai');
const fn = require('../src/fn');

/**
 * @returns {Promise} Promise that can be resolved or rejected from outside.
 */
function promise() {
    let _resolve;
    let _reject;
    const p = new Promise((resolve, reject) => {
        _resolve = resolve;
        _reject = reject;
    });

    p.resolve = (value) => {
        _resolve();

        return p;
    };

    p.reject = (reason) => {
        _reject();

        return p;
    };

    return p;
}

/**
 * Queue current task, execute other queued tasks first.
 */
function yield() {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), 0);
    });
}

describe('fn', function () {
    it('queued', async function () {
        const calls = [];

        function testingF(id, p) {
            calls.push(id);
            return p;
        }

        const queuedF = fn.queued(testingF);

        // run (as queue is empty)
        const p1 = promise();
        queuedF(1, p1);
        await yield();

        // queue
        const p2 = promise();
        queuedF(2, p2);
        await yield();

        // queue (replace p2)
        const p3 = promise();
        queuedF(3, p3);
        await yield();

        // run last queued (p3)
        p1.resolve();
        await p1;
        await yield();

        // queue
        const p4 = promise();
        queuedF(4, p4);
        await yield();

        assert.deepStrictEqual(calls, [1, 3]);
    });
});
