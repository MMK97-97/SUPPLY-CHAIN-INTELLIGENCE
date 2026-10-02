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
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function chooseEndpoint(entries) {
  const endpoints = entries
    .map(entry => ({ ...entry, name: cleanApiName(entry.name) }))
    .filter(entry => entry.name);
  return endpoints.find(entry => entry.name === PREFERRED_API)
    || endpoints.find(entry => /(?:website.*chat|chat.*website)/i.test(entry.name))
    || endpoints.find(entry => /chat/i.test(entry.name))
    || null;
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

  try {
    const response = await fetchWithTimeout(`${SPACE_ORIGIN}/config`, {
      headers: { accept: "application/json" },
      cf: { cacheTtl: 0, cacheEverything: false }
    }, 20_000);
    if (response.ok) {
      const config = await response.json();
      const dependencies = Array.isArray(config?.dependencies)
        ? config.dependencies.map(item => ({ name: item?.api_name, metadata: item }))
        : [];
      const endpoint = chooseEndpoint(dependencies);
      if (endpoint) return { type: "gradio", endpoint: endpoint.name, metadata: endpoint.metadata || null };
      issues.push("The Space does not publish a chat API");
    } else {
      issues.push(`Space configuration returned HTTP ${response.status}`);
    }
  } catch (error) {
    issues.push(error?.name === "AbortError" ? "Space configuration timed out" : "Space configuration was unreachable");
  }

  throw new Error(issues.filter(Boolean).join("; ") || "Supply AI is unavailable");
}

function parameterValue(parameter, payload, index) {
  const name = String(parameter?.parameter_name || parameter?.label || "").toLowerCase();
  if (/message|question|prompt|query|text/.test(name)) return payload.message;
  if (/mode|persona/.test(name)) return payload.mode || "Auto";
  if (/history|conversation/.test(name)) return payload.history || [];
  if (/context|evidence|data/.test(name)) return payload.context || "{}";
  return index === 0 ? payload : null;
}

function buildGradioData(connection, payload) {
  const parameters = connection?.metadata?.parameters;
  if (!Array.isArray(parameters) || parameters.length <= 1) return [payload];
  return parameters.map((parameter, index) => parameterValue(parameter, payload, index));
}

function parseGradioStream(streamText) {
  const lines = String(streamText || "").split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const decoded = JSON.parse(lines[index]);
      const value = Array.isArray(decoded) ? decoded[0] : decoded;
      if (value && typeof value === "object") return value;
      if (typeof value === "string" && value.trim()) return { ok: true, answer: value.trim() };
    } catch (_) {}
  }
  throw new Error("Supply AI returned an unreadable response");
}

async function callSpace(connection, payload) {
  const endpoint = encodeURIComponent(cleanApiName(connection.endpoint));
  const callUrl = `${SPACE_ORIGIN}/gradio_api/call/${endpoint}`;
  const queued = await fetchWithTimeout(callUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ data: buildGradioData(connection, payload) })
  });
  if (!queued.ok) throw new Error(`Supply AI request returned HTTP ${queued.status}`);
  const queue = await queued.json();
  if (!queue?.event_id) throw new Error("Supply AI did not create a response event");

  const resultResponse = await fetchWithTimeout(`${callUrl}/${encodeURIComponent(queue.event_id)}`, {
    headers: { accept: "text/event-stream" }
  });
  if (!resultResponse.ok) throw new Error(`Supply AI result returned HTTP ${resultResponse.status}`);
  const result = parseGradioStream(await resultResponse.text());
  if (result?.ok === false) throw new Error(String(result.error || "Supply AI could not complete the request"));
  const answer = String(result?.answer || result?.response || result?.text || "").trim();
  if (!answer) throw new Error("Supply AI returned an empty response");
  return answer.slice(0, 8_000);
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
  let response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || request.method !== "GET") return response;

  const url = new URL(request.url);
  const lastPart = url.pathname.split("/").pop() || "";
  if (lastPart.includes(".")) return response;
  url.pathname = `${url.pathname.replace(/\/$/, "") || "/index"}.html`;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/supply-ai/")) return handleSupplyApi(request, pathname);
    return serveAsset(request, env);
  }
};
