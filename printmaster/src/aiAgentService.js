// ── AI Agent Service ────────────────────────────────────────────────────────
// Calls Groq Llama-3 directly from the browser (CORS is allowed by Groq).
// Falls back to smart local keyword matching if the API fails for any reason.

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

const SYSTEM_PROMPT = `You are "Archer", an intelligent voice assistant for a billing, CRM, and order management software used by small Indian print shops.
You will receive a user command via voice transcription, along with some real-time data context about their shop.

CRITICAL INSTRUCTION: The user command comes from a Voice-to-Text transcriber which often makes severe spelling/grammar mistakes (e.g., "chete" = "chat", "intione" = "intention", "taks" = "task", "cooret" = "correct"). You MUST intelligently infer the correct meaning of their command despite typos!

YOUR ONLY OUTPUT MUST BE A RAW JSON OBJECT WITH NO MARKDOWN FORMATTING (no \`\`\`json block).

The JSON MUST match this exact schema:
{
  "spoken_text": "Your conversational reply. If the user asks a question, ANSWER it directly using the CONTEXT provided. Otherwise, confirm your action. Keep it casual, friendly, and brief (1-3 sentences).",
  "action": {
     "type": "NONE" | "NAVIGATE" | "CREATE_TASK" | "CREATE_DRAFT_BILL" | "CREATE_PAYMENT_IN",
     "payload": "string OR json object depending on type"
  }
}

Action Rules:
1. "NONE": Use if the user asks a general question about their business (e.g. "how much money does Rahul owe me?", "hi"). ANSWER IT directly in 'spoken_text' using the CONTEXT. payload: null.
2. "NAVIGATE": Provide the page name exactly. Choices: "dashboard" | "create-bill" | "billing" | "tasks" | "customers" | "reports" | "products" | "vendors" | "workers" | "settings".
3. "CREATE_TASK": If the user says "add a task", "remind me to...", "make a task".
   - payload must be a JSON object: { "title": "...", "notes": "..." }
4. "CREATE_DRAFT_BILL": If the user asks to "make a bill for [Customer] for [Quantity] [Item] at [Price] rupees". 
   - payload must be a JSON array of items: { "customer": "Customer Name", "items": [{ "name": "Item Name", "qty": X, "rate": Y, "total": X*Y }] }
5. "CREATE_PAYMENT_IN": If the user says "record payment from [Customer] of [Amount] rupees" or "paid [Amount] by [Customer]".
   - payload MUST be a JSON object containing: { "customer": "Customer Name", "isPaymentIn": true, "items": [{"name": "Payment In", "qty": 1, "rate": Amount, "total": Amount}], "payments": [{"method": "cash", "amount": Amount}] }

Do NOT use markdown code blocks like \`\`\`json. Only return the raw JSON object. Always reply in simple english.`;

// ── Local keyword fallback (runs when API is unavailable) ────────────────────
function localKeywordFallback(command) {
  const c = command.toLowerCase();
  const rules = [
    { keywords: ["create bill", "make bill", "make a bill", "new order", "sell"], page: "create-bill",   msg: "Opening the bill maker for you!" },
    { keywords: ["bill", "invoice", "sales"],                                          page: "billing",       msg: "Opening the sales invoices for you!" },
    { keywords: ["customer", "party", "client", "pending", "due", "khata"],          page: "customers",  msg: "Sure, taking you to the customers page." },
    { keywords: ["staff", "worker", "attendance", "salary", "payroll", "employee"],  page: "workers",    msg: "Opening the staff and payroll section." },
    { keywords: ["product", "item", "stock", "inventory", "catalogue"],              page: "products",   msg: "Taking you to the products and inventory." },
    { keywords: ["vendor", "supplier", "purchase", "buy"],                            page: "vendors",    msg: "Opening the vendors section." },
    { keywords: ["payment", "receive", "paid", "record payment"],                     page: "payment-in", msg: "Opening the payment in screen." },
    { keywords: ["task", "note", "reminder", "todo", "to-do"],                       page: "tasks",      msg: "Taking you to your tasks." },
    { keywords: ["setting", "profile", "config", "open setting"],                     page: "settings",   msg: "Opening your settings." },
    { keywords: ["report", "sale", "revenue", "dashboard", "summary", "analytics"],  page: "dashboard",  msg: "Sure! Opening the sales dashboard." },
  ];
  for (const rule of rules) {
    if (rule.keywords.some(k => c.includes(k))) {
      return {
        spoken_text: rule.msg,
        action: { type: "NAVIGATE", payload: rule.page }
      };
    }
  }
  return {
    spoken_text: "I heard you! I'm not sure where to go for that. Could you try saying 'open settings' or 'make a bill'?",
    action: { type: "NONE", payload: null }
  };
}

// ── Main exported function ────────────────────────────────────────────────────
export async function processVoiceCommandAI(transcript, contextParams) {
  // If no API key at all, go straight to local fallback
  if (!GROQ_API_KEY) {
    console.warn("VITE_GROQ_API_KEY not set. Using local keyword fallback.");
    return localKeywordFallback(transcript);
  }

  try {
    const context = {
      customersCount: (contextParams.customers || []).length,
      recentCustomers: (contextParams.customers || []).slice(0, 5).map(c => c.name),
      recentBills: (contextParams.bills || []).slice(0, 5).map(b => ({
        invoice_number: b.id, total: b.total, party: b.customer, isPaid: b.paid
      })),
      totalRevenue: (contextParams.bills || []).reduce((sum, b) => sum + (b.total || 0), 0),
      pendingTasks: (contextParams.tasks || []).filter(t => t.status !== "Completed").length,
      totalProducts: (contextParams.products || []).length
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `CONTEXT: ${JSON.stringify(context)}\n\nUSER COMMAND: ${transcript}` }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.warn("Groq API error:", response.status, await response.text());
      return localKeywordFallback(transcript);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return localKeywordFallback(transcript);

    const parsed = JSON.parse(content);
    // Sanitise: ensure expected fields exist
    return {
      spoken_text: parsed.spoken_text || "Done!",
      action: parsed.action || { type: "NONE", payload: null }
    };

  } catch (error) {
    console.error("AI Agent Service Error:", error);
    return localKeywordFallback(transcript);
  }
}

// ── Audio Transcription via Groq Whisper ──────────────────────────────────────
export async function transcribeAudio(audioBlob) {
  if (!GROQ_API_KEY) {
    console.error("No Groq API Key found. Please restart Vite server or add VITE_GROQ_API_KEY to Vercel.");
    return null;
  }

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "json");
  formData.append("temperature", "0.0");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      console.error("Whisper API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Transcription Error:", error);
    return null;
  }
}

