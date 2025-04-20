// File: netlify/functions/create-setup-intent.js
const Stripe = require('stripe');

// Initialize Stripe with your secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    // Parse incoming data from the frontend
    const { goal, deadline, stake, referee, userEmail, terms } = JSON.parse(event.body);

    // Create a SetupIntent so Stripe can securely capture card details
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      metadata: {
        goal,
        deadline,
        stake,
        referee,
        userEmail,
        terms: terms.toString()
      }
    });

    // Return the client secret to the frontend
    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: setupIntent.client_secret })
    };

  } catch (err) {
    console.error('Error in create-setup-intent:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
