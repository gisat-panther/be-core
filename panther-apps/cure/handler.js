const auth = require('./auth/index.js');
const db = require('./db/index.js');
const orders = require('./orders/index.js');
const services = require('./services/index.js');
const users = require('./users/index.js');

const { appParams } = require('./constants.js');

async function executeOrder(user, params) {
    if (appParams.hasOwnProperty(params.app)) {
        const authToken = await auth.getToken();
        if (!authToken) {
            const order = await services.callAppApi(params.app, params, authToken);

            if (order) {
                const orderStatus = await orders.getOrderStatus(order.links.order_id, authToken);
                if (orderStatus) {
                    return db.saveUserOrder(user, params.app, orderStatus);
                }
            }
        }
    }
}

async function getOrders(user) {
    return orders.getUserOrders(user);
}

async function registerUser(params) {
    return users.register(params);
}

module.exports = {
    executeOrder,
    getOrders,
    registerUser
}