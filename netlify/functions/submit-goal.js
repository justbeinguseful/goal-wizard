// File: netlify/functions/submit-goal.js

exports.handler = async (event) => {
  try {
    // Parse incoming data from the frontend
    const { goal, deadline, stake, referee, userEmail, terms } = JSON.parse(event.body);

    // Airtable configuration
    const AIRTABLE_BASE  = 'appXTQ0JUx74XJmAA';
    const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
    const AIRTABLE_KEY   = process.env.AIRTABLE_KEY;

    // Write a new record to Airtable
    const resp = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${AIRTABLE_KEY}`
        },
        body: JSON.stringify({
          fields: {
            "Goal":             goal,
            "Deadline Date":    deadline,
            "Money Stake USD":  parseFloat(stake),
            "Referee Email":    referee,
            "User Email":       userEmail,
            "Terms Accepted":   terms ? 'Yes' : 'No'
          }
        })
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      // Return error status and message
      return {
        statusCode: resp.status,
        body: JSON.stringify({ error: data })
      };
    }

    // Success
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Error in submit-goal:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
