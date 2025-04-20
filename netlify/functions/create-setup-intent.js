// netlify/functions/create-setup-intent.js

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const { goal, deadline, stake, referee, userEmail } = JSON.parse(event.body);

    // Create a SetupIntent to save the card
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      metadata: { goal, deadline, stake, referee, userEmail }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: setupIntent.client_secret })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
