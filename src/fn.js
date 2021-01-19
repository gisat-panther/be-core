/**
 * Various generic functions missing in lodash.
 */

/**
 * Takes async function `f` as argument and returns function with same signature as `f`.
 *
 * If resulting function is called, it calls `f` if it is not already running, or schedules
 * the run after current `f` finishes.
 *
 * It uses dropping buffer of size 1,
 * meaning that if more invokations are requested,
 * only last will be called.
 *
 * Returns promise, result of `f` is discarded.
 */
function queued(f) {
    let nextF = null;
    let res = Promise.resolve();

    async function run() {
        if (nextF == null) {
            return;
        }

        let currentF = nextF;
        nextF = null;
        res = currentF[0](...currentF[1]);

        return res;
    }

    return async function () {
        nextF = [f, arguments];
        try {
            await res;
        } finally {
            await run();
        }
    };
}

module.exports = {
    queued,
};
