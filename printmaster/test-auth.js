import fs from 'fs';

const apiKey = "key_live_2ba0a94df3734b2b88efc5095011f0ee";
const apiSecret = "secret_live_b8e98d5f22ca4bc4b51dad0999572541";
const baseUrl = "https://api.sandbox.co.in";
const testUrl = "https://test-api.sandbox.co.in";

async function test(url) {
  const authRes = await fetch(`${url}/authenticate`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' }
  });
  console.log("Auth status for", url, authRes.status);
}

await test(baseUrl);
await test(testUrl);
