const { ChargilyClient } = require('@chargily/chargily-pay');

const client = new ChargilyClient({
  api_key: process.env.CHARGILY_SECRET_KEY, // This pulls directly from Render's dashboard now
  mode: 'live',                             // Forces sandbox testing environment
});

async function createPayment({ amount, currency = 'dzd', success_url, failure_url, metadata }) {
  const checkout = await client.createCheckout({
    amount: Math.round(amount), // Note: V2 expects exact Dinars (e.g. 1500 for 1500 DA)
    currency,
    success_url,
    failure_url,
    metadata,
  });
  return checkout;
}

async function verifyPayment(checkoutId) {
  const checkout = await client.getCheckout(checkoutId);
  return checkout;
}

module.exports = { createPayment, verifyPayment };
