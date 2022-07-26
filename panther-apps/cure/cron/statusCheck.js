const auth = require('../auth/index.js');
const db = require('../db/index.js');
const orders = require('../orders/index.js');

async function run() {
    console.log("# CURE # User product status check");

    const savedOrders = await db.getAllOrders();

    if (savedOrders.length) {
        const authToken = await auth.getToken();
        for(const order of savedOrders) {
            const currentOrderStatus = await orders.getOrderStatus(order.orderId, authToken);
            const savedUserOrder = await db.saveUserOrder({realKey: order.userKey}, order.app, currentOrderStatus);

            console.log(savedUserOrder);
        }
    }

    
}

function init() {
    setInterval(() => {
        run();
    }, 120000);
}

module.exports = {
    init
}