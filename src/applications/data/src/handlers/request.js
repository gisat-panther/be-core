const filter = require('../processors/filter');
const pData = require('../processors/data');
const pImport = require('../processors/import');

module.exports = function (request, response, next) {
	switch (request.url) {
		case "/rest/data/import":
			pImport(request.file, request.user, request.body)
				.then((responsePayload) => {
					response.status(200).send(responsePayload);
				})
				.catch((error) => {
					response.status(500).send({success: false, message: error.message});
				})
			break;
		case "/rest/data/filtered":
			pData(filter(request.body), request.user)
				.then((responsePayload) => {
					response.status(200).send(responsePayload);
				})
				.catch((error) => {
					response.status(500).send({success: false, message: error.message});
				})
			break;
		default:
			response.status(500).send({success: false, message: "method not found"});
			break;
	}
}