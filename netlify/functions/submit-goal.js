// Native fetch is available in Node 22 but Netlify still needs it declared in pkg.json
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const AIRTABLE_BASE  = 'appXTQ0JUx74XJmAA';
const AIRTABLE_TABLE = 'tblyuW8pf6ZkFRfte';
const AIRTABLE_KEY   = process.env.AIRTABLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }

  try {
    const b = JSON.parse(event.body || '{}');
    const payload = {
      fields:{
        Goal: b.goal,
        'Deadline Date': b.deadline,
        'Money Stake USD': b.stake,
        'Referee Email': b.supervisorEmail,
        Name: b.userEmail.split('@')[0],
        'User Email': b.userEmail
      }
    };

    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${AIRTABLE_KEY}`},
      body:JSON.stringify(payload)
    });
    if(!res.ok){
      const txt = await res.text();
      return { statusCode: res.status, headers: cors(), body: txt };
    }
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ success:true }) };

  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};

function cors () {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };
}
