const SPACE_ORIGIN = "https://mmk97-supply-ai-chain-hub.hf.space";
const PREFERRED_API = "website_chat";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const cleanApiName = value => String(value || "").trim().replace(/^\/+/, "");

async function fetchWithTimeout(url, options = {}, timeout = 65_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Keep the timeout active while the queued response body is received.
    const body = await response.arrayBuffer();
    if (body.byteLength > 262144) throw new Error("Supply AI response exceeded the transport limit");
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    if (controller.signal.aborted) throw new DOMException("Supply AI request timed out", "AbortError");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function chooseEndpoint(entries) {
  const endpoints = entries
    .map(entry => ({ ...entry, name: cleanApiName(entry.name) }))
    .filter(entry => entry.name);
  return endpoints.find(entry => entry.name === PREFERRED_API &&
    entry.metadata?.parameters?.length === 1 && entry.metadata.parameters[0].component === "Json" &&
    entry.metadata?.returns?.length === 1 && entry.metadata.returns[0].component === "Json") || null;
}

async function discoverSpace() {
  const issues = [];

  try {
    const response = await fetchWithTimeout(`${SPACE_ORIGIN}/gradio_api/info`, {
      headers: { accept: "application/json" },
      cf: { cacheTtl: 0, cacheEverything: false }
    }, 20_000);
    if (response.ok) {
      const info = await response.json();
      const named = info?.named_endpoints && typeof info.named_endpoints === "object"
        ? Object.entries(info.named_endpoints).map(([name, metadata]) => ({ name, metadata }))
        : [];
      const endpoint = chooseEndpoint(named);
      if (endpoint) return { type: "gradio", endpoint: endpoint.name, metadata: endpoint.metadata || null };
      issues.push("No published chat endpoint was found in the Gradio API description");
    } else {
      issues.push(`Gradio API description returned HTTP ${response.status}`);
    }
  } catch (error) {
    issues.push(error?.name === "AbortError" ? "Gradio API description timed out" : "Gradio API description was unreachable");
  }


  throw new Error(issues.filter(Boolean).join("; ") || "Supply AI is unavailable");
}

function parseGradioStream(streamText) {
  for (const frame of String(streamText || "").replace(/\r\n/g, "\n").split("\n\n").slice(0, -1)) {
    const lines = frame.split("\n"), event = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
    if (event === "error") throw new Error("Supply AI could not complete the queued request");
    if (event !== "complete") continue;
    const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
    const decoded = JSON.parse(data);
    if (!Array.isArray(decoded) || decoded.length !== 1) throw new Error("Supply AI returned an incompatible response");
    const value = decoded[0];
    if (!value || value.ok !== true || typeof value.answer !== "string" || !value.answer.trim() ||
        /^enter a message\.?$/i.test(value.answer.trim())) throw new Error("Supply AI returned no usable analysis");
    return value;
  }
  throw new Error("Supply AI returned an unreadable response");
}

async function callSpace(connection, payload) {
  const endpoint = encodeURIComponent(cleanApiName(connection.endpoint));
  const callUrl = `${SPACE_ORIGIN}/gradio_api/call/${endpoint}`;
  const queued = await fetchWithTimeout(callUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ data: [payload] })
  });
  if (!queued.ok) throw new Error(`Supply AI request returned HTTP ${queued.status}`);
  const queue = await queued.json();
  if (typeof queue?.event_id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(queue.event_id)) throw new Error("Supply AI did not create a valid response event");

  const resultResponse = await fetchWithTimeout(`${callUrl}/${encodeURIComponent(queue.event_id)}`, {
    headers: { accept: "text/event-stream" }
  }, payload.mode === "Deep" ? 300000 : payload.mode === "Fast" ? 120000 : 180000);
  if (!resultResponse.ok) throw new Error(`Supply AI result returned HTTP ${resultResponse.status}`);
  const result = parseGradioStream(await resultResponse.text());
  if (result?.ok === false) throw new Error(String(result.error || "Supply AI could not complete the request"));
  const answer = String(result?.answer || result?.response || result?.text || "").trim();
  if (!answer) throw new Error("Supply AI returned an empty response");
  if (answer.length > 48000) throw new Error("Supply AI response exceeded the website output limit");
  return answer;
}

async function handleSupplyApi(request, pathname) {
  if (pathname === "/api/supply-ai/status" && request.method === "GET") {
    try {
      const connection = await discoverSpace();
      return json({ ok: true, state: "ready", type: "proxy", endpoint: connection.endpoint });
    } catch (error) {
      return json({ ok: false, state: "offline", error: String(error?.message || "Supply AI is unavailable") }, 503);
    }
  }

  if (pathname === "/api/supply-ai/chat" && request.method === "POST") {
    try {
      const body = await request.json();
      const payload = body?.payload;
      if (!payload || typeof payload !== "object" || !String(payload.message || "").trim()) {
        return json({ ok: false, error: "A valid AI request is required" }, 400);
      }
      const connection = await discoverSpace();
      const answer = await callSpace(connection, payload);
      return json({ ok: true, answer, endpoint: connection.endpoint });
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Supply AI timed out while processing the request"
        : String(error?.message || "Supply AI is unavailable");
      return json({ ok: false, error: message }, 503);
    }
  }

  return json({ ok: false, error: "Not found" }, 404);
}

async function serveAsset(request, env) {
  const original = new URL(request.url);
  let response = await env.ASSETS.fetch(request);
  if (response.status === 404 && ["GET", "HEAD"].includes(request.method)) {
    const lastPart = original.pathname.split("/").pop() || "";
    if (!lastPart.includes(".")) {
      const url = new URL(original);
      // Both nested directories and extensionless pages keep their deep links.
      url.pathname = original.pathname.endsWith("/")
        ? original.pathname + "index.html"
        : original.pathname + ".html";
      response = await env.ASSETS.fetch(new Request(url, request));
      if (response.status === 404 && !original.pathname.endsWith("/")) {
        url.pathname = original.pathname + "/index.html";
        response = await env.ASSETS.fetch(new Request(url, request));
      }
    }
  }
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const readable = ["GET", "HEAD"].includes(request.method);
  const privateResponse = headers.has("set-cookie") || request.headers.has("authorization") ||
    /(?:private|no-store)/i.test(headers.get("cache-control") || "") || headers.has("vary") && /cookie|authorization/i.test(headers.get("vary"));
  if (readable && (response.status === 200 || response.status === 304) && !privateResponse && !request.headers.has("range")) {
    const immutable = /^\/assets\/.+\.[a-f0-9]{12}\.(?:js|css)$/.test(original.pathname) ||
      /^\/assets\/vendor\/(?:supabase|d3|sheetjs|marked|purify)-\d+\.\d+\.\d+\.min\.js$/.test(original.pathname);
    const imageOrFont = /^\/assets\/.+\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/.test(original.pathname);
    headers.set("Cache-Control", immutable ? "public, max-age=31536000, immutable" : imageOrFont ? "public, max-age=86400" : "public, max-age=0, must-revalidate");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/supply-ai/")) return handleSupplyApi(request, pathname);
    return serveAsset(request, env);
  }
};
