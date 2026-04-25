# Testing the Skyland Website

## Architecture

- **Website**: Static HTML/CSS/JS hosted on Cloudflare Workers at `mc-skyland.com`
- **API**: Backend at `status.mc-skyland.com` handling auth (`/skyland-auth/login`, `/skyland-auth/register`) and checkout (`/skyland-checkout`)
- **Proxy**: `src/worker.js` is a Cloudflare Worker that proxies API routes server-side to avoid CORS issues. The frontend uses `API_BASE = ""` (same-origin) and the Worker forwards matching paths to `status.mc-skyland.com`.
- **Same Cloudflare Zone**: `mc-skyland.com` and `status.mc-skyland.com` are on the **same Cloudflare zone**. This is critical for proxy behavior — see "Same-Zone Routing" below.

## Preview Deployments

Cloudflare Workers builds deploy previews automatically on PRs. Preview URLs follow the pattern:
```
https://<branch-name>-skyland-website.simonb777730.workers.dev
```
Check the PR comments from `cloudflare-workers-and-pages[bot]` for the exact preview URL.

### Preview vs Production Zone Difference

Preview URLs (`*.workers.dev`) are on a **different Cloudflare zone** than production (`mc-skyland.com`). This means:
- **Same-zone routing issues do NOT manifest on preview** — they only appear on production
- A proxy fix might work perfectly on the preview but still fail on production
- Always test on production (`mc-skyland.com`) after merging to confirm same-zone fixes
- On preview, expect HTTP 401 for invalid credentials (proxy working); on production with a same-zone bug, expect HTTP 403

## How to Test Registration/Login

1. Navigate to the preview URL (or production at `mc-skyland.com`)
2. Click **Register** in the nav bar to open the registration modal
3. Fill in: Minecraft Username, Email, Password, Link Code (8 chars A-Z/0-9)
4. Click **Register** button
5. Expected outcomes:
   - If proxy is broken/missing: "Failed to fetch" (CORS error) or "Could not register (HTTP 403)" (static host or same-zone error)
   - If proxy works but credentials are invalid: "Could not register (HTTP 401)." — this proves the proxy is working
   - If proxy works and credentials are valid: "Account linked!" and modal closes

## Client-Side Validation

- Empty fields → "Enter username, email, password, and your /link code."
- Invalid email → "Enter a valid email address."
- Bad link code (not 8 chars A-Z/0-9) → "Link code must be 8 characters (A-Z / 0-9)."

## Key Files

- `src/worker.js` — Worker proxy that routes `/skyland-auth/*` and `/skyland-checkout` to `status.mc-skyland.com`
- `wrangler.jsonc` — Cloudflare Workers config with `main` entry point and `ASSETS` binding
- All `*.html` files — Each contains inline `<script>` with `API_BASE`, auth modal logic, and form handling

## Verifying the Proxy via CLI

```bash
# Should return 401 (real API response) if proxy works
curl -s -w "\nHTTP_CODE: %{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test","code":"ABCD1234"}' \
  https://<preview-url>/skyland-auth/register

# Should return server status JSON
curl -s https://<preview-url>/skyland-checkout
```

## Same-Zone Routing (Cloudflare)

When `mc-skyland.com` (the Worker) makes a subrequest to `status.mc-skyland.com` (same Cloudflare zone), Cloudflare may reject the request with **error 1003 ("Direct IP Access Not Allowed") / HTTP 403** if certain Cloudflare-internal headers are forwarded. Key points:

- **Do NOT copy all request headers** when proxying. Cloudflare adds internal headers (`CF-Connecting-IP`, `CF-Ray`, `CF-IPCountry`, `CF-Visitor`, `X-Forwarded-For`, etc.) that confuse same-zone routing.
- **Use clean headers**: Create a new `Headers()` object and only set essential headers like `Content-Type` and `Accept` if they exist on the original request.
- **Do NOT set `Content-Type` on GET requests** unless the original request had one — this can cause unexpected behavior.
- **Setting `Host` header alone is not sufficient** — the CF-internal headers must also be excluded.
- This issue does **not** appear on preview deployments (`*.workers.dev`) because they're on a different zone.

## Common Issues

- **"Failed to fetch"**: Usually a CORS issue. The API at `status.mc-skyland.com` does not support CORS preflight (OPTIONS returns 405). The Worker proxy in `src/worker.js` solves this by making server-side requests.
- **"HTTP 403" on production only**: Likely a same-zone routing issue. Check that `src/worker.js` is using clean headers (not copying all original request headers). See "Same-Zone Routing" section above.
- **"HTTP 403" on both preview and production**: The request might be hitting the static file host instead of the API. Check that `API_BASE` is `""` and the Worker proxy is deployed.
- **Cloudflare Workers build failures**: Check the Cloudflare dashboard logs (linked in PR comments from the bot). These might be config issues unrelated to code changes.

## Devin Secrets Needed

No secrets are needed for basic proxy/CORS testing. A valid Minecraft `/link` code from the game server would be needed to test a full successful registration end-to-end.
