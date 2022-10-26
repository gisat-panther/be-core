const queueHandler = require('./queue/handler');
const fixturesInit = require('./init/fixtures');

queueHandler.run();
fixturesInit.exec();

module.exports = {
    router: require('./router'),
    plan: require('./plan')
};
