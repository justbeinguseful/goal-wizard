// netlify/functions/check-deadlines.js
const fetch = require('node-fetch');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async () => {
  const AIRTABLE_BASE = 'appXTQ0JUx74XJmAA';
  const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
  const AIRTABLE_KEY = process.env.AIRTABLE_KEY;

  try {
    // Find records that are 4+ days past deadline and still "Pending"
    const today = new Date().toISOString().split('T')[0];
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];
    
    // Query Airtable for overdue records
    const formula = encodeURIComponent(`AND({Deadline Date} <= "${fourDaysAgoStr}", {Goal Achieved} = "Pending")`);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula=${formula}`;
    
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_KEY}`
      }
    });
    
    if (!resp.ok) {
      throw new Error(`Airtable fetch failed: ${await resp.text()}`);
    }
    
    const { records } = await resp.json();
    console.log(`Found ${records.length} overdue records`);
    
    let results = [];
    
    // Process each overdue record
    for (const record of records) {
      try {
        const { id, fields } = record;
        const stake = fields['Money Stake USD'] || 0;
        const email = fields['Email'];
        const paymentStatus = fields['Payment status'];
        
        // Skip if not in "Card on file (test)" status
        if (paymentStatus !== 'Card on file (test)') {
          console.log(`Skipping record ${id} - payment status is ${paymentStatus}`);
          continue;
        }
        
        // Mark the goal as not achieved
        const updateResp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AIRTABLE_KEY}`
          },
          body: JSON.stringify({
            fields: {
              "Goal Achieved": "No"
            }
          })
        });
        
        if (!updateResp.ok) {
          throw new Error(`Failed to update record ${id}: ${await updateResp.text()}`);
        }
        
        console.log(`Updated record ${id} - Goal Achieved = No`);
        
        // Attempt to charge if we have customer ID or payment method
        if (fields['Customer ID']) {
          // Find customer's payment methods
          const paymentMethods = await stripe.paymentMethods.list({
            customer: fields['Customer ID'],
            type: 'card'
          });
          
          if (paymentMethods.data.length > 0) {
            // Create and confirm payment intent
            const paymentIntent = await stripe.paymentIntents.create({
              amount: Math.round(stake * 100), // Convert to cents
              currency: 'usd',
              customer: fields['Customer ID'],
              payment_method: paymentMethods.data[0].id,
              off_session: true,
              confirm: true,
              description: `Charge for failed goal: ${fields['Goal']}`
            });
            
            // Update payment status
            await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${id}`, {
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
            
            console.log(`Charged customer for record ${id}`);
            results.push({ id, status: 'charged', amount: stake });
          } else {
            console.log(`No payment methods found for customer ${fields['Customer ID']}`);
            results.push({ id, status: 'no_payment_methods' });
          }
        } else {
          // No customer ID - can't charge
          console.log(`No customer ID for record ${id}`);
          results.push({ id, status: 'no_customer_id' });
        }
      } catch (error) {
        console.error(`Error processing record: ${error}`);
        
        // If this was a payment error, update the record
        try {
          await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${record.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${AIRTABLE_KEY}`
            },
            body: JSON.stringify({
              fields: {
                "Payment status": "Charge Failed"
              }
            })
          });
        } catch (updateError) {
          console.error(`Failed to update payment status: ${updateError}`);
        }
        
        results.push({ id: record.id, status: 'error', error: error.message });
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Processed ${records.length} overdue records`,
        results
      })
    };
  } catch (error) {
    console.error('Error in check-deadlines:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
