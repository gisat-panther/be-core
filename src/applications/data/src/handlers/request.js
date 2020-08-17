const filter = require('../processors/filter');
const data = require('../processors/data');

module.exports = async function (request, response, next) {
	let responsePayload = await data(
		filter(request.body),
		request.user
	);
	response.status(200).send(responsePayload);
}