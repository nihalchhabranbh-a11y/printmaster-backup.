import fs from 'fs';

const apiKey = "key_live_2ba0a94df3734b2b88efc5095011f0ee";
const apiSecret = "secret_live_b8e98d5f22ca4bc4b51dad0999572541";
const baseUrl = "https://api.sandbox.co.in";
const gstin = "08AABCJ0355R1Z7";

async function doTest(version) {
  const h = version ? { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': version } : { 'x-api-key': apiKey, 'x-api-secret': apiSecret };
  const authRes = await fetch(`${baseUrl}/authenticate`, { method: 'POST', headers: h });
  const authData = await authRes.json();
  const token = authData.access_token;
  
  const headers = version ? {
    'x-api-key': apiKey,
    'authorization': `Bearer ${token}`,
    'x-api-version': version,
    'Content-Type': 'application/json'
  } : {
    'x-api-key': apiKey,
    'authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const res = await fetch(`${baseUrl}/gst/compliance/taxpayer/${gstin}`, { method: 'GET', headers });
  console.log(`Version: ${version || 'none'} ->`, res.status, await res.text());
}

await doTest('1.0');
await doTest('2.0');
await doTest(null);
