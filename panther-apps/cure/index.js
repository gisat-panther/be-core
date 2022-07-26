const statusCheckCron = require('./cron/statusCheck.js');

statusCheckCron.init();

module.exports = {
    router: require('./router')
};
