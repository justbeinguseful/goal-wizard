// netlify/functions/submit-goal.js

// Airtable API
const fetch = require('node-fetch');
const AIRTABLE_BASE  = 'appXTQ0JUx74XJmAA';
const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
const AIRTABLE_KEY   = process.env.AIRTABLE_KEY;

exports.handler = async (event) => {
  // 1) CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  let { goal, deadline, stake, supervisorEmail, userEmail } = {};
  try {
    ({ goal, deadline, stake, supervisorEmail, userEmail } = JSON.parse(event.body));
  } catch (err) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const payload = {
    fields: {
      Goal:            goal,
      'Deadline Date': deadline,
      'Money Stake USD': parseFloat(stake),
      'Referee Email': supervisorEmail,
      Name:            userEmail.split('@')[0],  // auto‑extract name
      'User Email':    userEmail
    }
  };

  try {
    const resp = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${AIRTABLE_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await resp.json();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(data)
      };
    }
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
