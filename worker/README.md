# Publishing `<username>.resport.snylum.com` on Cloudflare

This folder makes the editor's "Publish" button actually go live at
`https://<username>.resport.snylum.com`. It's one Cloudflare Worker +
one KV namespace. Your existing app host (resport.snylum.com —
index.html, editor.html, css, js) is untouched; this Worker is only
routed on `/api/*` at that host, plus every `*.resport.snylum.com`
subdomain.

## Why a Worker (and not Cloudflare Pages / Custom Domains)

- Cloudflare **Custom Domains do not support wildcard DNS records** —
  you can't point `*.resport.snylum.com` at a Custom Domain.
- **Workers Routes** *do* support wildcards (`*.resport.snylum.com/*`), and a
  Worker can inspect the `Host` header at request time to decide which
  published site to serve. That's exactly what's needed here: one
  Worker, one route, unlimited usernames — no per-user DNS record or
  per-user deploy.
- Storage is **Workers KV**: a global key-value store that's a natural
  fit for "given a username, return the page to serve."

## One-time setup

1. **Install Wrangler** (if you haven't already):
   ```
   npm install -g wrangler
   wrangler login
   ```

2. **Create the KV namespace:**
   ```
   cd worker
   npx wrangler kv namespace create SITES
   ```
   This prints an `id`. Paste it into `wrangler.jsonc`, replacing
   `<REPLACE_WITH_YOUR_KV_NAMESPACE_ID>`.

3. **Add a wildcard DNS record.** Cloudflare requires a DNS record to
   exist for any hostname a Route/Worker will intercept — even though
   the Worker itself serves the response, not an origin server. In the
   Cloudflare dashboard → the `snylum.com` zone → DNS:
   - Type: `A`
   - Name: `*.resport` (so it covers `<anything>.resport.snylum.com`,
     without touching wildcards on the bare `snylum.com` root)
   - IPv4 address: `192.0.2.1` (a placeholder — traffic never actually
     reaches this IP, the Worker intercepts it first)
   - Proxy status: **Proxied** (orange cloud) — this is required

   Your existing `resport.snylum.com` record (wherever the editor is
   hosted today — Pages, etc.) stays exactly as it is.

4. **Deploy the Worker:**
   ```
   npx wrangler deploy
   ```
   Wrangler reads the two `routes` entries from `wrangler.jsonc` and
   attaches them to this Worker automatically — no separate dashboard
   step needed.

5. **Verify:**
   - `https://anything-not-published.resport.snylum.com` → should show
     the "hasn't published a portfolio yet" page.
   - From the editor, click **Publish**, pick a username, and confirm
     `https://<username>.resport.snylum.com` loads your portfolio
     within a few seconds.

## How ownership works (and its current limitation)

There's no login system in this app yet, so usernames are claimed on a
first-come basis using a random `token` the editor generates once and
stores in the visitor's browser (`localStorage`). Publishing again
under the same username from the same browser is allowed (token
matches); publishing from a different browser to a taken username is
rejected with "already taken."

This is enough to stop accidental squatting between different visitors,
but it is **not real authentication** — clearing browser storage means
losing the ability to update that username. If/when you add real user
accounts, swap the `token` check in `worker/src/index.js` for a
verified session/user ID instead.

## Tightening CORS later

`CORS_HEADERS` in `worker/src/index.js` currently allows any origin
(`*`) so this works regardless of exactly how/where you host the
editor while you're setting this up. Once the editor is confirmed live
on `https://resport.snylum.com`, change that to
`'access-control-allow-origin': 'https://resport.snylum.com'`.

## Local testing

```
npx wrangler dev
```
Wrangler will use a local, on-disk copy of the KV namespace (not your
real production data) unless you pass `--remote`.
