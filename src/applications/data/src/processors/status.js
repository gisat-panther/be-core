const cache = require('../../../../cache');

module.exports = (type, key) => {
	return cache.get(`${type}_${key}`)
		.then((cacheResult) => {
			if (cacheResult) {
				return {
					[`${type}Key`]: key,
					...cacheResult
				}
			} else {
				return {
					success: false,
					message: "not found"
				}
			}
		})
}
