/**
 * aiLearnMemory.js  —  PrintMaster AI — 10-Level Intelligence Brain
 * ──────────────────────────────────────────────────────────────────
 * L1  — Persistent Memory     (patterns saved to localStorage)
 * L2  — Predictive Billing    (suggest repeat bill instantly)
 * L3  — Reasoning Chain       (explain decision step by step)
 * L4  — Self-Correction       (learn from user edits)
 * L5  — Rate Change Alerts    (warn when rate differs from last time)
 * L6  — Due/Credit Tracking   (per-customer balance awareness)
 * L7  — Recurring Radar       (flag customers not billed in 7+ days)
 * L8  — Smart Rate Suggestion (avg rate across similar customers)
 * L9  — Digest Summary        (weekly/daily business snapshot)
 * L10 — Conversation Memory   (persist full chat for context)
 */

const STORAGE_KEY = "printmaster_ai_learn_v2";
const CHAT_KEY    = "printmaster_ai_chat_v1";

// ── Internal helpers ─────────────────────────────────────────────

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { patterns: [], rateMap: {}, corrections: [] };
}

function saveDB(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) {}
}

// ── L1/L2: Learn from Bill & Predict ─────────────────────────────

/**
 * L1: Learn from a newly created bill.
 */
export function learnFromBill({ customerName, customerId, items = [] }) {
  if (!customerName || items.length === 0) return;
  const db = loadDB();
  const ts = Date.now();

  for (const item of items) {
    const { name: productName, productId, rate, qty, description } = item;
    if (!productName) continue;
    const key = `${(customerId || customerName).toLowerCase()}::${(productId || productName).toLowerCase()}`;
    const prevEntry = db.patterns.find(p => p.key === key);
    const previousRate = prevEntry?.rate ?? null;

    db.rateMap[key] = { rate, previousRate, updatedAt: ts };

    if (prevEntry) {
      Object.assign(prevEntry, {
        rate, qty, description: description || prevEntry.description,
        count: (prevEntry.count || 1) + 1,
        lastUsed: ts, previousRate,
      });
    } else {
      db.patterns.push({
        key, customerName, customerId: customerId || null,
        productName, productId: productId || null,
        rate, qty, description: description || null,
        count: 1, lastUsed: ts, previousRate,
      });
    }
  }
  saveDB(db);
}

/**
 * L4: Record a correction the user made to an AI-generated bill.
 */
export function recordCorrection({ customerName, productName, field, oldValue, newValue }) {
  if (!customerName || !field) return;
  const db = loadDB();
  db.corrections = db.corrections || [];
  db.corrections.unshift({ customerName, productName, field, oldValue, newValue, ts: Date.now() });
  if (db.corrections.length > 50) db.corrections.length = 50;
  saveDB(db);
}

/**
 * L2: Get all past orders for a customer (by partial name match).
 */
export function getAllSuggestionsForCustomer(query) {
  if (!query || query.trim().length < 2) return [];
  const db = loadDB();
  const q = query.toLowerCase().trim();
  return db.patterns
    .filter(p => {
      const c = (p.customerName || "").toLowerCase();
      return c.includes(q) || q.split(" ").some(w => w.length > 2 && c.includes(w));
    })
    .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, 5);
}

export function getSuggestionForCustomer(query) {
  const all = getAllSuggestionsForCustomer(query);
  return all.length > 0 ? all[0] : null;
}

/**
 * L5: Check if a rate has changed compared to last time.
 * Returns { changed, oldRate, newRate } or null.
 */
export function checkRateChange(customerName, productName, newRate) {
  const db = loadDB();
  const q = customerName.toLowerCase();
  const p = db.patterns.find(pat =>
    (pat.customerName || "").toLowerCase().includes(q) &&
    (pat.productName || "").toLowerCase().includes(productName.toLowerCase())
  );
  if (!p || p.rate === newRate || !p.rate) return null;
  return { changed: true, oldRate: p.rate, newRate };
}

/**
 * L6: Get unpaid balance for a customer from bills array.
 */
export function getCustomerDue(customerName, bills = []) {
  if (!customerName || !bills.length) return 0;
  const q = customerName.toLowerCase();
  return bills
    .filter(b => !b.paid && b.status !== "draft" && (b.customer || "").toLowerCase().includes(q))
    .reduce((sum, b) => sum + (b.total || 0), 0);
}

/**
 * L7: Get customers from bills who haven't been billed in the last `days` days.
 */
export function getRecurringRadar(bills = [], days = 7) {
  if (!bills.length) return [];
  const cutoff = Date.now() - days * 86400000;
  const lastBillDate = {};
  for (const b of bills) {
    const name = (b.customer || "").trim();
    if (!name) continue;
    const ts = new Date(b.createdAt || b.created_at || 0).getTime();
    if (!lastBillDate[name] || ts > lastBillDate[name]) lastBillDate[name] = ts;
  }
  return Object.entries(lastBillDate)
    .filter(([, ts]) => ts < cutoff)
    .map(([name, ts]) => ({ customerName: name, daysSince: Math.floor((Date.now() - ts) / 86400000) }))
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);
}

/**
 * L8: Recommend an average rate for a product across all customers.
 */
export function getSmartRateRecommendation(productName) {
  if (!productName) return null;
  const db = loadDB();
  const p = productName.toLowerCase();
  const matching = db.patterns.filter(pat => (pat.productName || "").toLowerCase().includes(p));
  if (!matching.length) return null;
  const avg = matching.reduce((sum, pat) => sum + (pat.rate || 0), 0) / matching.length;
  const min = Math.min(...matching.map(x => x.rate || 0));
  const max = Math.max(...matching.map(x => x.rate || 0));
  return { avg: Math.round(avg * 100) / 100, min, max, samples: matching.length };
}

/**
 * L9: Generate a weekly business digest.
 */
export function getWeeklyDigest(bills = []) {
  if (!bills.length) return null;
  const cutoff = Date.now() - 7 * 86400000;
  const recent = bills.filter(b => new Date(b.createdAt || b.created_at || 0).getTime() >= cutoff);
  if (!recent.length) return null;
  const total = recent.reduce((s, b) => s + (b.total || 0), 0);
  const paid  = recent.filter(b => b.paid).reduce((s, b) => s + (b.total || 0), 0);
  const unpaidCount = recent.filter(b => !b.paid && b.status !== "draft").length;
  const byCustomer = {};
  for (const b of recent) {
    const c = b.customer || "Unknown";
    byCustomer[c] = (byCustomer[c] || 0) + (b.total || 0);
  }
  const topCustomer = Object.entries(byCustomer).sort((a, b) => b[1] - a[1])[0];
  return {
    billCount: recent.length, total: Math.round(total), paid: Math.round(paid),
    unpaidCount, topCustomer: topCustomer ? { name: topCustomer[0], revenue: Math.round(topCustomer[1]) } : null,
  };
}

// ── L10: Conversation Memory ─────────────────────────────────────

/**
 * L10: Save the conversation messages to localStorage for next session.
 */
export function saveConversation(messages = []) {
  try {
    const toSave = messages.slice(-40); // keep last 40
    localStorage.setItem(CHAT_KEY, JSON.stringify(toSave));
  } catch (e) {}
}

/**
 * L10: Load saved conversation from last session.
 */
export function loadConversation() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

/**
 * L10: Clear saved conversation.
 */
export function clearConversation() {
  localStorage.removeItem(CHAT_KEY);
}

/**
 * Hard reset all AI data.
 */
export function clearLearnedData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHAT_KEY);
}
