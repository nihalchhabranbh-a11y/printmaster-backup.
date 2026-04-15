export const config = {
  runtime: 'edge', // Vercel Edge function (super fast, no cold boot delay)
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Only POST requests allowed' }), { status: 405 });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  try {
    const { command, contextStr } = await request.json();

    // If API key is missing (e.g., ran locally without .env.local configuration), mock the response
    if (!GROQ_API_KEY) {
       console.log("No GROQ_API_KEY found. Using local sandbox mock override.");
       const isBilling = command.toLowerCase().includes("bill") || command.toLowerCase().includes("invoice");
       const isTask = command.toLowerCase().includes("task");
       const isCustom = command.toLowerCase().includes("customer");
       
       let target = "dashboard";
       let text = "Okay, I'll take you there right now.";
       if (isBilling) target = "billing";
       if (isTask) target = "tasks";
       if (isCustom) target = "customers";

       return new Response(JSON.stringify({
          spoken_text: `(MOCK API) I don't see an API key yet, but I'll open ${target} for you.`,
          action: { type: "NAVIGATE", payload: target }
       }), { headers: { 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `You are "PrintMaster AI", the voice assistant for a billing, CRM, and order management software.
You will receive a user command via voice transcription, along with some context about their shop (recent customers, bills, products).

Your job is to understand their intent and respond back.
YOUR ONLY OUTPUT MUST BE A RAW JSON OBJECT WITH NO MARKDOWN FORMATTING (no \`\`\`json block).

The JSON MUST match this exact schema:
{
  "spoken_text": "A friendly, conversational reply (1-2 sentences) confirming what you are doing. For example: 'Opening the bill maker for Suresh.'",
  "action": {
     "type": "NONE" | "NAVIGATE",
     "payload": "dashboard" | "billing" | "tasks" | "customers" | "reports" | "live-alerts" | "products" | "vendors"
  }
}

Rules:
1. If the user wants to check sales, reports, or overview -> NAVIGATE to "dashboard".
2. If the user wants to make a bill or invoice -> NAVIGATE to "billing".
3. If the user mentions pending amounts or a customer's history -> NAVIGATE to "customers".
4. If the user mentions workers, staff, or tasks -> NAVIGATE to "tasks" or "workers".

Act highly intelligent, professional, and swift.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Groq's fast Llama 3 8B model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `CONTEXT: ${contextStr}\n\nUSER COMMAND: ${command}` }
        ],
        temperature: 0.1, // Keep it highly deterministic for routing
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error("Groq API Error: " + err);
    }

    const data = await response.json();
    const resultObj = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(resultObj), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
       status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
