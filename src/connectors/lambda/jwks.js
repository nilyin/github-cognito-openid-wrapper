const responder = require('./util/responder');
const controllers = require('../controllers');
const logger = require('../logger');

module.exports.handler = (event, context, callback) => {
  logger.defaultMeta = { requestId: context.awsRequestId };

  controllers(responder(callback)).jwks();
};
