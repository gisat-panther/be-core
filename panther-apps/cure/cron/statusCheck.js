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
            if (currentOrderStatus) {
                const savedUserOrder = await db.saveUserOrder({realKey: order.userKey}, order.app, currentOrderStatus);
                console.log(`# CURE # Order ${savedUserOrder.orderId}; Status ${savedUserOrder.status}; Result ${savedUserOrder.result}`);
            } else {
                console.log(`# CURE # Failed to get status for order ${order.orderId}`);
            }

        }
    }
}

async function init() {
    await db.init();
    await run();
}

init();