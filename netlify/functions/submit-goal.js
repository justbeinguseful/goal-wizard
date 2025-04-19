// netlify/functions/submit-goal.js

exports.handler = async (event) => {
  const { goal, deadline, stake, supervisor } = JSON.parse(event.body);

  const AIRTABLE_BASE  = 'appXTQ0JUx74XJmAA';
  const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
  const AIRTABLE_KEY   = process.env.AIRTABLE_KEY;

  // using global fetch…

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
          "Goal":            goal,
          "Deadline Date":   deadline,
          "Money Stake USD": parseFloat(stake),
          "Referee Email":   supervisor
        }
      })
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    return { statusCode: resp.status, body: JSON.stringify(data) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
