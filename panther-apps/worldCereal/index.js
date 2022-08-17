const queueHandler = require('./queue/handler');

queueHandler.run();

module.exports = {
    router: require('./router'),
    plan: require('./plan')
};
