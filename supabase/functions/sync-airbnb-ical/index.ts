const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type IcalSource = {
  id: string;
  apartman: number;
  naziv: string | null;
  ical_url: string;
  aktivan: boolean;
};

type Reservation = {
  id?: string;
  apartman: number;
  ime?: string | null;
  datum_dolaska: string;
  datum_odlaska: string;
  status: string;
  izvor?: string | null;
  external_source?: string | null;
  external_uid?: string | null;
};

type IcalEvent = {
  uid: string;
  summary: string;
  start: string;
  end: string;
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function unfoldIcal(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseIcalDate(value: string) {
  const clean = value.trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return "";
}

function parseIcal(text: string): IcalEvent[] {
  const lines = unfoldIcal(text).split(/\r?\n/);
  const events: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    if (line.trim() === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line.trim() === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const rawKey = line.slice(0, idx);
    const key = rawKey.split(";")[0].toUpperCase();
    current[key] = line.slice(idx + 1);
  }

  return events
    .map((event, index) => {
      const start = parseIcalDate(event.DTSTART || "");
      const end = parseIcalDate(event.DTEND || "");
      return {
        uid: String(event.UID || `${start}-${end}-${index}`),
        summary: String(event.SUMMARY || "Airbnb"),
        start,
        end,
      };
    })
    .filter((event) => event.start && event.end && event.end > event.start);
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

function isCancelled(row: Reservation) {
  return String(row.status || "").trim().toLowerCase() === "otkazano";
}

function isUnavailableLabel(value: string | null | undefined) {
  const label = String(value || "").trim().toLowerCase();
  return label.includes("not available") || label === "unavailable";
}

function jwtRole(token: string) {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return "";
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(atob(normalized));
    return String(payload?.role || "");
  } catch {
    return "";
  }
}

async function verifyUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  if (token === serviceKey || jwtRole(token) === "service_role") return true;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: serviceKey },
  });
  return res.ok;
}

async function rest<T>(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase REST error ${res.status}`);
  return data as T;
}

async function updateSourceStatus(
  supabaseUrl: string,
  serviceKey: string,
  sourceId: string,
  status: string,
  message: string,
) {
  await rest(supabaseUrl, serviceKey, `airbnb_ical_sources?id=eq.${sourceId}`, {
    method: "PATCH",
    body: JSON.stringify({
      last_synced_at: new Date().toISOString(),
      last_status: status,
      last_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed." });

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

    if (!(await verifyUser(req, supabaseUrl, serviceKey))) {
      return json(401, { ok: false, error: "Not authenticated." });
    }

    const body = await req.json().catch(() => ({}));
    const onlyApartment = Number(body?.apartman || 0) || null;
    const sourceFilter = onlyApartment ? `&apartman=eq.${onlyApartment}` : "";
    const sources = await rest<IcalSource[]>(
      supabaseUrl,
      serviceKey,
      `airbnb_ical_sources?select=*&aktivan=eq.true${sourceFilter}&order=apartman.asc`,
    );

    const today = new Date().toISOString().slice(0, 10);
    const seasonStart = `${new Date().getFullYear()}-01-01`;
    const results = [];

    for (const source of sources) {
      try {
        const calendarRes = await fetch(source.ical_url, {
          headers: { "User-Agent": "ApartmaniBalent/1.0 iCal sync" },
        });
        if (!calendarRes.ok) throw new Error(`iCal fetch failed: ${calendarRes.status}`);

        const events = parseIcal(await calendarRes.text());
        const ignoredEvents = events.filter((event) => isUnavailableLabel(event.summary));
        const activeEvents = events.filter((event) =>
          !isUnavailableLabel(event.summary) &&
          event.end >= seasonStart
        );
        const eventIds = new Set(activeEvents.map((event) => `${source.id}:${event.uid}`));

        const existing = await rest<Reservation[]>(
          supabaseUrl,
          serviceKey,
          `rezervacije?select=id,apartman,ime,datum_dolaska,datum_odlaska,status,izvor,external_source,external_uid&apartman=eq.${source.apartman}`,
        );

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let cancelled = 0;
        let replaced = 0;
        const conflicts: string[] = [];
        const replacedIds = new Set<string>();

        for (const event of activeEvents) {
          const externalUid = `${source.id}:${event.uid}`;
          const existingImported = existing.find((row) => row.external_source === "airbnb_ical" && row.external_uid === externalUid);
          const blockers = existing.filter((row) =>
            row.id &&
            row.id !== existingImported?.id &&
            !replacedIds.has(row.id) &&
            !isCancelled(row) &&
            !isUnavailableLabel(row.ime) &&
            rangesOverlap(event.start, event.end, row.datum_dolaska, row.datum_odlaska)
          );

          for (const blocker of blockers) {
            await rest(supabaseUrl, serviceKey, `rezervacije?id=eq.${blocker.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                status: "otkazano",
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                komentar: `Automatski otkazano jer je Airbnb iCal mjerodavan za Apt ${source.apartman}. Zamijenjeno terminom ${event.start}-${event.end}.`,
              }),
            });
            replacedIds.add(blocker.id);
            replaced++;
            conflicts.push(`${event.start}-${event.end}: zamijenjeno ${blocker.ime || blocker.izvor || "postojeca rezervacija"}`);
          }

          const payload = {
            apartman: source.apartman,
            ime: event.summary && event.summary !== "Reserved" ? event.summary : "Airbnb",
            datum_dolaska: event.start,
            datum_odlaska: event.end,
            broj_osoba: 0,
            broj_djece: 0,
            izvor: "airbnb",
            status: "potvrdjeno",
            blokiraj_termin: true,
            external_source: "airbnb_ical",
            external_uid: externalUid,
            ical_source_id: source.id,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (existingImported) {
            await rest(supabaseUrl, serviceKey, `rezervacije?id=eq.${existingImported.id}`, {
              method: "PATCH",
              body: JSON.stringify({ ...payload, status: "potvrdjeno" }),
            });
            updated++;
          } else {
            await rest(supabaseUrl, serviceKey, "rezervacije", {
              method: "POST",
              body: JSON.stringify([payload]),
            });
            inserted++;
          }
        }

        const importedForSource = existing.filter((row) =>
          row.external_source === "airbnb_ical" &&
          row.external_uid?.startsWith(`${source.id}:`) &&
          !isCancelled(row) &&
          row.datum_odlaska >= today
        );
        for (const row of importedForSource) {
          if (row.external_uid && !eventIds.has(row.external_uid)) {
            await rest(supabaseUrl, serviceKey, `rezervacije?id=eq.${row.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                status: "otkazano",
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                komentar: "Automatski otkazano jer vise nije u Airbnb iCal kalendaru.",
              }),
            });
            cancelled++;
          }
        }

        const ignored = ignoredEvents.length;
        const message = conflicts.length
          ? `Uvezeno ${inserted}, azurirano ${updated}, zamijenjeno starih ${replaced}, preskoceno ${skipped}, otkazano ${cancelled}, zanemareno nedostupnih ${ignored}. Airbnb je mjerodavan. Detalji: ${conflicts.join("; ")}`
          : `Uvezeno ${inserted}, azurirano ${updated}, zamijenjeno starih ${replaced}, preskoceno ${skipped}, otkazano ${cancelled}, zanemareno nedostupnih ${ignored}. Airbnb je mjerodavan.`;
        await updateSourceStatus(supabaseUrl, serviceKey, source.id, "ok", message);
        results.push({ apartman: source.apartman, ok: true, inserted, updated, replaced, skipped, cancelled, ignored, conflicts });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown sync error.";
        await updateSourceStatus(supabaseUrl, serviceKey, source.id, "error", message);
        results.push({ apartman: source.apartman, ok: false, error: message });
      }
    }

    return json(200, { ok: true, results });
  } catch (err) {
    return json(500, { ok: false, error: err instanceof Error ? err.message : "Unexpected error." });
  }
});
