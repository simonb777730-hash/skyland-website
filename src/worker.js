const API_ORIGIN = "https://status.mc-skyland.com";

const API_PREFIXES = ["/skyland-auth/", "/skyland-checkout"];

const ALLOWED_ORIGIN = "https://mc-skyland.com";

function isApiPath(pathname) {
  return API_PREFIXES.some((p) => pathname.startsWith(p));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isApiPath(url.pathname)) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      const apiUrl = new URL(url.pathname + url.search, API_ORIGIN);
      const headers = new Headers();
      const ct = request.headers.get("Content-Type");
      if (ct) headers.set("Content-Type", ct);
      const accept = request.headers.get("Accept");
      if (accept) headers.set("Accept", accept);
      const response = await fetch(apiUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
      });

      const newResponse = new Response(response.body, response);
      for (const [key, value] of Object.entries(corsHeaders())) {
        newResponse.headers.set(key, value);
      }
      return newResponse;
    }

    return env.ASSETS.fetch(request);
  },
};
