const auth = require('../auth/index.js');
const db = require('../db/index.js');

const { geovileApi } = require('../constants.js');

async function getUserOrders(user) {
    return db.getUserOrders(user.realKey);
}

async function getOrderStatus(orderId, authToken) {
    if (!authToken) {
        authToken = await auth.getToken();
    }
    const response = await fetch(
        `${geovileApi}/services/order_status/${orderId}`,
        {
            method: "get",
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        }
    )

    if (response.status === 200) {
        return await response.json();
    }
}

module.exports = {
    getUserOrders,
    getOrderStatus
}