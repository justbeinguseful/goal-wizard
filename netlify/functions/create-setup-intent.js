const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // CORS pre‑flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const intent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      metadata: body        // store goal metadata on the intent
    });
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ clientSecret: intent.client_secret })
    };
  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};

function cors () {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };
}
