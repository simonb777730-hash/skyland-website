const API_ORIGIN = "https://status.mc-skyland.com";

const API_PREFIXES = ["/skyland-auth/", "/skyland-checkout"];

function isApiPath(pathname) {
  return API_PREFIXES.some((p) => pathname.startsWith(p));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isApiPath(url.pathname)) {
      const apiUrl = new URL(url.pathname + url.search, API_ORIGIN);
      const headers = new Headers();
      const ct = request.headers.get("Content-Type");
      if (ct) headers.set("Content-Type", ct);
      const accept = request.headers.get("Accept");
      if (accept) headers.set("Accept", accept);
      return fetch(apiUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
