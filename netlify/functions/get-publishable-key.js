// netlify/functions/get-publishable-key.js

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publishableKey: process.env.NETLIFY_PUBLISHABLE_KEY
    })
  }
}
