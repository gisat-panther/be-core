const momentInterval = require('moment-interval');

function toISOStringIgnoringTz(moment) {
    return moment.format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
}

function intervalToRange(interval) {
    if (interval == null) {
        return null;
    }
    const minterval = momentInterval.interval(interval);

    return `["${toISOStringIgnoringTz(
        minterval.start()
    )}","${toISOStringIgnoringTz(minterval.end())}"]`;
}

module.exports = {
    intervalToRange,
};
