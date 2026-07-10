# Publishing `<username>.proves.work` on Cloudflare

This folder makes the editor's "Publish" button actually go live at
`https://<username>.proves.work`. It's one Cloudflare Worker +
one KV namespace. Your existing app host (proves.work —
index.html, editor.html, css, js) is untouched; this Worker is only
routed on `/api/*` at that host, plus every `*.proves.work`
subdomain.

## AI features (résumé check + tailor-to-job-posting)

These run on **Cloudflare Workers AI**, using an open-source model
(`@cf/meta/llama-3.1-8b-instruct`), not a third-party API. There's
nothing to sign up for beyond your existing Cloudflare account:

- No API key to create or store.
- Free tier: 10,000 "neurons" per day (roughly a few hundred requests/day
  for a model this size — plenty for personal/small-scale use). See
  current limits at https://developers.cloudflare.com/workers-ai/platform/pricing/
- Already wired up via the `ai` binding in `wrangler.jsonc` — nothing
  extra to configure. Just deploy (`npx wrangler deploy`) and the
  `/api/ai/resume-check` and `/api/ai/tailor-resume` routes are live.
- If the free daily quota is hit, or the request fails for any other
  reason, the editor automatically falls back to a local, non-AI
  heuristic check so the feature never just breaks — it just gets less
  precise until quota resets.
- Résumé/job-posting text sent to these routes is used only for that
  one request and is never written to KV or logged.

## Why a Worker (and not Cloudflare Pages / Custom Domains)

- Cloudflare **Custom Domains do not support wildcard DNS records** —
  you can't point `*.proves.work` at a Custom Domain.
- **Workers Routes** *do* support wildcards (`*.proves.work/*`), and a
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
   Cloudflare dashboard → the `proves.work` zone → DNS:
   - Type: `A`
   - Name: `*` (so it covers `<anything>.proves.work`)
   - IPv4 address: `192.0.2.1` (a placeholder — traffic never actually
     reaches this IP, the Worker intercepts it first)
   - Proxy status: **Proxied** (orange cloud) — this is required

   Your existing `proves.work` record (wherever the editor is
   hosted today — Pages, etc.) stays exactly as it is.

4. **Deploy the Worker:**
   ```
   npx wrangler deploy
   ```
   Wrangler reads the two `routes` entries from `wrangler.jsonc` and
   attaches them to this Worker automatically — no separate dashboard
   step needed.

5. **Verify:**
   - `https://anything-not-published.proves.work` → should show
     the "hasn't published a portfolio yet" page.
   - From the editor, click **Publish**, pick a username, and confirm
     `https://<username>.proves.work` loads your portfolio
     within a few seconds.

## How ownership works (and its current limitation)

Usernames are now tied to a **Google account** instead of a copy-paste
publish key. The editor uses Google Identity Services to get a signed
ID token from the person's browser, sends it along with the publish
request, and this Worker verifies that token server-side (via Google's
`tokeninfo` endpoint) before trusting the email it contains. A username
already owned by one verified email can only be republished/updated by
signing in with that same Google account again — from any browser or
device.

Publishing while signed out still works (`googleCredential` omitted),
same as before — first-come, first-served, with no way to reclaim or
update it later except by publishing again from a browser that still
considers it "already yours" via the locally-saved username. If you
want anonymous publishes to be updatable too, you'd need to bring back
some kind of per-browser secret for that path specifically; as shipped,
signing in with Google is the only durable way to keep publish rights
across devices.

**Before this works, you must:**
1. Create an OAuth 2.0 Client ID (type "Web application") in
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   with your editor's origin(s) added under "Authorized JavaScript origins."
2. Paste that Client ID into **both**:
   - `GOOGLE_CLIENT_ID` in `editor.js`
   - `GOOGLE_CLIENT_ID` in `worker/src/index.js`
   (they must match exactly — the Worker checks the token's `aud` claim
   against this value.)

## Tightening CORS later

`CORS_HEADERS` in `worker/src/index.js` currently allows any origin
(`*`) so this works regardless of exactly how/where you host the
editor while you're setting this up. Once the editor is confirmed live
on `https://proves.work`, change that to
`'access-control-allow-origin': 'https://proves.work'`.

## Local testing

```
npx wrangler dev
```
Wrangler will use a local, on-disk copy of the KV namespace (not your
real production data) unless you pass `--remote`.
