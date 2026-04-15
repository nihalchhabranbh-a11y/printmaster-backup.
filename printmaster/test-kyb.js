import fs from 'fs';

const apiKey = "key_live_2ba0a94df3734b2b88efc5095011f0ee";
const apiSecret = "secret_live_b8e98d5f22ca4bc4b51dad0999572541";
const testUrl = "https://test-api.sandbox.co.in";
const liveUrl = "https://api.sandbox.co.in";
const gstin = "08AABCJ0355R1Z7";

const authRes = await fetch(`${liveUrl}/authenticate`, {
  method: 'POST',
  headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' }
});
const authData = await authRes.json();
const token = authData.access_token;

const headers = {
  'x-api-key': apiKey,
  'authorization': `Bearer ${token}`,
  'x-api-version': '1.0',
  'Content-Type': 'application/json'
};

const tests = [
  { method: 'POST', url: `/kyb/gst`, body: { gstin } },
  { method: 'POST', url: `/kyb/gst/verify`, body: { gstin } },
  { method: 'GET', url: `/kyb/gst?gstin=${gstin}` },
  { method: 'POST', url: `/kyc/gst/verify`, body: { gstin } },
  { method: 'POST', url: `/kyc/gst`, body: { gstin } }
];

for (let t of tests) {
  const opts = { method: t.method, headers };
  if (t.body) opts.body = JSON.stringify(t.body);
  const res = await fetch(`${liveUrl}${t.url}`, opts);
  const txt = await res.text();
  console.log(t.method, t.url, "Status:", res.status, txt.substring(0, 50).replace(/\n/g, ' '));
}
