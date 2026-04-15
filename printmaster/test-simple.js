import fs from 'fs';

// Test BOTH auth methods side by side
const apiKey = "key_live_2ba0a94df3734b2b88efc5095011f0ee";
const apiSecret = "secret_live_b8e98d5f22ca4bc4b51dad0999572541";
const baseUrl = "https://api.sandbox.co.in";
const gstin = "08AABCJ0355R1Z7";

const results = [];

// METHOD 1: Simple x-api-key only (like Android app)
console.log("--- Method 1: Simple x-api-key (Android style) ---");
const res1 = await fetch(`${baseUrl}/gst/compliance/taxpayer/${gstin}`, {
  method: 'GET',
  headers: {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});
const txt1 = await res1.text();
console.log("Status:", res1.status);
console.log("Response:", txt1.substring(0, 200));
results.push({ method: "simple-api-key", status: res1.status, body: txt1.substring(0, 300) });

// METHOD 2: 2-step auth with Bearer token (current web proxy)
console.log("\n--- Method 2: 2-step Bearer token ---");
const authRes = await fetch(`${baseUrl}/authenticate`, {
  method: 'POST',
  headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' }
});
const authData = await authRes.json();
const token = authData.access_token;

const res2 = await fetch(`${baseUrl}/gst/compliance/taxpayer/${gstin}`, {
  method: 'GET',
  headers: {
    'x-api-key': apiKey,
    'authorization': `Bearer ${token}`,
    'x-api-version': '1.0',
    'Content-Type': 'application/json'
  }
});
const txt2 = await res2.text();
console.log("Status:", res2.status);
console.log("Response:", txt2.substring(0, 200));
results.push({ method: "2-step-bearer", status: res2.status, body: txt2.substring(0, 300) });

fs.writeFileSync('test-simple-res.json', JSON.stringify(results, null, 2));
console.log("\nResults saved to test-simple-res.json");
