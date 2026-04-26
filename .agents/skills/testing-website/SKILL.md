# Testing the Skyland Website

## Architecture

- **Website**: Static HTML/CSS/JS hosted on Cloudflare Workers at `mc-skyland.com`
- **API**: Backend at `status.mc-skyland.com` handling auth (`/skyland-auth/login`, `/skyland-auth/register`) and checkout (`/skyland-checkout`)
- **Proxy**: `src/worker.js` is a Cloudflare Worker that proxies API routes to `status.mc-skyland.com`. The frontend uses `API_BASE = "https://skyland-website.simonb777730.workers.dev"` (cross-origin to workers.dev) and the Worker forwards matching paths with CORS headers.
- **Same-zone limitation**: `mc-skyland.com` and `status.mc-skyland.com` are on the same Cloudflare zone (both resolve to the same IP). Workers cannot make subrequests to the same zone — this returns error 1003 / HTTP 403. The workaround is routing API requests through `workers.dev` (different zone).

## Preview Deployments

Cloudflare Workers builds deploy previews automatically on PRs. Preview URLs follow the pattern:
```
https://<branch-name>-skyland-website.simonb777730.workers.dev
```
Check the PR comments from `cloudflare-workers-and-pages[bot]` for the exact preview URL.

**Important**: Browser testing of API requests on preview URLs may not work because:
1. `API_BASE` in the HTML points to the production worker (`skyland-website.simonb777730.workers.dev`), which might not have the latest code pre-merge
2. The CORS `Access-Control-Allow-Origin` header is set to `https://mc-skyland.com`, not the preview origin

For pre-merge testing, use `curl` with `-H "Origin: https://mc-skyland.com"` against the preview worker URL directly. For full browser E2E testing, test on production (`mc-skyland.com`) after merge.

## How to Test Registration/Login

1. Navigate to production at `mc-skyland.com` (or preview URL for curl-based testing)
2. Click **Register** in the nav bar to open the registration modal
3. Fill in: Minecraft Username, Email, Password, Link Code (8 chars A-Z/0-9)
4. Click **Register** button
5. Expected outcomes:
   - If same-zone issue persists: "Could not register (HTTP 403)." — Cloudflare blocking same-zone subrequest
   - If CORS is broken: "Failed to fetch" — browser blocking cross-origin response
   - If proxy works but credentials are invalid: "Could not register (HTTP 401)." — proves proxy + CORS working
   - If proxy works and credentials are valid: "Account linked!" and modal closes

## Client-Side Validation

- Empty fields → "Enter username, email, password, and your /link code."
- Invalid email → "Enter a valid email address."
- Bad link code (not 8 chars A-Z/0-9) → "Link code must be 8 characters (A-Z / 0-9)."

## Key Files

- `src/worker.js` — Worker proxy that routes `/skyland-auth/*` and `/skyland-checkout` to `status.mc-skyland.com`, with CORS headers for `mc-skyland.com`
- `wrangler.jsonc` — Cloudflare Workers config with `main` entry point and `ASSETS` binding
- All `*.html` files — Each contains inline `<script>` with `API_BASE`, auth modal logic, and form handling

## Verifying the Proxy via CLI

```bash
# Test against preview worker (pre-merge) or production worker (post-merge)
TARGET="https://skyland-website.simonb777730.workers.dev"

# Preflight check — should return 204 with CORS headers
curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  -H "Origin: https://mc-skyland.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "$TARGET/skyland-auth/register"

# Registration test — should return 401 (real API response) if proxy works
curl -s -w "\nHTTP_CODE: %{http_code}" -X POST \
  -H "Origin: https://mc-skyland.com" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test","code":"ABCD1234"}' \
  "$TARGET/skyland-auth/register"

# Check CORS headers in response
curl -s -D - -o /dev/null -X POST \
  -H "Origin: https://mc-skyland.com" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test","code":"ABCD1234"}' \
  "$TARGET/skyland-auth/register" | grep -i access-control
```

## Common Issues

- **"Failed to fetch"**: CORS issue. Either the Worker's CORS headers are missing/wrong, or the browser origin doesn't match `ALLOWED_ORIGIN` in `src/worker.js`. On preview URLs, this is expected because the CORS origin is `https://mc-skyland.com`.
- **"HTTP 403"**: Cloudflare same-zone subrequest limitation. If `API_BASE` points to the same zone as the worker (e.g., same-origin or same custom domain), the proxy fetch will fail. The fix is routing through `workers.dev` (different zone).
- **"HTTP 401"**: This is the **expected working state** with test credentials. It proves the proxy successfully reached the real API server.
- **Cloudflare Workers build failures**: Check the Cloudflare dashboard logs (linked in PR comments from the bot). These might be config issues unrelated to code changes.
- **Preview browser tests fail but curl works**: This is expected — see the "Important" note under Preview Deployments. Use curl for pre-merge verification.

## Devin Secrets Needed

No secrets are needed for basic proxy/CORS testing. A valid Minecraft `/link` code from the game server would be needed to test a full successful registration end-to-end.
