// netlify/functions/submit-goal.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // 1️⃣ Destructure the incoming payload (add customerId here if you start returning it)
  const {
    name,
    email,
    goal,
    deadline,
    stake,
    supervisor,     // referee’s email
    termsChecked,
    paymentStatus,
    customerId      // optional: if you return it from create-setup-intent
  } = JSON.parse(event.body);

  // 2️⃣ Airtable config
  const AIRTABLE_BASE  = 'appXTQ0JUx74XJmAA';
  const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
  const AIRTABLE_KEY   = process.env.AIRTABLE_KEY;

  // 3️⃣ Build the record payload
  const fields = {
    "Name":            name,
    "Email":           email,
    "Goal":            goal,
    "Deadline Date":   deadline,
    "Referee Email":   supervisor,
    "Money Stake USD": Number(stake),
    "Terms":           termsChecked,
    "Payment status":  paymentStatus,
    "Goal Achieved":   "Pending"        // ← newly added default field
  };

  // 4️⃣ If you’ve started sending back a customerId, include it too:
  if (customerId) {
    fields["Customer ID"] = customerId;
  }

  // 5️⃣ POST to Airtable
  const resp = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AIRTABLE_KEY}`
      },
      body: JSON.stringify({ fields })
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    return { statusCode: resp.status, body: JSON.stringify(data) };
  }

  // 6️⃣ Success
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
