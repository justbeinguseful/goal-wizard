// netlify/functions/check‐deadlines.js
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async () => {
  const AIRTABLE_BASE  = 'appXTQ0JUx74XJmAA';
  const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
  const AIRTABLE_KEY   = process.env.AIRTABLE_KEY;

  try {
    // Calculate four days ago
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];

    // Fetch overdue and still-pending records
    const filter = encodeURIComponent(
      `AND({Deadline Date} <= "${fourDaysAgoStr}", {Goal Achieved} = "Pending")`
    );
    const listUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula=${filter}`;

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` }
    });
    if (!listRes.ok) throw new Error(await listRes.text());
    const { records } = await listRes.json();
    console.log(`Found ${records.length} overdue records`);

    for (const { id, fields } of records) {
      // 1) Mark as No
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${AIRTABLE_KEY}`
          },
          body: JSON.stringify({ fields: { 'Goal Achieved': 'No' } })
        }
      );
      console.log(`– Marked ${id} as No`);

      // 2) Charge if card on file
      if (fields['Customer ID'] && fields['Payment status'] === 'Card on file (test)') {
        const pms = await stripe.paymentMethods.list({
          customer: fields['Customer ID'],
          type: 'card'
        });
        if (pms.data.length) {
          await stripe.paymentIntents.create({
            amount: Math.round((fields['Money Stake USD'] || 0) * 100),
            currency: 'usd',
            customer: fields['Customer ID'],
            payment_method: pms.data[0].id,
            off_session: true,
            confirm: true,
            description: `Failed goal charge: ${fields['Goal']}`
          });
          // Update payment status
          await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${AIRTABLE_KEY}`
              },
              body: JSON.stringify({ fields: { 'Payment status': 'Charged' } })
            }
          );
          console.log(`– Charged ${id}`);
        }
      }
    }

    return { statusCode: 200, body: `Processed ${records.length} records` };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err.message };
  }
};
