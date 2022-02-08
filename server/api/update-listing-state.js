const { transactionLineItems } = require('../api-util/lineItems');
const { getSdk, getTrustedSdk, handleError, serialize } = require('../api-util/sdk');
const flexIntegrationSdk = require('sharetribe-flex-integration-sdk');
const { types } = require('sharetribe-flex-sdk');
const { UUID } = types;

module.exports = (req, res) => {
  const integrationSdk = flexIntegrationSdk.createInstance({
    clientId: process.env.SHARETRIBE_INTEGRATION_CLIENT_ID,
    clientSecret: process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET,
  });
  const { listingId, listingState , transactionId} = req.body;
  console.log("🚀 | file: update-listing-state.js | line 13 | transactionId", transactionId);
  console.log("🚀 | file: update-listing-state.js | line 13 | listingState", listingState);
  console.log("🚀 | file: update-listing-state.js | line 13 | id", id);
  return integrationSdk.listings
    .update({ id: new UUID(listingId), publicData: { listingState, transactionId } }, { expand: true })
    .then(listingResponse => {
      res
        .status(200)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            success: true,
            listingStateUpdated: listingState,
          })
        )
        .end();
    })
    .catch(e => {
    console.log("🚀 | file: update-listing-state.js | line 28 | e", e);
      handleError(res, e);
    });
};
