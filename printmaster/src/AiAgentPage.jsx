/**
 * AiAgentPage.jsx  ·  PrintMaster Web AI Agent
 * Full-featured AI chat for the web (Vite) version.
 * Powered by the same zero-API, offline engine logic from the mobile app.
 * Works with existing products[], bills[], customers[] from App.jsx
 */

import { useState, useRef, useEffect } from "react";
import {
  learnFromBill, getSuggestionForCustomer, getAllSuggestionsForCustomer,
  checkRateChange, getCustomerDue, getRecurringRadar,
  getSmartRateRecommendation, getWeeklyDigest,
  saveConversation, loadConversation, clearConversation,
} from "./aiLearnMemory.js";

// ── Built-in product keyword map (with misspelling variants) ─────────────────
const BUILTIN_KEYWORDS = {
  "Normal Flex": ["normal", "nf", "plain", "simple", "ordinary", "sadharan",
    "norel", "norml", "normle", "norma", "nrml", "nromal",
    "normafl", "noraml", "normfl", "normalf",
    "normlf", "nfl", "nflex", "n flex"],
  "Star Flex": ["star", "sf", "premium star", "star flex",
    "str", "ster", "sstar", "starr", "starf",
    "fixe", "fxle", "staflex"],
  "Vinyl": ["vinyl", "self adhesive", "sticker", "self-adhesive",
    "vinly", "viny", "vnil", "vnyl"],
  "Banner": ["banner", "flex banner", "outdoor",
    "baner", "bannr", "banerr"],
  "Backlit Flex": ["backlit", "glow", "night flex", "light", "bl",
    "backlight", "baclit", "bklit"],
  "ACP Board": ["acp", "board", "metal", "aluminium", "sign board",
    "acpb", "signboard", "sgnboard", "alum"],
};

// ── Fuzzy matching engine ──────────────────────────────────────────────────
// Scores how similar two strings are (0–1). Works on misspelled/broken text.
function fuzzyScore(query, target) {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.includes(q) || q.includes(t)) return 0.85;

  // Bigram overlap: break into 2-char chunks and count matches
  const bigrams = (s) => {
    const out = new Set();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const qb = bigrams(q), tb = bigrams(t);
  let shared = 0;
  qb.forEach(b => { if (tb.has(b)) shared++; });
  const bigramScore = (2 * shared) / (qb.size + tb.size + 0.001);

  // Consonant skeleton: strip vowels and compare (handles vowel misspellings)
  const stripVowels = (s) => s.replace(/[aeiou]/gi, "");
  const qc = stripVowels(q), tc = stripVowels(t);
  let consonantScore = 0;
  if (qc && tc) {
    const overlap = [...qc].filter(ch => tc.includes(ch)).length;
    consonantScore = (overlap / Math.max(qc.length, 1)) >= 0.6 ? 0.7 : 0;
  }

  // Starts-with bonus (first 2 chars is enough for a small bonus)
  const startBonus = t.startsWith(q.slice(0, 2)) || q.startsWith(t.slice(0, 2)) ? 0.2 : 0;

  return Math.min(1, bigramScore + consonantScore * 0.4 + startBonus);
}

function findProduct(text, products) {
  const ltext = text.toLowerCase();
  // Split text into words for word-level fuzzy matching
  const words = ltext.split(/[\s,;]+/).filter(w => w.length > 1);

  let best = null, bestScore = 0;

  for (const prod of products) {
    let score = 0;
    const prodNameWords = prod.name.toLowerCase().split(/\s+/);

    // 1. Exact whole-name substring match (highest priority)
    if (ltext.includes(prod.name.toLowerCase())) score += 10;

    // 2. Fuzzy match each input word against each product name word
    words.forEach(w => {
      prodNameWords.forEach(pw => {
        const fs = fuzzyScore(w, pw);
        if (fs > 0.55) score += fs * 3;
      });
    });

    // 3. DB keywords (exact then fuzzy)
    if (prod.keywords) {
      const kws = prod.keywords.split(/[,\s]+/).map(k => k.trim().toLowerCase()).filter(Boolean);
      kws.forEach(kw => {
        if (kw.length < 2) return;
        if (ltext.includes(kw)) { score += 5; return; }
        words.forEach(w => { const fs = fuzzyScore(w, kw); if (fs > 0.6) score += fs * 4; });
      });
    }

    // 4. Built-in keyword map (exact then fuzzy)
    for (const [bName, kws] of Object.entries(BUILTIN_KEYWORDS)) {
      if (!prod.name.toLowerCase().includes(bName.toLowerCase())) continue;
      kws.forEach(kw => {
        if (ltext.includes(kw)) { score += 6; return; }
        words.forEach(w => { const fs = fuzzyScore(w, kw); if (fs > 0.65) score += fs * 5; });
      });
    }

    if (score > bestScore) { bestScore = score; best = prod; }
  }

  // Fallback: try BUILTIN_KEYWORDS alone (fuzzy)
  if (!best || bestScore < 1) {
    let fallbackBest = null, fallbackScore = 0;
    for (const [bName, kws] of Object.entries(BUILTIN_KEYWORDS)) {
      let s = 0;
      kws.forEach(kw => {
        if (ltext.includes(kw)) { s += 6; return; }
        words.forEach(w => { const fs = fuzzyScore(w, kw); if (fs > 0.6) s += fs * 5; });
      });
      if (s > fallbackScore) { fallbackScore = s; fallbackBest = bName; }
    }
    if (fallbackBest && fallbackScore > 1) {
      const kws = BUILTIN_KEYWORDS[fallbackBest];
      return { id: "", name: fallbackBest, default_rate: 0, keywords: kws.join(", "), unit: "SQFT" };
    }
    return null;
  }
  return best;
}


function extractDim(text) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*ft\s*[xX×*]\s*(\d+(?:\.\d+)?)\s*ft/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const w = parseFloat(m[1]), h = parseFloat(m[2]); if (w > 0 && h > 0) return { w, h }; }
  }
  return null;
}

function extractPhone(text) {
  const m = text.match(/(?:\+91|0|91)?[6-9]\d{9}/);
  if (!m) return null;
  const n = m[0].replace(/^\+91|^91|^0/, "");
  return n.length === 10 ? n : null;
}

function extractQty(text) {
  // Only match explicit qty/pcs/nos keywords — do NOT match the 'x' in dimensions like '6x4'
  const pats = [/qty\s*:?\s*(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)\s+pcs/i, /(\d+(?:\.\d+)?)\s+nos/i, /(?:^|\s)(\d+(?:\.\d+)?)\s+pieces/i];
  for (const p of pats) { const m = text.match(p); if (m) return parseFloat(m[1]); }
  return 1;
}

function extractRate(text) {
  const m = text.match(/(?:@|at|rate|rs\.?|₹)\s*:?\s*(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : null;
}

// sellerName = logged-in user's name (excluded from customer detection)
function extractCustomer(text, productName, sellerName) {
  // Build a list of words to strip: seller name parts + common operator words
  const sellerWords = (sellerName || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
  let clean = text
    .replace(/(?:\+91|0|91)?[6-9]\d{9}/g, "")
    .replace(/\d+(?:\.\d+)?\s*[xX\u00d7*]\s*\d+(?:\.\d+)?/g, "")
    .replace(/\d+/g, "")
    .replace(/rs\.?|\u20b9|sqft|sq\.?\s?ft|print|banner|flex|vinyl|vinly|viny|normal|norml|norel|nomre|noel|star|backlit|for|from|to|order|please|hi|hello|dear|thanks|sir|make|bill|create|invoice|pcs|qty|quantity|acp|board|rate[d]?|reted|reated|fixe|flxe|fxle|stiker|stikers|baner|sticker|scholl|school|size|sixe|noem|noel|nomr|vinyl|viyl/gi, "");
  if (productName) productName.split(" ").forEach(w => { clean = clean.replace(new RegExp(w, "gi"), ""); });
  // Remove seller's own name parts (so Nihal typing wont extract "Nihal" as customer)
  sellerWords.forEach(w => { clean = clean.replace(new RegExp(`\\b${w}\\b`, "gi"), ""); });
  const words = clean.match(/\b[a-z]{3,}\b/gi);
  if (!words || words.length === 0) return null;
  // Filter out any remaining seller-name variants
  const filtered = words.filter(w => !sellerWords.some(sw => w.toLowerCase().includes(sw)));
  return filtered.length > 0 ? filtered.slice(0, 2).join(" ") : null;
}

function lookupCustomer(name, phone, customers) {
  if (!customers.length) return null;
  // 1. Exact phone match (most reliable)
  if (phone) {
    const byPhone = customers.find(c => (c.phone || "").replace(/\D/g, "").slice(-10) === phone);
    if (byPhone) return { name: byPhone.name, phone: byPhone.phone || phone };
  }
  // 2. Name fuzzy match — take best word-pairing score
  if (name && name.trim().length >= 3) {
    const lname = name.toLowerCase().trim();
    let bestMatch = null, bestScore = 0;
    for (const c of customers) {
      const cn = (c.name || "").toLowerCase();
      // Exact substring - only for meaningful lengths to avoid matching 1-char junk names
      if (cn === lname || (cn.length > 3 && (cn.includes(lname) || lname.includes(cn)))) {
        return { name: c.name, phone: c.phone || "" };
      }
      // For each typed word, find its BEST matching DB word (no hard threshold per word)
      const nameWords = lname.split(/\s+/);
      const dbWords = cn.split(/\s+/);
      let wordScore = 0;
      nameWords.forEach(nw => {
        let best = 0;
        dbWords.forEach(dw => { const s = fuzzyScore(nw, dw); if (s > best) best = s; });
        wordScore += best; // accumulate best match per typed word
      });
      const normScore = wordScore / Math.max(nameWords.length, 1);
      if (normScore > bestScore) { bestScore = normScore; bestMatch = c; }
    }
    // Accept if average word-match confidence ≥ 0.38 (allows for heavy broken spellings)
    if (bestMatch && bestScore >= 0.38) {
      return { name: bestMatch.name, phone: bestMatch.phone || "" };
    }
  }
  return null;
}

function recallRate(productId, productName, memory, bills) {
  if (productId && memory.rateHistory && memory.rateHistory[productId]) return memory.rateHistory[productId];
  for (const bill of (bills || [])) {
    const items = bill.items || [];
    const match = items.find(it => (it.name || "").toLowerCase().includes((productName || "").toLowerCase()));
    if (match && match.rate) return Number(match.rate);
  }
  return null;
}

function extractMultiItems(text, products) {
  let segs = [];
  if (text.includes('\n')) {
    segs = text.split('\n').map(s => s.trim()).filter(s => s.length > 2);
  } else {
    segs = text.split(/,|;|\bandand\b|\bthen\b|\+/i).map(s => s.trim()).filter(s => s.length > 2);
  }

  // if (segs.length < 2 && !text.includes('\n')) return { items: [], isMulti: false }; // Removed this line

  const items = [];
  for (const seg of segs) {
    const dim = extractDim(seg);
    const explicitQtyMatch = seg.match(/(?:qty|quantity)\s*:?\s*(\d+(?:\.\d+)?)/i);
    const hasExplicitQty = !!explicitQtyMatch;

    const qty = extractQty(seg);
    const rate = extractRate(seg) || 0;
    const prod = findProduct(seg, products);

    // Provide the original line text as description (just stripping Qty, Rate, and leading numbers)
    let desc = seg;
    desc = desc.replace(/,?\s*(?:qty|quantity)\s*:?\s*\d+(?:\.\d+)?/gi, "");
    desc = desc.replace(/,?\s*(?:@|at|rate|rs\.?|₹)\s*:?\s*\d+(?:\.\d+)?/gi, "");
    desc = desc.replace(/^\d+\.\s*/, "").trim();

    items.push({
      productText: prod?.name || "Unknown",
      width: dim ? dim.w : 0,
      height: dim ? dim.h : 0,
      quantity: qty,
      hasExplicitQty: hasExplicitQty,
      rate: rate,
      description: desc || "Item"
    });
  }
  const validItems = items.filter(it => it.width > 0 || it.hasExplicitQty || it.rate > 0);
  return { items: validItems, isMulti: validItems.length >= 2 || text.includes('\n') };
}

function createMemory() {
  return {
    customerName: null, phone: null,
    lastProductId: null, lastProductName: null, lastRate: null,
    lastWidth: null, lastHeight: null, lastQty: null, lastTotal: null,
    pendingTask: null, pendingField: null,
    rateHistory: {}, orderCount: 0,
  };
}

function detectIntent(msg, memory) {
  const m = msg.toLowerCase().trim();
  if (memory.pendingTask && memory.pendingField) return "ANSWER";
  // Greetings first
  if (m.match(/^(hi|hello|hey|helo|hii|helo|namaste|namaskar|ok|okay|thanks|thank you|ty|good morning|good evening|good afternoon|sup|yo|howdy|hy|hye|hai)[\.!\s]*$/)) return "GREETING";

  // Explicit Bill Creation Commands take absolute priority
  if (m.match(/make.*bill|create.*bill|bill.*for|new.*bill|generate.*bill/)) return "BILL";

  if (m.match(/sales|revenue|earning|how much.*today|today.*total/)) return "QUERY_SALES";
  if (m.match(/this week|weekly|week/)) return "QUERY_WEEKLY";
  if (m.match(/this month|monthly|month/)) return "QUERY_MONTHLY";
  if (m.match(/top customer|best customer|biggest/)) return "QUERY_TOP";
  if (m.match(/unpaid|due|pending|owed|outstanding/)) return "QUERY_UNPAID";
  // Only query products if they aren't explicitly asking to create a bill
  if (m.match(/products?|items?|catalog|what.*sell/)) return "QUERY_PRODUCTS";
  if (m.match(/last.*bill|recent.*bill|latest.*invoice/)) return "QUERY_LAST";
  if (m.match(/help|commands?|what.*can|features?/)) return "QUERY_HELP";

  if (m.match(/,|;|\n|\bandand\b/) && extractDim(msg)) return "BILL";
  if (extractDim(msg)) return "BILL";

  // Checking for history/balance
  if (m.match(/bill|paid|unpaid|due|total|how many|owe|balance|history|invoice/)) return "QUERY_CUSTOMER";
  if (m.match(/customers?|clients?|parties?/)) return "QUERY_CUSTOMERS";
  if (m.match(/update|change|edit|modify/)) return "UPDATE";
  // General intelligence — question words OR any non-billing short text
  if (m.match(/what|who|when|where|why|how|which|define|explain|tell me|is the|are the|color|colour|capital|flag|meaning|difference|formula|calculate|convert|translate|weather|news|latest|current|price of|cost of|rate of/i)) return "QUERY_GENERAL";
  // Any other input that looks like a question or unknown → try web search
  if (m.length > 3) return "QUERY_GENERAL";
  return "UNKNOWN";
}

function handleGreeting(sellerName, bills, customers, products) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayBills = bills.filter(b => (b.createdAt || b.created_at || "").startsWith(todayStr));
  const todaySales = todayBills.reduce((s, b) => s + (b.total || 0), 0);
  const unpaidCount = bills.filter(b => !b.paid && b.status !== "draft").length;
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const seller = sellerName || "Boss";

  const greetings = [
    `${greeting}, **${seller}**! 👋\n\n`,
    `Hello **${seller}**, I'm ready to help you manage your business today. 👋\n\n`,
    `${greeting}! Let's get to work, **${seller}**. 👋\n\n`,
    `Hey **${seller}**, what can I build for you today? 👋\n\n`
  ];
  let msg = greetings[Math.floor(Math.random() * greetings.length)];
  msg += `Here's your business snapshot:\n`;
  msg += `• 📦 **${products.length}** products in catalog\n`;
  msg += `• 👥 **${customers.length}** customers in database\n`;
  if (todaySales > 0) msg += `• 📈 **Today's sales: ₹${todaySales.toFixed(0)}** (${todayBills.length} bills)\n`;
  else msg += `• 📈 No bills created today yet\n`;
  if (unpaidCount > 0) msg += `• 🔴 **${unpaidCount} unpaid** bills pending\n`;
  else msg += `• ✅ All bills are cleared!\n`;
  msg += `\nJust tell me what you need:`;
  msg += `\n📦 Create a bill · 📊 Sales report · 💬 Ask anything`;
  return msg;
}


// ── AI Intelligence Engine ─────────────────────────────────────────────────

// ── Built-in knowledge base ───────────────────────────────────────────────
const KNOWLEDGE_BASE = [
  {
    keys: ["indian flag", "india flag", "flag india", "color indian flag", "colour indian flag", "indian national flag"],
    answer: "🇮🇳 The Indian national flag has three horizontal stripes:\n• 🟠 Top: Saffron (Kesaria) — courage & sacrifice\n• ⚪ Middle: White — peace & truth (with Ashoka Chakra, a 24-spoke blue wheel)\n• 🟢 Bottom: India Green — faith & chivalry", source: "Built-in Knowledge"
  },
  {
    keys: ["usa flag", "american flag", "us flag", "color usa flag", "colour american flag"],
    answer: "🇺🇸 The US flag has 3 colors:\n• 🔴 Red\n• ⚪ White\n• 🔵 Blue\n13 stripes (original colonies) + 50 stars (states).", source: "Built-in Knowledge"
  },
  {
    keys: ["pakistan flag", "color pakistan flag"],
    answer: "🇵🇰 Pakistan's flag is dark green with a white vertical stripe, a white crescent moon, and a white star.", source: "Built-in Knowledge"
  },
  {
    keys: ["capital india", "india capital"],
    answer: "🏛️ Capital of India: **New Delhi**.", source: "Built-in Knowledge"
  },
  {
    keys: ["capital usa", "usa capital", "capital america", "capital united states"],
    answer: "🏛️ Capital of USA: **Washington, D.C.**", source: "Built-in Knowledge"
  },
  {
    keys: ["capital pakistan", "pakistan capital"],
    answer: "🏛️ Capital of Pakistan: **Islamabad**.", source: "Built-in Knowledge"
  },
  {
    keys: ["pm india", "prime minister india", "india prime minister", "who is pm india"],
    answer: "🏛️ Prime Minister of India: **Narendra Modi** (as of 2024).", source: "Built-in Knowledge"
  },
  {
    keys: ["pm pakistan", "prime minister pakistan", "pakistan prime minister", "who is pm pakistan"],
    answer: "🏛️ Prime Minister of Pakistan: **Shehbaz Sharif** (as of 2024).", source: "Built-in Knowledge"
  },
  {
    keys: ["president usa", "usa president", "who is president usa", "american president"],
    answer: "🏛️ President of USA: **Joe Biden** (46th) — succeeded by **Donald Trump** (47th, from Jan 2025).", source: "Built-in Knowledge"
  },
  {
    keys: ["gst", "goods and services tax", "what is gst"],
    answer: "📊 GST (Goods and Services Tax) — India's indirect tax:\n• 0% – essentials\n• 5% – basic goods\n• 12% – standard goods\n• 18% – most services\n• 28% – luxury items\nGST = CGST + SGST (intra-state) or IGST (inter-state).", source: "Built-in Knowledge"
  },
  {
    keys: ["sqft formula", "square feet formula", "area formula", "calculate sqft"],
    answer: "📐 Area = Width × Height (in feet)\nExample: 6ft × 4ft = 24 sqft\nTotal cost = Area × Rate per sqft.", source: "Built-in Knowledge"
  },
  {
    keys: ["rupee", "indian currency", "india currency", "inr"],
    answer: "💰 India's currency: **Indian Rupee (₹ / INR)**. 1 Rupee = 100 Paise.", source: "Built-in Knowledge"
  },
  {
    keys: ["national animal india", "india national animal"],
    answer: "🐯 National animal of India: **Bengal Tiger**.", source: "Built-in Knowledge"
  },
  {
    keys: ["pm usa", "pm america", "usa pm", "who is pm usa", "prime minister usa", "prime minister america"],
    answer: "🏛️ The USA does **not** have a Prime Minister. It has a **President**.\n\nCurrent: **Donald Trump** (47th President, from Jan 2025).\nPrevious: **Joe Biden** (46th President).", source: "Built-in Knowledge"
  },
  {
    keys: ["national bird india", "india national bird"],
    answer: "🦚 National bird of India: **Indian Peacock**.", source: "Built-in Knowledge"
  },
];

// ── Word-level spell corrector ─────────────────────────────────────────────
const SPELL_MAP = {
  // Question words
  wos: "who", wot: "what", wht: "what", waht: "what", hwo: "how", hw: "how", whe: "where", wen: "when", y: "why",
  // Common words
  iz: "is", ar: "are", teh: "the", fo: "of", ov: "of", fom: "from", forme: "from", frome: "from",
  // Countries
  indnan: "india", indain: "india", idia: "india", inda: "india", indie: "india",
  pakisan: "pakistan", pakstan: "pakistan", pakis: "pakistan", paksitan: "pakistan",
  amrica: "america", amercia: "america", amerca: "america",
  // People
  moodi: "modi", mody: "modi", narendtra: "narendra",
  // Common topics
  flg: "flag", falg: "flag", fleg: "flag",
  captial: "capital", captal: "capital", capitla: "capital",
  prezident: "president", presiden: "president", prsident: "president",
  minstr: "minister", mnister: "minister", ministor: "minister",
  colr: "color", colur: "color", coulor: "color", clour: "colour",
  // Misc
  aboout: "about", abut: "about", aboud: "about",
  medel: "model", medle: "model",
  ested: "is", aste: "is",
};

function correctWord(word) {
  const w = word.toLowerCase();
  if (SPELL_MAP[w]) return SPELL_MAP[w];
  // If word is 4+ chars, fuzzy-check against spell map keys
  if (w.length >= 4) {
    let best = w, bestScore = 0;
    for (const [wrong, right] of Object.entries(SPELL_MAP)) {
      const s = fuzzyScore(w, wrong);
      if (s > 0.8 && s > bestScore) { bestScore = s; best = right; }
    }
    if (bestScore > 0.8) return best;
  }
  return w;
}

// Build accurate search query from broken/misspelled input
function buildSearchQuery(raw) {
  // First: correct word-by-word
  const corrected = raw.trim().split(/\s+/).map(correctWord).join(" ");
  // Strip ONLY pure grammar words — keep all content/topic words
  const cleaned = corrected
    .replace(/\b(is|are|the|a|an|me|please|i|my|our|your)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  return cleaned.length > 2 ? cleaned : corrected;
}

// Tries to evaluate safe math expressions
function tryMath(text) {
  // Only trigger for actual math expressions, not natural language with years/numbers.
  // Skip if the original text contains question/topic words like who, win, won, when, which.
  const hasNaturalLanguage = /\b(who|win|won|when|where|which|what year|champion|cup|final|match|ipl|t20|world|cricket|football|team|player|country)\b/i.test(text);
  if (hasNaturalLanguage) return null;

  let expr = text
    .replace(/how much|what is|what's|calculate|=|\?/gi, " ")
    .replace(/\bplus\b/gi, "+").replace(/\bminus\b/gi, "-")
    .replace(/\btimes\b|\bmultiplied by\b/gi, "*")
    .replace(/\bdivided by\b|\bdivide\b/gi, "/")
    .replace(/[^0-9\+\-\*\/\.\(\)\s]/g, " ")
    .replace(/\s+/g, "").trim();
  if (!expr || !/\d/.test(expr)) return null;

  // MUST contain an operator for multi-number expressions
  // Prevents "2025" alone from being "calculated"
  if (!/[\+\-\*\/]/.test(expr) && expr.length > 6) return null;

  try {
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === "number" && isFinite(result)) {
      return { answer: `**${text.replace(/\?/g, "").trim()}** = **${result}**`, source: "Math Engine" };
    }
  } catch (_) { }
  return null;
}


// Check built-in knowledge base (fuzzy match)
function checkBuiltinKnowledge(query) {
  const q = query.toLowerCase().trim();
  let bestMatch = null, bestScore = 0;
  for (const entry of KNOWLEDGE_BASE) {
    for (const key of entry.keys) {
      const keyWords = key.split(" ");
      const queryWords = q.split(/\s+/);
      let matched = 0;
      keyWords.forEach(kw => {
        // Short keywords (<=3 chars like 'inr','gst') require EXACT match
        // This prevents 'in' from matching 'inr', 'is' matching 'gst' etc.
        let best;
        if (kw.length <= 3) {
          best = queryWords.includes(kw) ? 1 : 0;
        } else {
          best = Math.max(...queryWords.map(qw => fuzzyScore(qw, kw)));
        }
        if (best > 0.55) matched++;
      });
      let score = matched / Math.max(keyWords.length, 1);
      // BONUS: exact country/topic word match boosts score above similar entries
      // This prevents "pm pakistan" from matching "who is pm of usa"
      const topicWords = keyWords.filter(w => w.length > 3 && !['what','who','when','where','how','is','the','of','are'].includes(w));
      const topicMatched = topicWords.every(tw => queryWords.some(qw => fuzzyScore(qw, tw) > 0.7));
      if (topicWords.length > 0 && topicMatched) score = Math.min(score * 1.2, 1);
      if (score > bestScore) { bestScore = score; bestMatch = entry; }
    }
  }
  // Raised to 0.88 — prevents partial country matches (pakistan vs usa)
  return bestScore >= 0.88 ? bestMatch : null;
}

// DuckDuckGo Instant Answers API (free, no API key required)
async function duckDuckGoSearch(query) {
  try {
    const url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1';
    const res = await fetch(url);
    const data = await res.json();
    if (data.Answer && data.Answer.length > 3)
      return { answer: data.Answer, source: 'DuckDuckGo', url: data.AnswerURL || null };
    if (data.AbstractText && data.AbstractText.length > 30) {
      const sentences = data.AbstractText.split(/\.\s+/).slice(0,3).join('. ') + '.';
      return { answer: sentences, source: 'DuckDuckGo \u2014 ' + (data.AbstractSource || 'Web'), url: data.AbstractURL || null };
    }
    if (data.Definition && data.Definition.length > 10)
      return { answer: data.Definition, source: 'DuckDuckGo \u2014 ' + (data.DefinitionSource || 'Web'), url: data.DefinitionURL || null };
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const first = data.RelatedTopics[0];
      const text = first && first.Text ? first.Text : '';
      if (text.length > 20) return { answer: text, source: 'DuckDuckGo', url: (first && first.FirstURL) || null };
    }
  } catch (_) {}
  return null;
}

async function fetchWebAnswer(query) {
  // 1. Math evaluation (no API needed)
  const mathResult = tryMath(query);
  if (mathResult) return mathResult;

  // 2. Spell-correct the query, then check knowledge base
  const correctedQuery = query.trim().split(/\s+/).map(correctWord).join(" ");

  // PREFILTER: Skip built-in KB for complex natural language queries.
  // Built-in KB is for short exact lookups: 'pm india', 'gst', 'capital pakistan'
  // Complex queries (sports, events, news) must go straight to internet search.
  const wordCount = correctedQuery.trim().split(/\s+/).length;
  const hasContextWords = /\b(who|win|won|which|champion|cup|ipl|t20|cricket|football|league|tournament|score|season|award|news|latest|current|today|2024|2025|2026)\b/i.test(correctedQuery);
  const isComplexQuery = wordCount >= 4 || (wordCount >= 2 && hasContextWords);

  if (!isComplexQuery) {
    const builtin = checkBuiltinKnowledge(correctedQuery);
    if (builtin) return { answer: builtin.answer, source: builtin.source };
  }

  // PRE-SEARCH INTELLIGENCE: Time-awareness for future events
  const yearMatch = query.match(/\b(2025|2026|2027|2028|2029|2030)\b/);
  if (yearMatch) {
    const futureYear = parseInt(yearMatch[1], 10);
    const currentYear = new Date().getFullYear() || 2024;
    // If asking about "win" or "won" for a future year event
    if (futureYear > currentYear && /\b(win|won|winner)\b/i.test(query)) {
      return { answer: `Hmm... ${futureYear} hasn't happened yet, so there's no winner yet! 😉 Check back later.`, source: "Time-Aware AI" };
    }
  }

  // 3. DuckDuckGo Instant Answers API (primary internet search)
  const searchTerm = buildSearchQuery(query);
  const correctedFull = query.trim().split(/\s+/).map(correctWord).join(" ");
  try {
    const ddg = await duckDuckGoSearch(searchTerm) || await duckDuckGoSearch(correctedFull);
    if (ddg) return ddg;
  } catch (_) {}

  // 4. Wikipedia fulltext search (fallback)

  async function wikiSearch(term) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*&srlimit=3`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const hits = searchData.query?.search || [];
    if (!hits.length) return null;
    const title = hits[0].title;
    // Relevance check: at least one word from query should appear in the title
    const titleWords = title.toLowerCase().split(/\s+/);
    const queryWords = term.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const relevant = queryWords.some(qw => titleWords.some(tw => fuzzyScore(qw, tw) > 0.7));
    if (!relevant) return null; // skip irrelevant result
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&utf8=1&titles=${encodeURIComponent(title)}&origin=*`;
    const extractRes = await fetch(extractUrl);
    const data = await extractRes.json();
    const page = Object.values(data.query?.pages || {})[0];
    const extract = page?.extract || "";
    if (extract.length > 30) {
      const sentences = extract.split(/\.\s+/).slice(0, 3).join(". ") + ".";
      return { answer: sentences, source: `Wikipedia: ${title}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
    }
    return null;
  }

  try {
    // Try cleaned query first, then fall back to corrected full query
    const result = await wikiSearch(searchTerm) || await wikiSearch(correctedFull);
    if (result) return result;
  } catch (_) { }

  return null;
}




function handleCustomerQuery(msg, bills, customers) {
  // Extract customer name from query using lookupCustomer
  // Strip common query words first, then find a name
  const stripped = msg
    .replace(/how many|bills?|paid|unpaid|due|total|balance|invoice|owed|history|for|of|this|person|customer|client/gi, "")
    .trim();
  // Try to find a customer from the remaining text
  const words = stripped.match(/\b[A-Za-z][a-z]{2,}\b/g) || [];
  const nameGuess = words.slice(0, 3).join(" ");
  const found = lookupCustomer(nameGuess, null, customers);
  if (!found) {
    return `❓ I couldn't find that customer. Try: "bills for Bhagwati School"\n\nYour customers: ${(customers || []).slice(0, 5).map(c => c.name).join(", ")}`;
  }
  const cName = found.name.toLowerCase();
  const cBills = (bills || []).filter(b => (b.customer || b.customerName || "").toLowerCase().includes(cName) || cName.includes((b.customer || b.customerName || "").toLowerCase()));
  if (!cBills.length) return `📋 No bills found for **${found.name}** yet.`;
  const paidBills = cBills.filter(b => b.paid || b.status === "paid");
  const unpaidBills = cBills.filter(b => !b.paid && b.status !== "paid");
  const totalAmt = cBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const paidAmt = paidBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const unpaidAmt = unpaidBills.reduce((s, b) => s + Number(b.total || 0), 0);
  const last3 = cBills.slice(0, 3).map(b => `  • ₹${Number(b.total).toFixed(0)} — ${b.paid ? "✅ Paid" : "🔴 Unpaid"}`).join("\n");
  return `👤 **${found.name}**${found.phone ? " · " + found.phone : ""}\n━━━━━━━━━━━━━\n🧾 Total bills: ${cBills.length}\n✅ Paid: ${paidBills.length} bills · ₹${paidAmt.toFixed(2)}\n🔴 Unpaid: ${unpaidBills.length} bills · ₹${unpaidAmt.toFixed(2)}\n💰 Total amount: ₹${totalAmt.toFixed(2)}\n\nRecent:\n${last3}`;
}

function handleQuery(intent, bills, customers, products) {
  if (intent === "QUERY_SALES") {
    const today = new Date().toDateString();
    const tb = (bills || []).filter(b => new Date(b.createdAt || b.created_at || "").toDateString() === today);
    const total = tb.reduce((s, b) => s + (Number(b.total) || 0), 0);
    const paid = tb.filter(b => b.paid).reduce((s, b) => s + (Number(b.total) || 0), 0);
    return `📊 Today's Sales\n━━━━━━━━━━━━━\n🧾 ${tb.length} bills\n💰 Total: ₹${total.toFixed(2)}\n✅ Received: ₹${paid.toFixed(2)}\n🔴 Pending: ₹${(total - paid).toFixed(2)}`;
  }
  if (intent === "QUERY_WEEKLY") {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const wb = (bills || []).filter(b => new Date(b.createdAt || b.created_at || "") >= weekAgo);
    const total = wb.reduce((s, b) => s + (Number(b.total) || 0), 0);
    return `📅 This Week\n━━━━━━━━━━━━━\n🧾 ${wb.length} bills · ₹${total.toFixed(2)} total`;
  }
  if (intent === "QUERY_MONTHLY") {
    const now = new Date();
    const mb = (bills || []).filter(b => { const d = new Date(b.createdAt || b.created_at || ""); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const total = mb.reduce((s, b) => s + (Number(b.total) || 0), 0);
    return `📆 This Month\n━━━━━━━━━━━━━\n🧾 ${mb.length} bills · ₹${total.toFixed(2)} total`;
  }
  if (intent === "QUERY_TOP") {
    const tally = {};
    (bills || []).forEach(b => { const n = b.customer || "Unknown"; tally[n] = (tally[n] || 0) + Number(b.total || 0); });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!sorted.length) return "No bills found yet.";
    return `🏆 Top Customers\n━━━━━━━━━━━━━\n${sorted.map(([n, t], i) => `${["🥇", "🥈", "🥉"][i]} ${n} — ₹${t.toFixed(2)}`).join("\n")}`;
  }
  if (intent === "QUERY_UNPAID") {
    const up = (bills || []).filter(b => !b.paid);
    const total = up.reduce((s, b) => s + (Number(b.total) || 0), 0);
    const top3 = up.slice(0, 3).map(b => `• ${b.customer}: ₹${b.total}`).join("\n");
    return `🔴 Unpaid Invoices\n━━━━━━━━━━━━━\n${up.length} bills · ₹${total.toFixed(2)} owed${top3 ? "\n" + top3 : ""}`;
  }
  if (intent === "QUERY_PRODUCTS") {
    const ap = (products || []).filter(p => p.active !== false);
    if (!ap.length) return "No products found. Add them in the Products page.";
    return `🖨️ Products (${ap.length})\n━━━━━━━━━━━━━\n${ap.slice(0, 12).map(p => `• ${p.name} — ₹${p.default_rate || p.defaultRate || 0}/${p.unit || "sqft"}`).join("\n")}`;
  }
  if (intent === "QUERY_CUSTOMERS") {
    const top5 = (customers || []).slice(0, 5).map(c => `• ${c.name}${c.phone ? " " + c.phone : ""}`).join("\n");
    return `👥 ${(customers || []).length} customers\n━━━━━━━━━━━━━\n${top5}`;
  }
  if (intent === "QUERY_LAST") {
    const last = (bills || [])[0];
    if (!last) return "No bills found yet.";
    return `🧾 Last Bill\n━━━━━━━━━━━━━\n👤 ${last.customer}\n💰 ₹${last.total}\n${last.paid ? "✅ Paid" : "🔴 Unpaid"}`;
  }
  if (intent === "QUERY_HELP") {
    return `🤖 AI Agent Commands\n━━━━━━━━━━━━━\n📦 Single: "6x3 normal Rahul 98765"\n📦 Multi: "6x3 normal, 4x2 star for Ahmed"\n📊 Sales: "sales today", "this week", "this month"\n🔴 Due: "unpaid invoices"\n🏆 Best: "top customer"\n🧾 Last: "last bill"\n📋 List: "list products", "customers"\n✏️ Edit: "update rate to 50"`;
  }
  return null;
}

export function processMessage(text, memory, products, bills, customers, sellerName) {
  const intent = detectIntent(text, memory);
  const mem = { ...memory, rateHistory: { ...memory.rateHistory } };

  // GREETING — smart business-aware reply
  if (intent === "GREETING") {
    return { type: "QUERY", text: handleGreeting(sellerName, bills, customers, products), mem };
  }

  // ANSWER to pending question
  if (intent === "ANSWER" && mem.pendingTask && mem.pendingField) {
    const field = mem.pendingField;
    const task = mem.pendingTask;
    mem.pendingField = null; mem.pendingTask = null;
    if (field === "customer") {
      const matchedUser = lookupCustomer(text, null, customers);
      mem.customerName = matchedUser ? matchedUser.name : text;
      mem.phone = matchedUser && matchedUser.phone ? matchedUser.phone : mem.phone;
      // Check if we now have enough to complete the task
      if (task === "BILL" && mem.lastWidth && mem.lastProductName) {
        return buildBill(mem, products, bills, customers);
      }
    }
    if (field === "product") {
      const prod = products.find(p => p.name.toLowerCase().includes(text.toLowerCase()));
      if (prod) { mem.lastProductId = prod.id; mem.lastProductName = prod.name; mem.lastRate = prod.default_rate || 0; }
      if (task === "BILL" && mem.lastWidth) return buildBill(mem, products, bills, customers);
    }
    if (field === "dimensions") {
      const dim = extractDim(text);
      if (dim) { mem.lastWidth = dim.w; mem.lastHeight = dim.h; if (task === "BILL" && mem.lastProductName) return buildBill(mem, products, bills, customers); }
    }
    if (field === "rate") {
      mem.lastRate = parseFloat(text) || null;
      if (task === "BILL" && mem.lastWidth && mem.lastProductName) return buildBill(mem, products, bills, customers);
    }
    const templates = [
      `Got it! I've saved ${text} for the ${field}.`,
      `Noted: ${field} is ${text}.`,
      `Alright, ${text} it is.`,
      `Perfect, I will remember ${text} for the ${field}.`
    ];
    return { type: "DATA_FILL", text: templates[Math.floor(Math.random() * templates.length)], mem };
  }

  // Per-customer query (before generic queries)
  if (intent === "QUERY_CUSTOMER") {
    const ans = handleCustomerQuery(text, bills, customers);
    return { type: "QUERY", text: ans, mem };
  }

  // General queries
  if (intent.startsWith("QUERY_")) {
    const ans = handleQuery(intent, bills, customers, products);
    return { type: "QUERY", text: ans || "Didn't understand. Try 'help'.", mem };
  }

  // Update
  if (intent === "UPDATE") {
    const rateM = text.match(/(?:rate|price)\s+(?:to|is|=)\s*(\d+(?:\.\d+)?)/i);
    if (rateM) { mem.lastRate = parseFloat(rateM[1]); return { type: "UPDATE", text: `✏️ Rate updated → ₹${mem.lastRate}/sqft`, mem }; }
    const nameM = text.match(/(?:name|customer)\s+(?:to|is|=)\s+(.+)/i);
    if (nameM) { mem.customerName = nameM[1].trim(); return { type: "UPDATE", text: `✏️ Customer updated → ${mem.customerName}`, mem }; }
    return { type: "ERROR", text: "❌ Couldn't parse update. Try: 'update rate to 45'", mem };
  }

  // Bill / Order
  if (intent === "BILL") {
    // Multi-item?
    const { items: multiItems, isMulti } = extractMultiItems(text, products);
    if (isMulti) {
      const phone = extractPhone(text);
      const cn = extractCustomer(text, null, sellerName);
      const dbC = lookupCustomer(cn, phone, customers);
      if (dbC) {
        // Always override — don't keep old session's customer/phone
        mem.customerName = dbC.name;
        if (dbC.phone) mem.phone = dbC.phone;
      } else {
        if (phone) mem.phone = phone;
        if (cn) mem.customerName = cn;
      }

      const billItems = multiItems.map(it => {
        const prod = findProduct(it.productText, products);
        const rate = it.rate || recallRate(prod?.id || null, prod?.name || "", mem, bills) || prod?.default_rate || prod?.defaultRate || 0;

        // If they provided "Qty: 24", DO NOT multiply by WxH! Use Qty directly as square feet/amount.
        let sqft = 0;
        if (it.hasExplicitQty || (!it.width && !it.height)) {
          sqft = parseFloat(it.quantity.toFixed(2));
        } else {
          sqft = parseFloat((it.width * it.height * it.quantity).toFixed(2));
        }

        return { 
          name: it.description || prod?.name || it.productText, 
          description: "", 
          qty: sqft, 
          rate, 
          amount: parseFloat((sqft * rate).toFixed(2)) 
        };
      });
      const total = parseFloat(billItems.reduce((s, it) => s + it.amount, 0).toFixed(2));
      const area = parseFloat(billItems.reduce((s, it) => s + it.qty, 0).toFixed(2));
      const customerNote = dbC
        ? `🟢 Customer: "${cn || phone}" → matched **${mem.customerName}** in DB`
        : (cn ? `🟡 Customer: "${cn}" → new (not in DB)` : `⚪ No customer detected`);
      const reasoning = [customerNote,
        multiItems.map(it => `${it.productText} ${it.width}×${it.height}`).join(" + "),
      ].filter(Boolean).join(" · ");
      mem.orderCount = (mem.orderCount || 0) + 1;
      return { type: "BILL", isMulti: true, customer: mem.customerName, phone: mem.phone, items: billItems, total, area, text: "", reasoning, mem };
    }

    // Single item
    const dim = extractDim(text);
    const phone = extractPhone(text);
    const cn = extractCustomer(text, null, sellerName);
    const qty = extractQty(text);
    const explRate = extractRate(text);
    const matched = findProduct(text, products);
    const dbC = lookupCustomer(cn, phone, customers);
    if (dbC) {
      // Always override — don't keep old session's customer/phone when new customer typed
      mem.customerName = dbC.name;
      if (dbC.phone) mem.phone = dbC.phone;
    } else {
      if (phone) mem.phone = phone;
      if (cn) mem.customerName = cn;
    }

    if (dim) { mem.lastWidth = dim.w; mem.lastHeight = dim.h; }
    if (qty > 1) mem.lastQty = qty;
    if (matched) {
      mem.lastProductId = matched.id || null; mem.lastProductName = matched.name;
      const recalled = recallRate(matched.id || null, matched.name, mem, bills);
      mem.lastRate = explRate ?? recalled ?? (matched.default_rate || matched.defaultRate || 0);
    } else if (explRate) mem.lastRate = explRate;

    if (!mem.lastProductName) {
      mem.pendingTask = "BILL"; mem.pendingField = "product";
      const list = products.slice(0, 5).map(p => p.name).join(", ");
      const reasoning = `🔍 I see dimensions ${dim ? `${dim.w}x${dim.h}` : ""} and customer "${mem.customerName || "?"}" — but couldn't identify a product. Checking: ${list}`;
      return { type: "ASK", field: "product", text: `❓ Which product? Your products: ${list || "Normal Flex, Star Flex, Vinyl"}`, reasoning, mem };
    }
    if (!mem.lastWidth || !mem.lastHeight) {
      mem.pendingTask = "BILL"; mem.pendingField = "dimensions";
      const reasoning = `🔍 Product: **${mem.lastProductName}**, Customer: **${mem.customerName || "?"}** — missing size.`;
      return { type: "ASK", field: "dimensions", text: "❓ What size? (e.g. 6x3, 4x2 ft)", reasoning, mem };
    }
    if (!mem.customerName) {
      mem.pendingTask = "BILL"; mem.pendingField = "customer";
      const reasoning = `🔍 Product: **${mem.lastProductName}** ${mem.lastWidth}×${mem.lastHeight} — missing customer name.`;
      return { type: "ASK", field: "customer", text: "❓ Customer name?", reasoning, mem };
    }
    if (!mem.lastRate || mem.lastRate === 0) {
      mem.pendingTask = "BILL"; mem.pendingField = "rate";
      const reasoning = `🔍 Ready to bill **${mem.customerName}** for **${mem.lastProductName}** ${mem.lastWidth}×${mem.lastHeight} — but no rate found in memory or DB history.`;
      return { type: "ASK", field: "rate", text: `❓ Rate per sqft for ${mem.lastProductName}? (₹)`, reasoning, mem };
    }
    // Build reasoning for complete bill
    const customerNote = dbC
      ? `🟢 "${cn || phone || "?"}" → **${mem.customerName}** (DB match)`
      : `🟡 "${cn || "?"}" → new customer`;
    const productNote = matched
      ? `🖨️ "${text.slice(0, 20).trim()}..." → **${matched.name}**`
      : `🖨️ ${mem.lastProductName} (from memory)`;
    const rateNote = explRate
      ? `💰 Rate ₹${explRate} (from input)`
      : mem.lastRate
        ? `💰 Rate ₹${mem.lastRate} (recalled from history)`
        : `💰 Rate: default`;
    const dimNote = dim ? `📐 ${dim.w}×${dim.h}ft` : `📐 ${mem.lastWidth}×${mem.lastHeight}ft (memory)`;
    const billReasoning = [customerNote, productNote, dimNote, rateNote].join(" · ");
    return buildBill(mem, products, bills, customers, billReasoning);
  }

  const allWords = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const possibleCustomer = lookupCustomer(allWords.slice(0, 3).join(" "), null, customers);
  const possibleProduct = products.find(p => allWords.some(w => fuzzyScore(w, p.name.toLowerCase().split(" ")[0]) > 0.5));
  const suggestions = ["6x3 normal flex for Rahul 98765", "4x2 vinyl and 6x3 star for Ahmed", "sales today?", "unpaid invoices?", "this week revenue?", "top customer?", "help"];

  // Smart contextual guessing - varies response so it doesn't feel robotic
  const openers = [
    "Hmm, I'm not quite sure what you mean.",
    "I didn't catch that — let me try to help.",
    "Let me see if I can figure out what you need.",
    "That one's a bit ambiguous for me."
  ];
  let guessText = openers[Math.floor(Math.random() * openers.length)] + " ";

  if (possibleCustomer) {
    const ctxOpeners = [
      `Are you checking on **${possibleCustomer.name}**'s account, or creating a new bill for them?`,
      `I found **${possibleCustomer.name}** in your database — did you want their billing history or a new invoice?`,
      `Looks like you might mean **${possibleCustomer.name}**. Want me to look up their bills or start a new one?`
    ];
    guessText += "\n\n" + ctxOpeners[Math.floor(Math.random() * ctxOpeners.length)] + "\n\n";
  } else if (possibleProduct) {
    const pOpeners = [
      `I think you mean **${possibleProduct.name}**. Add a size (like 6x4) and a customer name and I'll create your bill.`,
      `Detected **${possibleProduct.name}** — what are the dimensions and customer?`,
      `Got **${possibleProduct.name}**! Just tell me the size (e.g. 6x3) and the customer.`
    ];
    guessText += "\n\n" + pOpeners[Math.floor(Math.random() * pOpeners.length)] + "\n\n";
  } else {
    guessText += "\n\nI couldn't find a matching customer, product, or size in your message.\n\nTry one of these:\n";
  }

  return {
    type: "SUGGEST",
    reasoning: `🔎 Intent unclear — checked ${customers.length} customers, ${products.length} products. No dimension or known keyword matched.`,
    suggestions,
    text: guessText,
    mem,
  };
}

function buildBill(mem, products, bills, customers, reasoning) {
  const w = mem.lastWidth, h = mem.lastHeight, qty = mem.lastQty || 1;
  const area = parseFloat((w * h * qty).toFixed(2));
  const rate = mem.lastRate || 0;
  const total = parseFloat((area * rate).toFixed(2));
  mem.lastTotal = total;
  mem.orderCount = (mem.orderCount || 0) + 1;
  if (mem.lastProductId) mem.rateHistory[mem.lastProductId] = rate;
  const item = { name: mem.lastProductName || "", description: `${w}x${h}`, qty: area, rate, amount: total };
  return { type: "BILL", isMulti: false, customer: mem.customerName, phone: mem.phone, items: [item], total, area, product: mem.lastProductName, text: "", reasoning: reasoning || null, mem };
}

// ── Styles ──────────────────────────────────────────────────────────────────
const TASK_BADGE = {
  BILL: { label: "BILL_CREATE", bg: "#DCFCE7", color: "#16A34A" },
  QUERY: { label: "QUERY", bg: "#EDE9FE", color: "#7C3AED" },
  ASK: { label: "ASK", bg: "#FEF3C7", color: "#D97706" },
  UPDATE: { label: "UPDATE", bg: "#CFFAFE", color: "#0891B2" },
  DATA_FILL: { label: "DATA_FILL", bg: "#D1FAE5", color: "#059669" },
  ERROR: { label: "ERROR", bg: "#FEE2E2", color: "#DC2626" },
  SUGGEST: { label: "SUGGEST", bg: "#F3E8FF", color: "#9333EA" },
};

const CSS = `
  .ai-page { display: flex; flex-direction: column; height: calc(100vh - 110px); max-width: 860px; margin: 0 auto; }
  .ai-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .ai-header-title { font-size: 1.1rem; font-weight: 800; color: var(--text1); }
  .ai-header-sub { font-size: .75rem; color: #FF6600; font-weight: 600; }
  .ai-memory-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 8px 14px; background: rgba(255,102,0,.08); border: 1px solid rgba(255,102,0,.2); border-radius: 10px; margin-bottom: 8px; font-size: .75rem; }
  .ai-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 4px 0 16px; scroll-behavior: smooth; }
  .ai-msg { display: flex; }
  .ai-msg.user { justify-content: flex-end; }
  .ai-msg.agent { justify-content: flex-start; }
  .ai-bubble { max-width: 82%; padding: 13px 16px; border-radius: 18px; font-size: .88rem; line-height: 1.6; white-space: pre-wrap; box-shadow: 0 2px 6px rgba(0,0,0,.06); }
  .ai-bubble.user { background: #FF6600; color: #fff; border-bottom-right-radius: 4px; }
  .ai-bubble.agent { background: var(--surface); border: 1px solid var(--border); border-bottom-left-radius: 4px; color: var(--text1); }
  .ai-agent-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .ai-badge { display: inline-block; font-size: .65rem; font-weight: 800; letter-spacing: .5px; padding: 2px 8px; border-radius: 6px; margin-bottom: 8px; }
  .ai-action-row { display: flex; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
  .ai-btn-draft { flex: 1; background: #FF6600; color: #fff; border: none; border-radius: 8px; padding: 9px 0; font-weight: 800; font-size: .82rem; cursor: pointer; transition: opacity .15s; }
  .ai-btn-draft:hover { opacity: .88; }
  .ai-btn-edit  { flex: 1; background: var(--surface2); color: var(--text1); border: 1px solid var(--border); border-radius: 8px; padding: 9px 0; font-weight: 700; font-size: .82rem; cursor: pointer; }
  .ai-btn-done  { background: #DCFCE7; color: #16A34A; border: none; border-radius: 8px; padding: 8px 16px; font-weight: 700; font-size: .82rem; width: 100%; }
  .ai-suggest-chip { display: block; background: rgba(255,102,0,.07); border: 1px solid rgba(255,102,0,.25); border-radius: 8px; padding: 7px 12px; font-size: .82rem; color: #FF6600; cursor: pointer; margin-top: 6px; text-align: left; width: 100%; }
  .ai-suggest-chip:hover { background: rgba(255,102,0,.15); }
  .ai-ask-hint { background: rgba(255,193,7,.08); border-radius: 8px; padding: 6px 10px; font-size: .75rem; color: #D97706; margin-top: 8px; }
  .ai-time { font-size: .62rem; color: var(--text3); margin-top: 5px; text-align: right; }
  .ai-input-bar { display: flex; gap: 8px; align-items: flex-end; margin-top: 8px; }
  .ai-input-field { flex: 1; border: 1.5px solid var(--border); border-radius: 14px; padding: 10px 16px; font-size: .9rem; resize: none; background: var(--surface); color: var(--text1); font-family: inherit; max-height: 120px; outline: none; transition: border-color .15s; }
  .ai-input-field:focus { border-color: #FF6600; }
  .ai-send-btn { width: 44px; height: 44px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: opacity .15s; }
  .ai-send-btn.active { background: #FF6600; }
  .ai-send-btn.inactive { background: var(--surface2); color: var(--text3); cursor: not-allowed; }
  .ai-mic-btn { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface); color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: all .2s; flex-shrink: 0; }
  .ai-mic-btn:hover { background: var(--surface2); }
  .ai-mic-btn.listening { background: #DC2626; color: #fff; border-color: #DC2626; animation: ai-pulse 1.5s infinite; }
  @keyframes ai-pulse { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 70% { box-shadow: 0 0 0 10px rgba(220,38,38,0); } 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); } }
  .ai-quick-pills { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 6px; scrollbar-width: none; }
  .ai-quick-pills::-webkit-scrollbar { display: none; }
  .ai-pill { flex-shrink: 0; background: rgba(255,102,0,.1); border: 1px solid rgba(255,102,0,.3); border-radius: 20px; padding: 5px 14px; font-size: .75rem; color: #FF6600; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .ai-pill:hover { background: rgba(255,102,0,.2); }
  .ai-multi-item { background: var(--surface2); border-radius: 8px; padding: 8px 12px; margin: 6px 0; font-size: .8rem; }
  .ai-thinking-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; border-bottom-left-radius: 4px; padding: 12px 16px; max-width: 82%; box-shadow: 0 2px 6px rgba(0,0,0,.06); }
  .ai-thinking-label { font-size: .68rem; font-weight: 800; color: #FF6600; letter-spacing: .5px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
  .ai-thinking-step { display: flex; align-items: center; gap: 8px; font-size: .78rem; color: var(--text2); padding: 3px 0; animation: ai-stepfade .3s ease-in; }
  .ai-thinking-step.done { color: #16A34A; }
  .ai-thinking-step.active { color: var(--text1); font-weight: 600; }
  .ai-spinner { width: 13px; height: 13px; border: 2px solid rgba(255,102,0,.25); border-top-color: #FF6600; border-radius: 50%; animation: ai-spin .7s linear infinite; flex-shrink: 0; }
  .ai-step-tick { width: 13px; height: 13px; color: #16A34A; flex-shrink: 0; font-size: 12px; }
  .ai-step-wait { width: 13px; height: 13px; border: 2px solid var(--border); border-radius: 50%; flex-shrink: 0; }
  @keyframes ai-spin { to { transform: rotate(360deg); } }
  @keyframes ai-stepfade { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }

  /* Gmail Panel Styles */
  .ai-gmail-panel { background: rgba(220,38,38,0.05); border: 1px solid rgba(220,38,38,0.2); border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; }
  .ai-gmail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .ai-gmail-title { font-weight: 700; color: #DC2626; display: flex; align-items: center; gap: 6px; }
  .ai-gmail-btn { background: white; border: 1px solid #DC2626; color: #DC2626; padding: 4px 12px; border-radius: 6px; font-size: .75rem; font-weight: 700; cursor: pointer; }
  .ai-gmail-btn:hover { background: rgba(220,38,38,0.05); }
  .ai-gmail-btn.active { background: #DC2626; color: white; }
  .ai-gmail-input { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: .8rem; margin-bottom: 8px; }
  .ai-gmail-order { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 8px; font-size: .8rem; display: flex; flex-direction: column; gap: 8px; }
  .ai-gmail-order-header { font-weight: 600; color: var(--text1); font-size: .85rem; }
  .ai-gmail-order-snippet { color: var(--text2); font-size: .75rem; line-height: 1.4; }
`;

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
let _uid = 0;
function uid() { return `m${++_uid}${Date.now()}`; }

export default function AiAgentPage({ products = [], bills = [], customers = [], showToast, setBills, sellerName, setPage, setInitialDraft, user }) {
  const [memory, setMemory] = useState(() => {
    try {
      const saved = localStorage.getItem("printmaster_ai_memory");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return createMemory();
  });

  useEffect(() => {
    localStorage.setItem("printmaster_ai_memory", JSON.stringify(memory));
  }, [memory]);
  const [messages, setMessages] = useState(() => {
    // L10: Load saved conversation from previous session
    const saved = loadConversation();
    if (saved && saved.length > 0) return saved;
    return [{
      id: "welcome", role: "agent", time: nowTime(),
      text: `🤖 PrintMaster AI Agent ready!\n\nJust type naturally:\n\n📦 "6x3 normal flex for Rahul 9876543210"\n📦 "6x3 normal, 4x2 star for Ahmed" (multi-item!)\n📊 "sales today?" · "this week?"\n🔴 "unpaid invoices?"\n🏆 "top customer?"\n\nI remember context across your chat — no repeating info!`,
    }];
  });
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkSteps, setThinkSteps] = useState([]);
  const [activeStep, setActiveStep] = useState(-1);
  const [draftedIds, setDraftedIds] = useState(new Set());

  // Gmail Integration State
  const [gmailClientId, setGmailClientId] = useState(() => localStorage.getItem("printmaster_gmail_client_id") || "");
  const [showGmailPanel, setShowGmailPanel] = useState(false);
  const [gmailToken, setGmailToken] = useState(null);
  const [gmailSender, setGmailSender] = useState("");
  const [gmailOrders, setGmailOrders] = useState([]);
  const [gmailLoading, setGmailLoading] = useState(false);

  // Voice input state
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking, activeStep]);

  useEffect(() => {
    // Load Google Identity Services script for Gmail API
    if (!document.getElementById("gsi-script")) {
      const script = document.createElement("script");
      script.id = "gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Target Indian English for typical SaaS usage

      recognition.onstart = () => setListening(true);

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInput(currentTranscript);
      };

      recognition.onerror = (e) => {
        console.error("Speech error", e.error);
        setListening(false);
      };

      recognition.onend = () => setListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      showToast?.("⚠️ Voice input is not supported in this browser.", "error");
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setInput(""); // Clear input when starting voice
      recognitionRef.current.start();
    }
  };

  const handleGmailConnect = () => {
    if (!gmailClientId) {
      showToast?.("⚠️ Please enter a Google Client ID to connect Gmail.", "error");
      return;
    }
    localStorage.setItem("printmaster_gmail_client_id", gmailClientId);

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: gmailClientId,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        callback: (tokenResponse) => {
          if (tokenResponse.access_token) {
            setGmailToken(tokenResponse.access_token);
            showToast?.("✅ Gmail Connected successfully!", "success");
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      showToast?.("❌ Failed to initiate Google Login. Check Client ID.", "error");
      console.error(e);
    }
  };

  const fetchGmailOrders = async () => {
    if (!gmailToken || !gmailSender) return;
    setGmailLoading(true);
    setGmailOrders([]);
    try {
      const q = `from:${gmailSender.trim()} in:inbox`;
      const searchRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=5`, {
        headers: { Authorization: `Bearer ${gmailToken}` }
      });
      const searchData = await searchRes.json();

      if (!searchData.messages) {
        showToast?.("ℹ️ No recent emails found from this sender.", "info");
        setGmailLoading(false);
        return;
      }

      const fetchedOrders = [];
      for (const msg of searchData.messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
          headers: { Authorization: `Bearer ${gmailToken}` }
        });
        const msgData = await msgRes.json();

        let bodyText = "";
        const getBody = (parts) => {
          if (!parts) return;
          for (const p of parts) {
            if (p.mimeType === "text/plain" && p.body?.data) {
              bodyText += atob(p.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (p.parts) {
              getBody(p.parts);
            }
          }
        };

        if (msgData.payload.parts) {
          getBody(msgData.payload.parts);
        } else if (msgData.payload.body?.data) {
          bodyText = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        const rawText = bodyText.substring(0, 500); // 1st 500 chars 
        if (rawText.length > 5 && rawText.toLowerCase().match(/\b(flex|star|vinyl|banner|board|\dx\d)\b/)) {
          // Process silently
          const res = processMessage(rawText, createMemory(), products, bills, customers, sellerName);
          if (res.type === "BILL") {
            fetchedOrders.push({ id: msg.id, snippet: msgData.snippet, result: res });
          }
        }
      }

      setGmailOrders(fetchedOrders);
      if (fetchedOrders.length === 0) showToast?.("ℹ️ No parseable print orders found in recent emails.", "info");

    } catch (e) {
      console.error(e);
      showToast?.("❌ Error reading Gmail.", "error");
    }
    setGmailLoading(false);
  };

  const addMsg = (msg) => setMessages(prev => [...prev, { id: uid(), ...msg }]);

  // Generate context-aware thinking steps from the input
  function buildSteps(text, intent) {
    const t = text.toLowerCase();
    if (intent === "QUERY_GENERAL") {
      return [
        "Thinking about your question...",
        "Searching the web...",
        "Reading search results...",
        "Putting together an answer...",
      ];
    }
    const steps = ["Reading your message..."];
    if (t.match(/[0-9].*x.*[0-9]|by|size|sixe/)) steps.push("Detecting dimensions & quantity...");
    if (t.match(/normal|star|vinyl|banner|backlit|flex|flxe|fixe|norel|nomre|norml|noem|vinly/)) steps.push("Matching product from catalog...");
    if (customers.length) steps.push("Looking up customer...");
    if (t.match(/rate[d]?|reted|reated|\bis\s+\d|@|₹|rs/i) || t.match(/\d+\s+rate[d]?/i)) steps.push("Extracting rate from your text...");
    if (t.match(/bill|paid|unpaid|history|total|balance|how many|owe/)) steps.push("Searching billing records...");
    if (t.match(/sales|week|month|today|revenue|earning/)) steps.push("Calculating your sales data...");
    steps.push("Almost done...");
    return steps;
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    addMsg({ role: "user", text, time: nowTime() });


    // L10: persist conversation on every message send (auto-saves chat history)
    setMessages(prev => { saveConversation(prev); return prev; });

    // L7+L9: "help" command -> show recurring radar + weekly digest
    if (/^help$|who to bill|remind me/i.test(text.trim())) {
      const radar = getRecurringRadar(bills, 7);
      const digest = getWeeklyDigest(bills);
      let helpText = "";
      if (radar.length > 0) helpText += `**Customers not billed in 7+ days:**\n${radar.map(r => `• ${r.customerName} (${r.daysSince}d ago)`).join("\n")}\n\n`;
      if (digest) {
        helpText += `**This week:** ${digest.billCount} bills / Rs.${digest.total.toLocaleString()}`;
        if (digest.topCustomer) helpText += ` | Top: **${digest.topCustomer.name}**`;
        if (digest.unpaidCount > 0) helpText += `\n${digest.unpaidCount} unpaid bills need attention.`;
      }
      setThinking(false); setThinkSteps([]); setActiveStep(-1);
      addMsg({ role: "agent", time: nowTime(), text: helpText || "All clear! No pending reminders.", result: { type: "QUERY", reasoning: "Recurring radar + weekly digest (L7+L9)" } });
      return;
    }
    // LEARN CHECK: Before processing, see if we recognize this customer from past bills
    // Only trigger if input looks like just a name (< 4 words, no dimensions, no sale keywords)
    const isShortInput = text.split(" ").length <= 4;
    const hasDimensions = /\d+\s*x\s*\d+/i.test(text);
    const hasBillingKeywords = /bill|sales|paid|unpaid|report|this week|today|month|help/i.test(text);
    if (isShortInput && !hasDimensions && !hasBillingKeywords) {
      const suggestions = getAllSuggestionsForCustomer(text);
      if (suggestions.length > 0) {
        // Build a natural "last time" summary
        const topCustomer = suggestions[0].customerName;
        const itemLines = suggestions
          .map(s => `• ${s.productName}${s.description ? ` (${s.description})` : ""} — ₹${s.rate}/sqft (ordered ${s.count}x)`)
          .join("\n");
        const suggestionOpeners = [
          `I remember ${topCustomer}!`,
          `Found ${topCustomer} in my memory.`,
          `${topCustomer} — yes, I have their history.`,
        ];
        const opener = suggestionOpeners[Math.floor(Math.random() * suggestionOpeners.length)];
        setThinking(false); setThinkSteps([]); setActiveStep(-1);
        addMsg({
          role: "agent",
          time: nowTime(),
          text: `${opener} Here's what they've ordered before:\n\n${itemLines}\n\nShould I create the same bill, or do you have new items to add?`,
          result: { type: "QUERY", reasoning: `Memory recall for "${text}" — found ${suggestions.length} past order(s)` },
        });
        return;
      }
    }

    // Detect intent early so we can customize thinking steps
    const intent = detectIntent(text, memory);
    const steps = buildSteps(text, intent);
    setThinkSteps(steps);
    setActiveStep(0);
    setThinking(true);

    try {
      // ── General knowledge / internet search ──────────────────────────────
      if (intent === "QUERY_GENERAL") {
        // Animate through initial steps
        for (let i = 0; i < steps.length - 1; i++) {
          await new Promise(r => setTimeout(r, 350 + i * 200));
          setActiveStep(i + 1);
        }
        const webResult = await fetchWebAnswer(text);
        setThinking(false); setThinkSteps([]); setActiveStep(-1);
        if (webResult) {
          const sourceNote = webResult.url
            ? `\n\n*(Source: ${webResult.source} — ${webResult.url})*`
            : `\n\n*(Source: ${webResult.source})*`;
          addMsg({
            role: "agent",
            time: nowTime(),
            text: `Here is what I found:\n\n${webResult.answer}${sourceNote}`,
            result: { type: "QUERY", reasoning: `Searched my knowledge base for "${text}"` },
          });
        } else {
          addMsg({
            role: "agent",
            time: nowTime(),
            text: `🤔 I searched the web but couldn't find a clear answer for:\n"${text}"\n\nTry rephrasing your question, or ask something about your billing data.`,
            result: { type: "QUERY", reasoning: `🔎 Searched DuckDuckGo + Wikipedia — no result found for this query.` },
          });
        }
        return;
      }

      // ── Billing / reporting logic ─────────────────────────────────────────
      for (let i = 0; i < steps.length - 1; i++) {
        await new Promise(r => setTimeout(r, 280 + i * 180));
        setActiveStep(i + 1);
      }
      await new Promise(r => setTimeout(r, 100));
      const result = processMessage(text, memory, products, bills, customers, sellerName);
      const updatedMem = result.mem || memory;
      setMemory(updatedMem);
      setThinking(false); setThinkSteps([]); setActiveStep(-1);
      addMsg({ role: "agent", result, time: nowTime(), text: result.text });

    } catch (e) {
      setThinking(false); setThinkSteps([]); setActiveStep(-1);
      addMsg({ role: "agent", time: nowTime(), text: "❌ Error processing. Try again." });
    }
  };


  const handleDraft = async (msgId, result) => {
    try {
      const { db } = await import("./supabase.js");
      const invoiceId = `AI-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await db.addBill({
        id: invoiceId,
        customer: result.customer || "Customer",
        phone: result.phone || null,
        subtotal: result.total,
        gst_amt: 0,
        total: result.total,
        gst: false,
        paid: false,
        notes: `AI Draft — ${result.isMulti ? "Multi-item" : (result.items[0]?.description || "")} ${result.items[0]?.name || ""}`,
        items: result.items,
        status: "draft",
        organisationId: user?.organisationId,
      });
      setDraftedIds(prev => new Set([...prev, msgId]));
      if (setBills) setBills(prev => [{ id: invoiceId, customer: result.customer, total: result.total, paid: false, createdAt: new Date().toISOString() }, ...prev]);
      // 🧠 LEARN: Save this bill's patterns to learn memory
      learnFromBill({
        customerName: result.customer,
        customerId: user?.organisationId ? `${user.organisationId}::${result.customer}` : result.customer,
        items: result.items,
      });
      showToast?.("✅ Draft invoice created! Go to Billing to view.");
    } catch (e) {
      showToast?.("❌ Failed to create draft: " + e.message, "error");
    }
  };

  const renderResult = (result, msgId) => {
    if (!result) return null;
    const badge = TASK_BADGE[result.type];
    return (
      <div>
        {badge && <span className="ai-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>}
        {result.type === "BILL" && (
          <div>
            {result.customer && <div style={{ fontSize: ".82rem", marginBottom: 8 }}>👤 <b>{result.customer}</b>{result.phone ? ` · 📞 ${result.phone}` : ""}</div>}
            <div className="table-wrap" style={{ margin: "8px 0", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
              <table className="bill-items-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>S.No.</th>
                    <th>Product / Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.isMulti ? result.items : (result.items[0] ? [result.items[0]] : [])).map((it, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "center", width: 40 }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{it.name || "-"}</div>
                        {it.description ? <div style={{ fontSize: ".7rem", color: "var(--text3)", marginTop: 2 }}>{it.description}</div> : null}
                      </td>
                      <td>{it.qty}</td>
                      <td>₹{it.rate}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>₹{it.amount?.toFixed(2) || (it.qty * it.rate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontWeight: 800, fontSize: "1rem", marginTop: 8, color: "#FF6600", textAlign: "right" }}>🧾 Total: ₹{result.total.toFixed(2)}</div>
            <div className="ai-action-row">
              {!draftedIds.has(msgId) ? (
                <>
                  <button className="ai-btn-draft" onClick={() => handleDraft(msgId, result)}>📋 Create Draft</button>
                  <button className="ai-btn-edit" onClick={() => {
                    if (setInitialDraft && setPage) {
                      setInitialDraft(result);
                      setPage("billing");
                    } else {
                      showToast?.("Open Billing page and fill manually.", "success");
                    }
                  }}>✏️ Edit First</button>
                </>
              ) : (
                <button className="ai-btn-done" disabled>✅ Draft Invoice Created</button>
              )}
            </div>
          </div>
        )}
        {result.type === "ASK" && <div className="ai-ask-hint">💡 Type your answer below ↓</div>}
        {result.type === "SUGGEST" && (
          <div style={{ marginTop: 8 }}>
            {result.suggestions.map(s => (
              <button key={s} className="ai-suggest-chip" onClick={() => setInput(s)}>→ "{s}"</button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const clearMemory = () => {
    setMemory(createMemory());
    setMessages([{ id: "reset", role: "agent", time: nowTime(), text: "🧠 Memory cleared! Starting fresh." }]);
  };

  const mem = memory;
  const hasMemory = mem.customerName || mem.lastProductName || mem.lastWidth;

  return (
    <>
      <style>{CSS}</style>
      <div className="ai-page">
        {/* Header */}
        <div className="ai-header">
          <div>
            <div className="ai-header-title">🤖 AI Agent</div>
            <div className="ai-header-sub">🧠 Seller: <b>{sellerName || "You"}</b> · {products.length} products · Memory ON · Offline</div>
          </div>
          <button
            className={`ai-gmail-btn ${gmailToken ? "active" : ""}`}
            onClick={() => setShowGmailPanel(!showGmailPanel)}
            style={{ marginLeft: "auto", marginRight: "8px" }}
          >
            {gmailToken ? "✅ Gmail Linked" : "📧 Link Gmail"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={clearMemory}>🔄 Clear Memory</button>
        </div>

        {/* Gmail Panel */}
        {showGmailPanel && (
          <div className="ai-gmail-panel">
            <div className="ai-gmail-header">
              <div className="ai-gmail-title">📧 Gmail Auto-Bill</div>
              <button className="btn btn-xs btn-ghost" onClick={() => setShowGmailPanel(false)}>✕</button>
            </div>

            {!gmailToken ? (
              <div>
                <div style={{ fontSize: ".75rem", color: "var(--text2)", marginBottom: 8 }}>
                  Requires a free Google Cloud OAuth Client ID (Authorized JavaScript origin: http://localhost:5173).
                </div>
                <input
                  className="ai-gmail-input"
                  placeholder="Paste Google Client ID here..."
                  value={gmailClientId}
                  onChange={e => setGmailClientId(e.target.value)}
                />
                <button className="ai-btn-draft" style={{ width: "100%", padding: "6px" }} onClick={handleGmailConnect}>
                  Connect Gmail
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    className="ai-gmail-input"
                    style={{ margin: 0 }}
                    placeholder="Sender email (e.g. orders@client.com)"
                    value={gmailSender}
                    onChange={e => setGmailSender(e.target.value)}
                  />
                  <button
                    className="ai-btn-edit"
                    style={{ flexShrink: 0, padding: "0 12px", width: "auto" }}
                    onClick={fetchGmailOrders}
                    disabled={gmailLoading || !gmailSender}
                  >
                    {gmailLoading ? "Fetching..." : "Fetch"}
                  </button>
                </div>

                {gmailOrders.map(o => (
                  <div key={o.id} className="ai-gmail-order">
                    <div className="ai-gmail-order-header">
                      <span>Found Order: {o.result.customer || "Unknown"}</span>
                      <span style={{ color: "#16A34A" }}>₹{o.result.total}</span>
                    </div>
                    <div className="ai-gmail-order-snippet">{o.snippet.substring(0, 80)}...</div>
                    <button
                      className="ai-btn-draft"
                      style={{ padding: "6px", fontSize: ".75rem" }}
                      onClick={() => {
                        handleDraft(o.id, o.result);
                        setGmailOrders(prev => prev.filter(x => x.id !== o.id));
                      }}
                    >
                      ➕ Create Draft Bill
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Memory bar */}
        {hasMemory && (
          <div className="ai-memory-bar">
            <span style={{ color: "#FF6600", fontWeight: 700 }}>💾 Memory:</span>
            {mem.customerName && <span>👤 {mem.customerName}</span>}
            {mem.lastProductName && <span>🖨️ {mem.lastProductName}</span>}
            {mem.lastWidth && mem.lastHeight && <span>📐 {mem.lastWidth}×{mem.lastHeight}</span>}
            {mem.lastRate && <span>₹{mem.lastRate}/sqft</span>}
            {mem.orderCount > 0 && <span style={{ color: "#FF6600" }}>#{mem.orderCount} orders</span>}
          </div>
        )}

        {/* Quick pills */}
        <div className="ai-quick-pills">
          {["6x3 normal", "6x3 normal, 4x2 star", "Sales today?", "This week?", "Top customer?", "Unpaid?", "Last bill?", "help"].map(p => (
            <button key={p} className="ai-pill" onClick={() => setInput(p)}>{p}</button>
          ))}
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`ai-msg ${msg.role}`}>
              <div className={`ai-bubble ${msg.role}`}>
                {msg.role === "agent" && (
                  <div className="ai-agent-header">
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,102,0,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🤖</span>
                    <span style={{ color: "#FF6600", fontSize: ".7rem", fontWeight: 800 }}>AI AGENT</span>
                  </div>
                )}
                {msg.text && <div>{msg.text}</div>}
                {msg.result?.reasoning && (
                  <div style={{ fontSize: ".7rem", color: "var(--text3)", fontStyle: "italic", margin: "4px 0 6px", lineHeight: 1.5, borderLeft: "2px solid rgba(255,102,0,.3)", paddingLeft: 8 }}>
                    {msg.result.reasoning}
                  </div>
                )}
                {msg.result && renderResult(msg.result, msg.id)}
                <div className="ai-time">{msg.time}</div>
              </div>
            </div>
          ))}

          {thinking && thinkSteps.length > 0 && (
            <div className="ai-msg agent">
              <div className="ai-thinking-panel">
                <div className="ai-thinking-label">
                  <div className="ai-spinner" />
                  🤖 AI AGENT · Thinking...
                </div>
                {thinkSteps.map((step, i) => (
                  <div
                    key={i}
                    className={`ai-thinking-step ${i < activeStep ? "done" : i === activeStep ? "active" : ""}`}
                  >
                    {i < activeStep
                      ? <span className="ai-step-tick">✓</span>
                      : i === activeStep
                        ? <div className="ai-spinner" />
                        : <div className="ai-step-wait" />
                    }
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="ai-input-bar">
          <textarea
            className="ai-input-field"
            placeholder="Type order or question... (Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={1}
          />
          <button
            className={`ai-mic-btn ${listening ? "listening" : ""}`}
            onClick={toggleVoice}
            title={listening ? "Stop listening" : "Start voice input"}
          >
            🎤
          </button>
          <button
            className={`ai-send-btn ${input.trim() ? "active" : "inactive"}`}
            onClick={handleSend}
            disabled={!input.trim() || thinking}
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
