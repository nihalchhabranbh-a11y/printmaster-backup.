import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Custom Vite plugin to handle Sandbox 2-step authentication & proxying
function sandboxDevProxy(env) {
  let cachedToken = null;
  let tokenExpiry = 0;
  
  return {
    name: 'sandbox-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/sandbox', async (req, res, next) => {
        const baseUrl = env.VITE_SANDBOX_URL || 'https://api.sandbox.co.in';
        const apiKey = env.VITE_SANDBOX_API_KEY || '';
        const apiSecret = env.VITE_SANDBOX_API_SECRET || '';

        try {
          // 1. Authenticate if no valid token
          if (!cachedToken || Date.now() > tokenExpiry) {
            const authRes = await fetch(`${baseUrl}/authenticate`, {
              method: 'POST',
              headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'Content-Type': 'application/json' }
            });
            const authData = await authRes.json();
            if (authData.access_token) {
              cachedToken = authData.access_token;
              tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
            } else {
              res.statusCode = 401;
              return res.end(JSON.stringify({ error: 'Sandbox Auth Failed', details: authData }));
            }
          }

          // 2. Intercept body for upstream proxying (if any)
          const sandboxPath = req.originalUrl.replace(/^\/api\/sandbox/, '');
          try {
            const fetchOptions = {
              method: req.method,
              headers: {
                'x-api-key': apiKey,
                'authorization': `Bearer ${cachedToken}`,
                'x-api-version': '1.0',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            };
            if (req.method !== 'GET' && req.headers['content-type']?.includes('json')) {
              let bodyStr = '';
              for await (const chunk of req) bodyStr += chunk;
              if (bodyStr) fetchOptions.body = bodyStr;
            } else if (req.method !== 'GET') {
              // Pipe stream
              fetchOptions.body = req;
              fetchOptions.duplex = 'half';
            }

            const sandboxRes = await fetch(`${baseUrl}${sandboxPath}`, fetchOptions);
            const status = sandboxRes.status;
            let responseBody = await sandboxRes.text();

            // MOCK OVERRIDE: If Sandbox returns 403 Insufficient Privilege, provide mock data for GST finder
            if (status === 403 && sandboxPath.includes('/gst/compliance/taxpayer')) {
                const gstin = sandboxPath.split('/').pop() || "08AABCJ0355R1Z7";
                responseBody = JSON.stringify({
                    data: {
                        gstin: gstin,
                        trade_name: "Mock Printers Pvt Ltd (Sandbox 403 Fallback)",
                        legal_name: "Mock Printers Legal Entity",
                        status: "Active",
                        state: "Delhi",
                        address: "123 Print Street, New Delhi, 110001",
                        registration_date: "01/04/2023",
                        constitution_of_business: "Private Limited Company",
                        filing_status: "Last filed: May 2024"
                    }
                });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(responseBody);
                return;
            }

            res.statusCode = status;
            sandboxRes.headers.forEach((val, key) => res.setHeader(key, val));
            res.end(responseBody);
          } catch(e) {
            console.error('Sandbox Dev Proxy Error:', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

// Custom Vite plugin to proxy AI Voice Assistant directly to Groq in dev mode
function aiDevProxy(env) {
  return {
    name: 'ai-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        
        let bodyStr = '';
        for await (const chunk of req) bodyStr += chunk;
        const bodyObj = JSON.parse(bodyStr || '{}');

        const GROQ_API_KEY = env.GROQ_API_KEY;
        if (!GROQ_API_KEY) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: "Missing GROQ_API_KEY in .env.local" }));
        }

        const systemPrompt = `You are "PrintMaster AI", the voice assistant for a billing, CRM, and order management software.
You will receive a user command via voice transcription, along with some context about their shop (recent customers, bills, products).

Your job is to understand their intent and respond back.
YOUR ONLY OUTPUT MUST BE A RAW JSON OBJECT WITH NO MARKDOWN FORMATTING.

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
4. If the user mentions workers, staff, or tasks -> NAVIGATE to "tasks"  or "workers".

Act highly intelligent, professional, and swift.`;

        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "llama3-8b-8192",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `CONTEXT: ${bodyObj.contextStr}\n\nUSER COMMAND: ${bodyObj.command}` }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" },
            })
          });

          const data = await groqRes.json();
          if (data.choices && data.choices[0] && data.choices[0].message) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(data.choices[0].message.content); // Return raw JSON string
          } else {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: "Invalid response from Groq", details: data }));
          }
        } catch (err) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), sandboxDevProxy(env), aiDevProxy(env)],
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/supabase-js'],
    },
  };
})