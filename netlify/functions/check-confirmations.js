// netlify/functions/check-confirmations.js
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async () => {
  const AIRTABLE_BASE   = 'appXTQ0JUx74XJmAA';          // your base
  const CONF_TABLE      = 'Goal Confirmations';        // the table that the referee form writes to
  const GOALS_TABLE     = 'Goals';                     // your goals table
  const AIRTABLE_KEY    = process.env.AIRTABLE_KEY;

  // 1️⃣ Fetch all un-processed confirmations
  const confUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(CONF_TABLE)}?filterByFormula=NOT({Processed})`;
  const confResp = await fetch(confUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_KEY}` }
  });
  const { records: confs } = await confResp.json();
  console.log(`🔎 Found ${confs.length} new confirmations`);

  for (let conf of confs) {
    const confId    = conf.id;
    const { fields }= conf;
    const goalId    = fields['Goal Record ID'];
    const verdict   = fields['Completion'];    // “Yes” or “No”

    // 2️⃣ Copy that verdict back into the Goals table
    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(GOALS_TABLE)}/${goalId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${AIRTABLE_KEY}`
        },
        body: JSON.stringify({
          fields: { 'Goal Achieved': verdict }
        })
      }
    );

    // 3️⃣ If they said “No”, charge immediately
    if (verdict === 'No') {
      // re-fetch the goal record to get stake + customer
      const goalRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(GOALS_TABLE)}/${goalId}`,
        { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } }
      );
      const { fields: goal } = await goalRes.json();

      // only charge if still “Card on file (test)” and a Customer ID exists
      if (
        goal['Payment status'] === 'Card on file (test)' &&
        goal['Customer ID']
      ) {
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
          // mark it “Charged”
          await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(GOALS_TABLE)}/${goalId}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${AIRTABLE_KEY}`
              },
              body: JSON.stringify({
                fields: { 'Payment status': 'Charged' }
              })
            }
          );
          console.log(`⚡ Charged goal ${goalId}`);
        }
      }
    }

    // 4️⃣ Finally, flag this confirmation as “Processed”
    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(CONF_TABLE)}/${confId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${AIRTABLE_KEY}`
        },
        body: JSON.stringify({
          fields: { Processed: true }
        })
      }
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Done (${confs.length} confirmations)` })
  };
};
