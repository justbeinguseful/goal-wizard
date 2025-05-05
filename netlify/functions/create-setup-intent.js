// netlify/functions/create-setup-intent.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // CORS pre‑flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { email, name } = body;
    
    // Find or create the Stripe Customer
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer = existing.data.length
      ? existing.data[0]
      : await stripe.customers.create({ email, name });

    // Create a SetupIntent for that customer
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: body
    });

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ 
        clientSecret: setupIntent.client_secret,
        customerId: customer.id 
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };
}
