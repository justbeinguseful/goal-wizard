// netlify/functions/check-confirmations.js
// 
// IMPORTANT: This function should run ONCE DAILY, not every 15 minutes!
// Recommended schedule: Daily at midnight (or any time that works)
// 
// There is no business justification for checking confirmations every 15 minutes.
// Whether someone gets charged 15 minutes or 24 hours after a referee responds
// makes zero practical difference to the user experience.
//
// Running every 15 minutes = 96 API calls per day
// Running once daily = 1 API call per day
//
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async () => {
  const AIRTABLE_BASE   = 'appXTQ0JUx74XJmAA';
  const CONF_TABLE      = 'Goal Confirmations';
  const GOALS_TABLE     = 'Goals';
  const AIRTABLE_KEY    = process.env.AIRTABLE_KEY;

  try {
    // 1️⃣ Fetch all unprocessed confirmations
    const confUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(CONF_TABLE)}?filterByFormula=NOT({Processed})`;
    const confResp = await fetch(confUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` }
    });
    
    if (!confResp.ok) {
      throw new Error(`Failed to fetch confirmations: ${await confResp.text()}`);
    }
    
    const { records: confs } = await confResp.json();
    console.log(`🔎 Found ${confs.length} new confirmations to process`);

    // If no confirmations to process, exit early to save API calls
    if (confs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No confirmations to process' })
      };
    }

    let processedCount = 0;
    let chargedCount = 0;
    let errorCount = 0;

    for (let conf of confs) {
      try {
        const confId = conf.id;
        const { fields } = conf;
        const goalId = fields['Goal Record ID'];
        const verdict = fields['Completion']; // "Yes" or "No"

        if (!goalId || !verdict) {
          console.warn(`⚠️ Skipping incomplete confirmation ${confId}: missing goalId or verdict`);
          errorCount++;
          continue;
        }

        // 2️⃣ Update the Goals table with the verdict
        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(GOALS_TABLE)}/${goalId}`,
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

        // 3️⃣ If they said "No", charge immediately
        if (verdict === 'No') {
          // Fetch the goal record to get stake + customer info
          const goalRes = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(GOALS_TABLE)}/${goalId}`,
            { headers: { Authorization: `Bearer ${AIRTABLE_KEY}` } }
          );

          if (!goalRes.ok) {
            console.error(`❌ Failed to fetch goal ${goalId}: ${await goalRes.text()}`);
            errorCount++;
            continue;
          }

          const { fields: goal } = await goalRes.json();

          // Only charge if still "Card on file (test)" and a Customer ID exists
          if (goal['Payment status'] === 'Card on file (test)' && goal['Customer ID']) {
            try {
              const methods = await stripe.paymentMethods.list({
                customer: goal['Customer ID'],
                type: 'card'
              });

              if (methods.data.length > 0) {
                const stakeAmount = Math.round((goal['Money Stake USD'] || 0) * 100);
                
                await stripe.paymentIntents.create({
                  amount: stakeAmount,
                  currency: 'usd',
                  customer: goal['Customer ID'],
                  payment_method: methods.data[0].id,
                  off_session: true,
                  confirm: true,
                  description: `Charge for failed goal: ${goal['Goal']}`
                });

                // Mark as charged
                await fetch(
                  `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(GOALS_TABLE)}/${goalId}`,
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

                console.log(`⚡ Charged goal ${goalId} ($${goal['Money Stake USD']})`);
                chargedCount++;
              } else {
                console.warn(`⚠️ No payment methods found for customer ${goal['Customer ID']}`);
              }
            } catch (stripeError) {
              console.error(`❌ Stripe error for goal ${goalId}:`, stripeError.message);
              errorCount++;
              continue;
            }
          } else {
            console.log(`ℹ️ Skipping charge for goal ${goalId}: ${goal['Payment status'] || 'No payment status'}, Customer: ${goal['Customer ID'] || 'None'}`);
          }
        }

        // 4️⃣ Mark this confirmation as processed
        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(CONF_TABLE)}/${confId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${AIRTABLE_KEY}`
            },
            body: JSON.stringify({
              fields: { Processed: true }
            })
          }
        );

        processedCount++;
        console.log(`✅ Processed confirmation ${confId}: ${verdict}`);

      } catch (error) {
        console.error(`❌ Error processing confirmation ${conf.id}:`, error.message);
        errorCount++;
      }
    }

    const summary = {
      totalConfirmations: confs.length,
      processed: processedCount,
      charged: chargedCount,
      errors: errorCount
    };

    console.log('📊 Processing summary:', summary);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ${processedCount}/${confs.length} confirmations`,
        charged: chargedCount,
        errors: errorCount,
        summary
      })
    };

  } catch (error) {
    console.error('❌ Fatal error in check-confirmations:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        message: 'Failed to process confirmations'
      })
    };
  }
};
