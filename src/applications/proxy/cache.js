const { createClient } = require('redis');

const config = require('../../../config');

let usableRedisClient, redisClient;

async function connect() {
    if (!usableRedisClient && !redisClient) {
        redisClient = createClient({
            url: `redis://${config.redisConfig.host}:${config.redisConfig.port}`
        });

        redisClient.on("ready", () => {
            usableRedisClient = redisClient;
        })

        redisClient.on("error", async (error) => {
            usableRedisClient = null;
        })

        redisClient.connect();
    }
}

async function get(key) {
    await connect();
    if (usableRedisClient) {
        return JSON.parse(await usableRedisClient.get(key));
    }
}

async function set(key, data, ttl) {
    await connect();
    if (usableRedisClient) {
        await usableRedisClient.set(key, JSON.stringify(data));
        await usableRedisClient.expire(key, ttl);
    }
}

module.exports = {
    connect,
    get,
    set
}