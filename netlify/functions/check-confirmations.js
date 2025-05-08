// netlify/functions/check-confirmations.js
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async () => {
  const AIRTABLE_BASE = 'appXTQ0JUx74XJmAA';
  const CONF_TABLE = 'tblConfirmationsID';  // Replace with your actual Goal Confirmations table ID
  const GOALS_TABLE = 'tblyuW8pf6ZkFRfte';  // Your Goals table ID
  const AIRTABLE_KEY = process.env.AIRTABLE_KEY;

  try {
    // 1️⃣ Fetch unprocessed confirmations
    const formula = encodeURIComponent('{Processed}!=1');
    const confResp = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CONF_TABLE}?filterByFormula=${formula}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } }
    );
    
    if (!confResp.ok) {
      throw new Error(`Failed to fetch confirmations: ${await confResp.text()}`);
    }
    
    const { records: confs } = await confResp.json();
    console.log(`Found ${confs.length} new confirmations`);

    for (let conf of confs) {
      const id = conf.id;
      const fields = conf.fields;
      const goalId = fields['Goal Record ID'];
      const verdict = fields['Completion']; // "Yes" or "No"

      // 2️⃣ Update the Goals record's "Goal Achieved" field
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${GOALS_TABLE}/${goalId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AIRTABLE_KEY}`
          },
          body: JSON.stringify({
            fields: { 'Goal Achieved': verdict }
          })
        }
      );
      console.log(`Updated goal ${goalId} with verdict: ${verdict}`);

      // 3️⃣ If they said "No", charge immediately
      if (verdict === 'No') {
        // Pull the record from Goals to get Customer ID + stake
        const goalRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${GOALS_TABLE}/${goalId}`,
          { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } }
        );
        
        if (!goalRes.ok) {
          console.error(`Failed to fetch goal record: ${await goalRes.text()}`);
          continue;
        }
        
        const { fields: goal } = await goalRes.json();

        if (goal['Payment status'] === 'Card on file (test)' && goal['Customer ID']) {
          try {
            // Grab their card
            const methods = await stripe.paymentMethods.list({
              customer: goal['Customer ID'], 
              type: 'card'
            });
            
            if (methods.data.length) {
              await stripe.paymentIntents.create({
                amount: Math.round((goal['Money Stake USD'] || 0) * 100),
                currency: 'usd',
                customer: goal['Customer ID'],
                payment_method: methods.data[0].id,
                off_session: true,
                confirm: true,
                description: `Charge for failed goal: ${goal['Goal']}`
              });

              // Mark them charged
              await fetch(
                `https://api.airtable.com/v0/${AIRTABLE_BASE}/${GOALS_TABLE}/${goalId}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AIRTABLE_KEY}`
                  },
                  body: JSON.stringify({
                    fields: { 'Payment status': 'Charged' }
                  })
                }
              );
              console.log(`⚡ Charged ${goalId}`);
            } else {
              console.log(`No payment methods found for customer ${goal['Customer ID']}`);
            }
          } catch (error) {
            console.error(`Error charging goal ${goalId}:`, error);
          }
        } else {
          console.log(`Goal ${goalId} not eligible for charging: Payment status = ${goal['Payment status']}, Customer ID = ${goal['Customer ID'] ? 'present' : 'missing'}`);
        }
      }

      // 4️⃣ Mark this confirmation "Processed" so we don't hit it again
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CONF_TABLE}/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AIRTABLE_KEY}`
          },
          body: JSON.stringify({
            fields: { 'Processed': true }
          })
        }
      );
      console.log(`Marked confirmation ${id} as processed`);
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: `Done (${confs.length} confirmations processed)` 
      })
    };
  } catch (error) {
    console.error('Error processing confirmations:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
