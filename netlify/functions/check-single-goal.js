// netlify/functions/check-single-goal.js
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    // Parse the incoming record ID
    const { recordId } = JSON.parse(event.body || '{}');
    if (!recordId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing recordId in request body' }) 
      };
    }

    const AIRTABLE_BASE = 'appXTQ0JUx74XJmAA';
    const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
    const AIRTABLE_KEY = process.env.AIRTABLE_KEY;

    // Fetch the specific record
    const recordUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${recordId}`;
    const recordRes = await fetch(recordUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_KEY}` }
    });

    if (!recordRes.ok) {
      throw new Error(`Failed to fetch record: ${await recordRes.text()}`);
    }

    const { fields } = await recordRes.json();
    
    // Skip if already charged or not marked as "No"
    if (fields['Payment status'] !== 'Card on file (test)' || fields['Goal Achieved'] !== 'No') {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Record skipped - not in chargeable state',
          reason: fields['Payment status'] !== 'Card on file (test)' 
            ? 'Payment status is not Card on file (test)' 
            : 'Goal Achieved is not No'
        })
      };
    }

    // Verify Customer ID exists
    if (!fields['Customer ID']) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No Customer ID found for this record' })
      };
    }

    // Find customer's payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: fields['Customer ID'],
      type: 'card'
    });
    
    if (paymentMethods.data.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No payment methods found for this customer' })
      };
    }

    // Charge the card
    const stake = fields['Money Stake USD'] || 0;
    await stripe.paymentIntents.create({
      amount: Math.round(stake * 100), // Convert to cents
      currency: 'usd',
      customer: fields['Customer ID'],
      payment_method: paymentMethods.data[0].id,
      off_session: true,
      confirm: true,
      description: `Charge for failed goal: ${fields['Goal']}`
    });

    // Update payment status
    await fetch(recordUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AIRTABLE_KEY}`
      },
      body: JSON.stringify({
        fields: {
          "Payment status": "Charged"
        }
      })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Successfully charged customer for failed goal',
        recordId 
      })
    };
  } catch (error) {
    console.error('Error in check-single-goal:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
