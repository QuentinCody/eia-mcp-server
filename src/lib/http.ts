import { fail } from "./errors";
export { fail } from "./errors";

export function eiaPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 500 || !/^\/v2(?:\/[A-Za-z0-9_-]+)*\/?$/.test(value)) {
    fail("Use a relative /v2 route with plain route identifiers");
  }
  return value.replace(/\/$/, "");
}

/** Fixed-host, single-attempt reads with a complete header/body deadline. */
export async function eiaJson(path: string, params: Record<string, unknown>, apiKey?: string, opts?: {
  timeoutMs?: number; maxBytes?: number;
}) {
  const { url, headers, sourceUrl, apiKey: verifiedApiKey } = prepareEiaRequest(path, params, apiKey);
  const controller = new AbortController();
  const maxBytes = opts?.maxBytes ?? 4 * 1024 * 1024;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("deadline")); }, opts?.timeoutMs ?? 50_000);
  });
  try {
    try {
      const pending = Promise.resolve(fetch(url, { headers, redirect: "manual", signal: controller.signal })).then(value => {
        if (controller.signal.aborted) { void value.body?.cancel().catch(() => {}); throw new Error("deadline"); }
        return value;
      });
      response = await Promise.race([pending, expired]);
    } catch { fail("EIA request failed or timed out", 502); }
    if (Number(response.headers.get("content-length")) > maxBytes) fail("EIA response exceeds byte limit (default 4 MiB)", 502);
    reader = response.body?.getReader();
    const { digest, size, raw, original } = await readRedactedBody(reader, expired, maxBytes, verifiedApiKey);
    const provenance = { source_url: sourceUrl, request: params, retrieved_at: new Date().toISOString(),
      response_sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""),
      response_bytes: size, raw_json: raw, redacted: raw !== original };
    return await decodeEiaResponse(response, raw, provenance);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
    else if (response) void response.body?.cancel().catch(() => {});
  }
}

async function decodeEiaResponse(response: Response, raw: string, provenance: { source_url: string; request: Record<string, unknown>; retrieved_at: string; response_sha256: string; response_bytes: number; raw_json: string; redacted: boolean; }) {
  const evidence = {
    upstream_http_status: response.status, retry_after: response.headers.get("retry-after"),
    content_type: response.headers.get("content-type"), text: raw, provenance
  };
  if (response.status !== 200 || response.headers.has("content-range")) {
    fail(`EIA HTTP ${response.status}`, response.status === 200 ? 502 : response.status, evidence);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw.replace(/^\uFEFF/, ""), (key, value) => /^api_?key$/i.test(key) ? undefined : value); }
  catch { fail("EIA returned invalid JSON", 502, evidence); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail("Invalid EIA response", 502, evidence);
  const data = parsed as Record<string, unknown>;
  if (data.error !== undefined) fail("EIA reported an API error; check route, frequency, columns and facets", 502, evidence);
  if (!data.response || typeof data.response !== "object" || Array.isArray(data.response)) fail("Missing EIA response envelope", 502, evidence);
  const redactedDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data)));
  return {
    status: response.status, data, provenance: {
      ...provenance, api_version: data.apiVersion ?? null,
      redacted_json_sha256: Array.from(new Uint8Array(redactedDigest), b => b.toString(16).padStart(2, "0")).join("")
    }
  };
}

function prepareEiaRequest(path: string, params: Record<string, unknown>, apiKey: string | undefined) {
  const url = new URL(eiaPath(path), "https://api.eia.gov");
  for (const [key, value] of Object.entries(params)) {
    if (/api_?key|authorization|token/i.test(key)) fail("Configure EIA_API_KEY in the Worker; do not pass credentials as parameters");
    if (value === undefined || value === null) continue;
    const values = Array.isArray(value) ? value : [value];
    if (values.length > 100) fail("Use at most 100 values per parameter");
    for (const item of values) {
      if (!["string", "number", "boolean"].includes(typeof item) || String(item).length > 2000
        || typeof item === "number" && !Number.isFinite(item)) fail("Invalid EIA parameter value");
      url.searchParams.append(key, String(item));
    }
  }
  if (url.toString().length > 16000) fail("EIA request is too long; narrow the selection");
  if (!apiKey?.trim()) fail("EIA_API_KEY is required", 401);
  const sourceUrl = url.toString();
  url.searchParams.set("api_key", apiKey);
  const headers = { Accept: "application/json" };
  return { url, headers, sourceUrl, apiKey };
}

async function readRedactedBody(reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | undefined, expired: Promise<never>, maxBytes: number, apiKey: string) {
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (reader) {
      const { value, done } = await Promise.race([reader.read(), expired]); if (done) break;
      size += value.byteLength; if (size > maxBytes) fail("Response exceeds byte limit", 502);
      chunks.push(value);
    }
  } catch { fail("EIA response unreadable, timed out or exceeds byte limit (default 4 MiB)", 502); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let raw: string;
  try { raw = (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? "\uFEFF" : "") + new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes); }
  catch { fail("EIA returned invalid UTF-8", 502); }
  const original = raw;
  // Decode JSON string tokens before redaction so Unicode-escaped echoes cannot leak the key.
  raw = raw.replace(/"(?:[^"\\]|\\.)*"/g, token => {
    try {
      const decoded = JSON.parse(token) as string;
      const safe = decoded.split(apiKey).join("[REDACTED]").split(encodeURIComponent(apiKey)).join("[REDACTED]");
      return safe === decoded ? token : JSON.stringify(safe);
    } catch { return token; }
  });
  for (const value of new Set([apiKey, encodeURIComponent(apiKey), JSON.stringify(apiKey).slice(1, -1)])) raw = raw.split(value).join("[REDACTED]");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return { digest, size, raw, original };
}
