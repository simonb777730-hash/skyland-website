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
      const apiRequest = new Request(apiUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      return fetch(apiRequest);
    }

    return env.ASSETS.fetch(request);
  },
};
