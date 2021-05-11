const moment = require('moment');
const momentInterval = require('moment-interval');
const _ = require('lodash/fp');

const missingTimeInfo = [
    ['day', 'H'],
    ['hour', 'm'],
    ['minute', 's'],
    ['second', 'S'],
];

const missingWeekInfo = [['year', 'W'], ['week', 'E'], ...missingTimeInfo];

const missingInfo = [['year', 'M'], ['month', 'D'], ...missingTimeInfo];

function missingInfoData(from) {
    return from.indexOf('G') === -1 ? missingInfo : missingWeekInfo;
}

function createEnd(start) {
    start = start.clone();

    const {format} = start.creationData();
    const foundInfo = _.find(
        ([, substr]) => format.indexOf(substr) === -1,
        missingInfoData(format)
    );
    if (foundInfo == null) {
        return start;
    }

    return start.endOf(foundInfo[0]);
}

function normalizeInterval(input) {
    if (input.indexOf('/') !== -1) {
        return momentInterval.interval(input);
    }

    const start = moment.utc(input);
    const end = start.isValid() ? createEnd(start) : moment.invalid();

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
    normalizeInterval
};
