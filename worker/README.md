# Publishing `<username>.proves.work` on Cloudflare

This folder makes free subdomains work: one Cloudflare Worker + one
KV namespace. Your existing app host (proves.work — index.html, css,
js) is untouched; this Worker is only routed on `/api/*` at that
host, plus every `*.proves.work` subdomain.

There's no portfolio builder and no sign-up. Claiming a name is just:
pick a username, tell us where it should point, submit — then you (the
site owner) approve it by hand at `/admin`.

## Two ways to claim a name

**No-code**: username + name/email + a URL (Linktree, Carrd, a resume
PDF host, whatever). `username.proves.work` proxies to that URL.

**Coders** (like [is-a.dev](https://www.is-a.dev)): username + a
**public** GitHub repo URL + the URL it deploys to (GitHub Pages,
Vercel, Netlify, etc). The Worker checks the repo is public via the
GitHub API before the claim is even submitted for review, and the
front end shows an "open source" badge linking back to the repo.
Unlike is-a.dev, there's no PR/YAML-file workflow — it's a form, and
you approve claims from `/admin` instead of merging pull requests.
Point your own domain's DNS/deploy however you like on your repo's
side; this system only needs the final URL it serves at.

## Why a Worker (and not Cloudflare Pages / Custom Domains)

- Cloudflare **Custom Domains do not support wildcard DNS records** —
  you can't point `*.proves.work` at a Custom Domain.
- **Workers Routes** *do* support wildcards (`*.proves.work/*`), and a
  Worker can inspect the `Host` header at request time to decide which
  claimed name to serve. One Worker, one route, unlimited usernames —
  no per-user DNS record or per-user deploy.
- Storage is **Workers KV**: a global key-value store, a natural fit
  for "given a username, return where to proxy."

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
   This prints an `id`. Paste it into `wrangler.jsonc`, replacing the
   existing `id` value.

3. **Add a wildcard DNS record.** Cloudflare requires a DNS record to
   exist for any hostname a Route/Worker will intercept — even though
   the Worker itself serves the response, not an origin server. In the
   Cloudflare dashboard → the `proves.work` zone → DNS:
   - Type: `A`
   - Name: `*` (so it covers `<anything>.proves.work`)
   - IPv4 address: `192.0.2.1` (a placeholder — traffic never actually
     reaches this IP, the Worker intercepts it first)
   - Proxy status: **Proxied** (orange cloud) — this is required

   Your existing `proves.work` record (wherever the marketing page is
   hosted today — Pages, etc.) stays exactly as it is.

4. **Deploy the Worker:**
   ```
   npx wrangler deploy
   ```
   Wrangler reads the two `routes` entries from `wrangler.jsonc` and
   attaches them to this Worker automatically — no separate dashboard
   step needed.

5. **Verify:**
   - `https://anything-not-claimed.proves.work` → should show the
     "hasn't claimed this yet" page.
   - Submit a claim from the front page, approve it at `/admin`, and
     confirm `https://<username>.proves.work` proxies correctly.

## Admin access

`/admin` is gated by Google sign-in, checked server-side against a
fixed allowlist (`ADMIN_EMAILS` in `worker/src/index.js` and
`GOOGLE_CLIENT_ID` in `admin.js` — must match exactly). This isn't a
user-facing sign-up system, just how you personally authenticate to
approve claims, confirm donation reference numbers, and tag entries
into the showcase.

**Before this works, you must:**
1. Create an OAuth 2.0 Client ID (type "Web application") in
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   with your `/admin` page's origin added under "Authorized JavaScript
   origins."
2. Paste that Client ID into **both**:
   - `GOOGLE_CLIENT_ID` in `admin.js`
   - `GOOGLE_CLIENT_ID` in `worker/src/index.js`

## Donations & showcase

Donations aren't processed automatically — there's no payment API
wired in. The front end shows a QR code + tier list; the donor pays on
their own banking/e-wallet app and submits the reference number plus
the subdomain they want boosted through the contact form. You confirm
the reference number by hand at `/admin` (against your own
transaction history) and can tag that subdomain into the public
showcase in the same step.

## Tightening CORS later

`CORS_HEADERS` in `worker/src/index.js` currently allows any origin
(`*`) so this works regardless of exactly how/where you host the front
end while you're setting this up. Once it's confirmed live on
`https://proves.work`, change that to
`'access-control-allow-origin': 'https://proves.work'`.

## Local testing

```
npx wrangler dev
```
Wrangler will use a local, on-disk copy of the KV namespace (not your
real production data) unless you pass `--remote`.
