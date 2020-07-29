const db = require('../../db');
const {SQL} = require('sql-template-strings');

/**
 * This error can be passed to expressjs error handler to log some error data and show logId to the user.
 */
class HttpError extends Error {
    /**
     * @param {number} status Http response status
     * @param {object} data Error data
     */
    constructor(status, data) {
        super();
        this.status = status;
        this.data = data;
    }
}

/**
 * Logs data into db and returns log id.
 *
 * @param {object} data
 *
 * @returns {Promise<number>}
 */
async function log(data) {
    const res = await db.query(
        SQL`INSERT INTO "various"."errorLogs"("data") VALUES(${data}) RETURNING "key"`
    );

    return res.rows[0]['key'];
}

/**
 * Extracts useful information from request that should be logged with error.
 */
function requestData(request) {
    return {
        url: request.url,
        method: request.method,
        user: request.user,
    };
}

/**
 * Formats given error.
 */
function formatError(err) {
    if (err instanceof HttpError) {
        return {status: err.status, data: err.data};
    }

    if (err instanceof Error) {
        return {
            status: 500,
            data: {
                name: err.name,
                message: err.message,
                stack: err.stack,
            },
        };
    }

    return {status: 500, data: err};
}

/**
 * Middleware that logs given error into db and shows users it's id.
 */
async function errorMiddleware(err, request, response, next) {
    const formatted = formatError(err);
    const reqData = requestData(request);

    const logId = await log({
        request: reqData,
        errorData: formatted.data,
    });

    return response
        .status(formatted.status)
        .json({success: false, code: logId});
}

module.exports = {
    HttpError,
    errorMiddleware,
};
