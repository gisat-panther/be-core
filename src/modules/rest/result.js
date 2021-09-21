const FORBIDDEN = 'forbidden';
const CREATED = 'created';
const UPDATED = 'updated';
const DELETED = 'deleted';
const BAD_REQUEST = 'bad_request';
const SUCCESS = 'success';

/**
 * @typedef {FORBIDDEN|CREATED|UPDATED|DELETED|BAD_REQUEST|SUCCESS} ResultType
 *
 * @typedef {Object} Result
 * @property {ResultType} type
 * @property {any=} data
 */

module.exports = {
    FORBIDDEN,
    CREATED,
    UPDATED,
    DELETED,
    BAD_REQUEST,
    SUCCESS,
};
