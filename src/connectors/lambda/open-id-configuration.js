const responder = require('./util/responder');
const auth = require('./util/auth');
const controllers = require('../controllers');
const logger = require('../logger');

module.exports.handler = (event, context, callback) => {
  logger.defaultMeta = { requestId: context.awsRequestId };

  controllers(responder(callback)).openIdConfiguration(
    auth.getIssuer(
      event.headers.Host,
      event.requestContext && event.requestContext.stage
    )
  );
};
