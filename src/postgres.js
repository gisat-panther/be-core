const moment = require('moment');
const momentInterval = require('moment-interval');
const _ = require('lodash/fp');

const missingInfo = [
    ['year', 'M'],
    ['month', 'D'],
    ['day', 'H'],
    ['hour', 'm'],
    ['minute', 's'],
    ['second', 'S'],
];

function createEnd(start) {
    start = start.clone();

    const {format} = start.creationData();
    const [endOf] = _.find(
        ([, substr]) => format.indexOf(substr) === -1,
        missingInfo
    );
    if (endOf == null) {
        return start;
    }

    return start.endOf(endOf);
}

function normalizeInterval(input) {
    if (input.indexOf('/') !== -1) {
        return momentInterval.interval(input);
    }

    const start = moment.utc(input);
    const end = createEnd(start);

    return momentInterval.interval(start, end);
}

function toISOStringIgnoringTz(moment) {
    return moment.format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
}

function intervalToRange(interval) {
    if (interval == null) {
        return null;
    }
    const minterval = normalizeInterval(interval);

    return `["${toISOStringIgnoringTz(
        minterval.start()
    )}","${toISOStringIgnoringTz(minterval.end())}"]`;
}

module.exports = {
    intervalToRange,
};
