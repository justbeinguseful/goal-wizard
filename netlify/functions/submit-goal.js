// netlify/functions/submit-goal.js – adjusted to match your Airtable columns exactly

const fetch = require('node-fetch');

exports.handler = async (event) => {
  const {
    name,          // e.g. "Jesper B"
    email,         // your own email (not the referee)
    goal,
    deadline,
    stake,
    refereeName,
    supervisor,    // referee email
    termsChecked   // boolean ✓ terms accepted
  } = JSON.parse(event.body);

  const AIRTABLE_BASE  = 'appXTQ0JUx74XJmAA';
  const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
  const AIRTABLE_KEY   = process.env.AIRTABLE_KEY;

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
          "Name":           name,
          "Email":          email,
          "Goal":           goal,
          "Deadline Date":  deadline,
          "Referee Name":   refereeName,
          "Referee Email":  supervisor,
          "Money Stake USD": Number(stake),
          "Terms":          !!termsChecked,
          "Payment status": "Card on file (test)" // optional status column
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
