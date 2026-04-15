import fs from 'fs';

const apiKey = "key_live_cde09edb5b6b40a08a64169adf628534";
const apiSecret = "secret_live_b8e98d5f22ca4bc4b51dad0999572541";
const baseUrl = "https://api.sandbox.co.in";
const gstin = "08AABCJ0355R1Z7";

const authRes = await fetch(`${baseUrl}/authenticate`, {
  method: 'POST',
  headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' }
});
const authData = await authRes.json();
const token = authData.access_token;
console.log("Token:", token ? "SUCCESS" : authData);

const headers = {
  'x-api-key': apiKey,
  'authorization': `Bearer ${token}`,
  'x-api-version': '1.0',
  'Content-Type': 'application/json'
};

const res = await fetch(`${baseUrl}/gst/compliance/taxpayer/${gstin}`, { method: 'GET', headers });
console.log("Status:", res.status);
console.log(await res.text());
