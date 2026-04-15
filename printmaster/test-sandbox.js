import fs from 'fs';

const apiKey = process.env.VITE_SANDBOX_API_KEY || "key_live_2ba0a94df3734b2b88efc5095011f0ee";
const apiSecret = process.env.VITE_SANDBOX_API_SECRET || "secret_live_b8e98d5f22ca4bc4b51dad0999572541";
const baseUrl = "https://api.sandbox.co.in";
const gstin = "08AABCJ0355R1Z7";

const out = [];
const authRes = await fetch(`${baseUrl}/authenticate`, {
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
  { method: 'GET', url: `/gst/compliance/taxpayer/${gstin}` },
  { method: 'POST', url: `/gst/compliance/taxpayer`, body: { gstin } },
  { method: 'POST', url: `/gst/compliance/taxpayer/search`, body: { gstin } }
];

for (let t of tests) {
  const opts = { method: t.method, headers };
  if (t.body) opts.body = JSON.stringify(t.body);
  const res = await fetch(`${baseUrl}${t.url}`, opts);
  const txt = await res.text();
  out.push({ method: t.method, url: t.url, status: res.status, res: txt.substring(0,250) });
}
fs.writeFileSync('sandbox-test-res.json', JSON.stringify(out, null, 2));
