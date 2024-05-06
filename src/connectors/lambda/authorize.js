const responder = require('./util/responder');
const controllers = require('../controllers');
const logger = require('../logger');

module.exports.handler = (event, context, callback) => {
  logger.defaultMeta = { requestId: context.awsRequestId };

  const { client_id, scope, state, response_type } =
    event.queryStringParameters;

  controllers(responder(callback)).authorize(
    client_id,
    scope,
    state,
    response_type
  );
};
