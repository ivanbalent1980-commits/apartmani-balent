type PublicRequest = {
  action?: "availability" | "enquiry";
  apartment?: number;
  mode?: "booking" | "question";
  name?: string;
  email?: string;
  phone?: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
  children?: number;
  extraBed?: boolean;
  message?: string;
  translatedMessage?: string;
  language?: string;
  honeypot?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  landingPath?: string;
};

type AvailabilityRow = {
  apartman: number;
  datum_dolaska: string;
  datum_odlaska: string;
  status: string;
  blokiraj_termin?: boolean;
};

const allowedOrigins = new Set([
  "https://apartmanibalent.hr",
  "https://www.apartmanibalent.hr",
  "https://vocal-scone-24cfc5.netlify.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://apartmanibalent.hr",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

function blocksCalendar(row: AvailabilityRow) {
  const status = String(row.status || "").toLowerCase();
  return status === "potvrdjeno" || status === "blokirano" ||
    (status === "ceka_akontaciju" && row.blokiraj_termin === true);
}

function serviceHeaders(extra: Record<string, string> = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders((init.headers || {}) as Record<string, string>),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Database request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function getAvailability(apartment?: number) {
  const params = new URLSearchParams({
    select: "apartman,datum_dolaska,datum_odlaska,status,blokiraj_termin",
    status: "in.(potvrdjeno,blokirano,ceka_akontaciju)",
    order: "datum_dolaska.asc",
  });
  if (apartment) params.set("apartman", `eq.${apartment}`);
  const rows = await rest(`rezervacije?${params}`) as AvailabilityRow[];
  return (rows || []).filter(blocksCalendar).map((row) => ({
    apartman: Number(row.apartman),
    datum_dolaska: row.datum_dolaska,
    datum_odlaska: row.datum_odlaska,
    status: row.status,
  }));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientAddress(req: Request) {
  return cleanText(
    req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
    100,
  );
}

async function enforceRateLimit(req: Request, kind: string, payloadSignature: string) {
  const fingerprint = await sha256(`${clientAddress(req)}|${req.headers.get("user-agent") || ""}`);
  const payloadHash = await sha256(payloadSignature);
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const recentParams = new URLSearchParams({
    select: "payload_hash,created_at",
    fingerprint: `eq.${fingerprint}`,
    request_kind: `eq.${kind}`,
    created_at: `gte.${fifteenMinutesAgo}`,
    order: "created_at.desc",
    limit: "6",
  });
  const recent = await rest(`public_form_rate_limits?${recentParams}`) as Array<{payload_hash: string; created_at: string}>;
  if ((recent || []).length >= 5) return { allowed: false, reason: "too_many" };
  if ((recent || []).some((row) => row.payload_hash === payloadHash && row.created_at >= fiveMinutesAgo)) {
    return { allowed: false, reason: "duplicate" };
  }

  await rest("public_form_rate_limits", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ fingerprint, request_kind: kind, payload_hash: payloadHash }),
  });

  const cleanupBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  rest(`public_form_rate_limits?created_at=lt.${encodeURIComponent(cleanupBefore)}`, { method: "DELETE" }).catch(() => undefined);
  return { allowed: true, reason: "ok" };
}

async function sendOwnerEmail(subject: string, text: string, replyTo: string) {
  const recipient = cleanText(Deno.env.get("ENQUIRY_TO_EMAIL") || "ivana.balent1@gmail.com", 254);
  const response = await fetch(`${env("SUPABASE_URL")}/functions/v1/send-gmail`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      to: recipient,
      subject,
      text,
      replyTo,
      meta: { source: "public-site-api" },
    }),
  });
  return response.ok;
}

async function handleEnquiry(req: Request, body: PublicRequest) {
  if (cleanText(body.honeypot, 200)) return json(req, 200, { ok: true });

  const mode = body.mode === "question" ? "question" : "booking";
  const name = cleanText(body.name, 100);
  const email = cleanText(body.email, 254).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const message = cleanText(body.message, 3000);
  const translatedMessage = cleanText(body.translatedMessage, 3000);
  const language = cleanText(body.language, 10).toLowerCase() || "hr";
  const apartment = Number(body.apartment || 0);
  const checkin = cleanText(body.checkin, 10);
  const checkout = cleanText(body.checkout, 10);
  const adults = Math.max(1, Math.min(5, Number(body.adults || 1)));
  const children = Math.max(0, Math.min(5, Number(body.children || 0)));
  const extraBed = body.extraBed === true;
  const campaignParts = [
    cleanText(body.utmSource, 60) ? `source=${cleanText(body.utmSource, 60)}` : "",
    cleanText(body.utmMedium, 60) ? `medium=${cleanText(body.utmMedium, 60)}` : "",
    cleanText(body.utmCampaign, 80) ? `campaign=${cleanText(body.utmCampaign, 80)}` : "",
    cleanText(body.utmContent, 80) ? `content=${cleanText(body.utmContent, 80)}` : "",
    cleanText(body.landingPath, 160) ? `landing=${cleanText(body.landingPath, 160)}` : "",
  ].filter(Boolean);
  const campaignText = campaignParts.join("; ");

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(req, 400, { ok: false, code: "invalid_contact" });
  }
  if (mode === "question" && message.length < 2) {
    return json(req, 400, { ok: false, code: "invalid_message" });
  }
  if (mode === "booking" && (!Number.isInteger(apartment) || apartment < 1 || apartment > 4 ||
      !validDate(checkin) || !validDate(checkout) || checkout <= checkin)) {
    return json(req, 400, { ok: false, code: "invalid_booking" });
  }

  const signature = [mode, name, email, apartment, checkin, checkout, message].join("|");
  const rate = await enforceRateLimit(req, mode, signature);
  if (!rate.allowed) return json(req, 429, { ok: false, code: rate.reason });

  if (mode === "booking") {
    const occupied = await getAvailability(apartment);
    if (occupied.some((row) => rangesOverlap(checkin, checkout, row.datum_dolaska, row.datum_odlaska))) {
      return json(req, 409, { ok: false, code: "dates_unavailable" });
    }

    const commentParts = [
      `Web upit (${language})`,
      phone ? `Telefon: ${phone}` : "",
      message ? `Poruka: ${message}` : "",
      translatedMessage && translatedMessage !== message ? `Prijevod: ${translatedMessage}` : "",
      campaignText ? `Kampanja: ${campaignText}` : "",
    ].filter(Boolean);
    await rest("rezervacije", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        apartman: apartment,
        ime: name,
        email,
        telefon: phone || null,
        datum_dolaska: checkin,
        datum_odlaska: checkout,
        broj_osoba: adults + children,
        odrasli: adults,
        djeca: children,
        broj_djece: children,
        pomocni_lezaj: extraBed,
        izvor: "vlastiti",
        status: "upit",
        blokiraj_termin: false,
        komentar: commentParts.join("\n") || null,
      }),
    });

    const text = [
      "APARTMANI BALENT - Novi upit s web stranice",
      "------------------------------------------",
      `Ime i prezime: ${name}`,
      `Email: ${email}`,
      `Telefon: ${phone || "-"}`,
      `Jezik: ${language}`,
      "",
      `Apartman: Apartman ${apartment}`,
      `Datum dolaska: ${checkin}`,
      `Datum odlaska: ${checkout}`,
      `Odrasli: ${adults}`,
      `Djeca: ${children}`,
      `Pomoćni ležaj: ${extraBed ? "da" : "ne"}`,
      campaignText ? `Izvor kampanje: ${campaignText}` : "",
      message ? `\nPoruka:\n${message}` : "",
      translatedMessage && translatedMessage !== message ? `\nHrvatski prijevod:\n${translatedMessage}` : "",
    ].filter(Boolean).join("\n");
    const mailSent = await sendOwnerEmail(`Novi upit - Apartman ${apartment} - ${checkin} do ${checkout}`, text, email).catch(() => false);
    return json(req, 200, { ok: true, mailSent });
  }

  await rest("poruke", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      tip: "obicna",
      ime: name,
      email,
      telefon: phone || null,
      original_text: campaignText ? `${message}\n\n[Izvor kampanje: ${campaignText}]` : message,
      translated_text_hr: translatedMessage || (language === "hr" ? message : null),
      original_language: language,
      status: "nova",
      procitano: false,
    }),
  });

  const text = [
    "APARTMANI BALENT - Nova poruka s web stranice",
    "------------------------------------------",
    `Ime i prezime: ${name}`,
    `Email: ${email}`,
    `Telefon: ${phone || "-"}`,
    `Jezik: ${language}`,
    "",
    "Poruka:",
    message,
    campaignText ? `\nIzvor kampanje: ${campaignText}` : "",
    translatedMessage && translatedMessage !== message ? `\nHrvatski prijevod:\n${translatedMessage}` : "",
  ].filter(Boolean).join("\n");
  const mailSent = await sendOwnerEmail(`Nova poruka s web stranice - ${name}`, text, email).catch(() => false);
  return json(req, 200, { ok: true, mailSent });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false, code: "method_not_allowed" });

  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, 403, { ok: false, code: "origin_not_allowed" });

  try {
    const body = (await req.json()) as PublicRequest;
    if (body.action === "availability") {
      const apartment = body.apartment == null ? undefined : Number(body.apartment);
      if (apartment != null && (!Number.isInteger(apartment) || apartment < 1 || apartment > 4)) {
        return json(req, 400, { ok: false, code: "invalid_apartment" });
      }
      return json(req, 200, { ok: true, records: await getAvailability(apartment) });
    }
    if (body.action === "enquiry") return await handleEnquiry(req, body);
    return json(req, 400, { ok: false, code: "invalid_action" });
  } catch (error) {
    console.error("public-site-api failed", error instanceof Error ? error.message : "unknown error");
    return json(req, 500, { ok: false, code: "server_error" });
  }
});
