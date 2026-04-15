import fs from 'fs';

const gstin = "08AABCJ0355R1Z7";
const results = [];

// Test 1: GST Portal API
try {
  const res = await fetch(`https://services.gst.gov.in/services/api/search/taxpayerDetails?gstin=${gstin}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
  });
  const txt = await res.text();
  results.push({ name: "gst.gov.in", status: res.status, body: txt.substring(0, 500) });
} catch(e) { results.push({ name: "gst.gov.in", error: e.message }); }

// Test 2: Masters India public
try {
  const res = await fetch(`https://commonapi.mastersindia.co/commonapis/searchgstin?gstin=${gstin}`, {
    headers: { 'Accept': 'application/json' }
  });
  const txt = await res.text();
  results.push({ name: "mastersindia", status: res.status, body: txt.substring(0, 500) });
} catch(e) { results.push({ name: "mastersindia", error: e.message }); }

// Test 3: Appyflow free tier
try {
  const res = await fetch(`https://appyflow.in/api/verifyGST?gstNo=${gstin}`, {
    headers: { 'Accept': 'application/json' }
  });
  const txt = await res.text();
  results.push({ name: "appyflow", status: res.status, body: txt.substring(0, 500) });
} catch(e) { results.push({ name: "appyflow", error: e.message }); }

fs.writeFileSync('free-gst-results.json', JSON.stringify(results, null, 2));
console.log("Done! Results saved.");
