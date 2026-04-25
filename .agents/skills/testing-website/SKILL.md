# Testing the Skyland Website

## Architecture

- **Website**: Static HTML/CSS/JS hosted on Cloudflare Workers at `mc-skyland.com`
- **API**: Backend at `status.mc-skyland.com` handling auth (`/skyland-auth/login`, `/skyland-auth/register`) and checkout (`/skyland-checkout`)
- **Proxy**: `src/worker.js` is a Cloudflare Worker that proxies API routes server-side to avoid CORS issues. The frontend uses `API_BASE = ""` (same-origin) and the Worker forwards matching paths to `status.mc-skyland.com`.

## Preview Deployments

Cloudflare Workers builds deploy previews automatically on PRs. Preview URLs follow the pattern:
```
https://<branch-name>-skyland-website.simonb777730.workers.dev
```
Check the PR comments from `cloudflare-workers-and-pages[bot]` for the exact preview URL.

## How to Test Registration/Login

1. Navigate to the preview URL (or production at `mc-skyland.com`)
2. Click **Register** in the nav bar to open the registration modal
3. Fill in: Minecraft Username, Email, Password, Link Code (8 chars A-Z/0-9)
4. Click **Register** button
5. Expected outcomes:
   - If proxy is broken/missing: "Failed to fetch" (CORS error) or "Could not register (HTTP 403)" (static host or wrong Host header)
   - If proxy works but credentials are invalid: "Could not register (HTTP 401)." — this proves the proxy is working
   - If proxy works and credentials are valid: "Account linked!" and modal closes

## Client-Side Validation

- Empty fields → "Enter username, email, password, and your /link code."
- Invalid email → "Enter a valid email address."
- Bad link code (not 8 chars A-Z/0-9) → "Link code must be 8 characters (A-Z / 0-9)."

## Key Files

- `src/worker.js` — Worker proxy that routes `/skyland-auth/*` and `/skyland-checkout` to `status.mc-skyland.com`. Must set `Host: status.mc-skyland.com` header explicitly on proxied requests.
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

## Common Issues

- **"Failed to fetch"**: Usually a CORS issue. The API at `status.mc-skyland.com` does not support CORS preflight (OPTIONS returns 405). The Worker proxy in `src/worker.js` solves this by making server-side requests.
- **"HTTP 403" with Cloudflare error code 1003**: The Worker proxy might be forwarding the original `Host` header (e.g. `mc-skyland.com`) instead of setting `Host: status.mc-skyland.com`. When proxying to a different Cloudflare domain, the `Host` header must match the target domain, otherwise Cloudflare rejects it with "Direct IP Access Not Allowed". Fix: use `headers.set("Host", "status.mc-skyland.com")` in the proxy.
- **"HTTP 403" (other)**: The request might be hitting the static file host instead of the API. Check that `API_BASE` is `""` and the Worker proxy is deployed.
- **Cloudflare Workers build failures**: Check the Cloudflare dashboard logs (linked in PR comments from the bot). These might be config issues unrelated to code changes.

## Devin Secrets Needed

No secrets are needed for basic proxy/CORS testing. A valid Minecraft `/link` code from the game server would be needed to test a full successful registration end-to-end.
