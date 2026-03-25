const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendBody = {
  to?: string;
  subject?: string;
  text?: string;
  replyTo?: string;
  meta?: Record<string, unknown>;
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toBase64UrlUtf8(value: string) {
  return bytesToBase64(new TextEncoder().encode(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeMimeHeader(value: string) {
  if (!/[^\x20-\x7E]/.test(value)) return value;
  return `=?UTF-8?B?${bytesToBase64(new TextEncoder().encode(value))}?=`;
}

function buildMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const lines = [
    `From: Apartmani Balent <${params.from}>`,
    `To: ${params.to}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];

  if (params.replyTo) lines.push(`Reply-To: ${params.replyTo}`);

  lines.push("", params.text);
  return lines.join("\r\n");
}

async function getAccessToken() {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Gmail OAuth secrets.");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "Failed to refresh Gmail token.");
  }

  return tokenData.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  try {
    const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const origin = req.headers.get("origin") || "";
    if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) {
      return json(403, { ok: false, error: "Origin not allowed." });
    }

    const body = (await req.json()) as SendBody;
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const text = String(body.text || "").trim();
    const replyTo = String(body.replyTo || "").trim();
    const from = String(Deno.env.get("GMAIL_FROM_EMAIL") || "").trim();

    if (!to || !subject || !text) {
      return json(400, { ok: false, error: "Missing to, subject or text." });
    }
    if (!from) {
      return json(500, { ok: false, error: "Missing GMAIL_FROM_EMAIL secret." });
    }

    const accessToken = await getAccessToken();
    const raw = toBase64UrlUtf8(buildMimeMessage({ from, to, subject, text, replyTo }));

    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    const gmailData = await gmailRes.json();
    if (!gmailRes.ok) {
      return json(502, {
        ok: false,
        error: gmailData?.error?.message || "Gmail send failed.",
        details: gmailData,
      });
    }

    return json(200, {
      ok: true,
      id: gmailData.id || null,
      threadId: gmailData.threadId || null,
    });
  } catch (err) {
    return json(500, {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    });
  }
});
