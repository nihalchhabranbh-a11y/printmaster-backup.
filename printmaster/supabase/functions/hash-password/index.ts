const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function hashPassword(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plaintext),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: 100_000 },
    key,
    256
  );
  const toHex = (u8: Uint8Array) =>
    Array.from(u8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return `pbkdf2:sha256:100000:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return json({ error: "Missing or invalid password field" }, 400);
    }
    const hash = await hashPassword(password);
    return json({ hash });
  } catch (err) {
    console.error("hash-password error:", err);
    return json({ error: String(err) }, 500);
  }
});
