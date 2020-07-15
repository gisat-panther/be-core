const express = require('express');
const planCompiler = require('../modules/rest/compiler');
const restRouter = require('../modules/rest/router');
const createLoginApi = require('../modules/login/router');
const routing = require('../modules/routing/index');
const swagger = require('../modules/swagger/index');
const swaggerUi = require('swagger-ui-express');
const {errorMiddleware} = require('../modules/error/index');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const _ = require('lodash/fp');

function appendApplication(result, application) {
    return _.reduce(
        function (result, k) {
            if (result[k] == null) {
                return _.set(k, application[k], result);
            }

            const appendHandler = _.isObject(result[k]) ? _.merge : _.concat;

            return _.set(k, appendHandler(result[k], application[k]), result);
        },
        result,
        _.keys(application)
    );
}

function mergeApplications(...applications) {
    return _.reduce(appendApplication, {}, applications);
}

const config = mergeApplications(
    require('./core/index'),
    require('./demo/index')
);

function apiRouter() {
    const router = express.Router();

    const plan = planCompiler.compile(config.plan);
    const api = [
        ...createLoginApi(plan),
        ...restRouter.createAll(plan),
        ...config.router,
    ];
    const swaggerDocument = swagger.configFromApi(api);
    router.get('/swagger.json', function (req, res) {
        res.header('Content-Type', 'application/json')
            .status(200)
            .json(swaggerDocument);
    });
    router.use(routing.routerFromApi(api));
    router.use('', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    return router;
}

const router = express.Router();
router.use(cookieParser());
router.use(bodyParser.json());
router.use(apiRouter());
router.use(errorMiddleware);

module.exports = {
    router,
};
