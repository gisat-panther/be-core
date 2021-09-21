const express = require('express');
const command = require('../modules/rest/command');
const restRouter = require('../modules/rest/router');
const createLoginApi = require('../modules/login/router');
const routing = require('../modules/routing/index');
const swagger = require('../modules/swagger/index');
const swaggerUi = require('swagger-ui-express');
const {errorMiddleware} = require('../modules/error/index');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const p = require('./plan');
const c = require('./commands');
const getConfig = require('./config').get;

const config = getConfig();

/**
 * Creates api router with swagger documentation.
 */
function apiRouter() {
    const router = express.Router();

    const plan = config.plan;
    p.init(plan);
    const commands = command.createAll(plan);
    c.init(commands);
    const api = [
        ...createLoginApi(plan),
        ...restRouter.createAll(plan, commands),
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
router.use(bodyParser.json({limit: '5120kb'}));
router.use(apiRouter());
router.use(errorMiddleware);

module.exports = {
    router,
};
