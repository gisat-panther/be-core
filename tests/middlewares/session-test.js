const {assert} = require('chai');
const session = require('../../src/middlewares/session');

describe('routing/middleware/session', function () {
    it('create new session', function () {
        const request = {
            user: {
                key: 'k1',
            },
        };
        const response = {};

        return session(request, response, () => {
            assert.isUndefined(request.session);

            return response.storeSession({data: 'dval'});
        });
    });

    it('change session data', function () {
        const request = {
            user: {
                key: 'k1',
            },
        };
        const response = {};

        return session(request, response, () => {
            assert.deepStrictEqual(request.session, {data: 'dval'});

            return response.storeSession({data: 'dval2'});
        });
    });

    it('get changed session data', function () {
        const request = {
            user: {
                key: 'k1',
            },
        };
        const response = {};

        return session(request, response, () => {
            assert.deepStrictEqual(request.session, {data: 'dval2'});
        });
    });
});
