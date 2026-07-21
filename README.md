# proves.work

**Free `your-name.proves.work` subdomains**

The whole point of this project is to make it stupidly easy to *prove your
work*: point a free subdomain at a résumé, a link-in-bio page, or a live
project you shipped, and have a real human approve it within a day. That's
it.

It exists as an alternative to paying for a domain (or squatting on a free
one you don't control) just to have somewhere legitimate to point people
when you say "here's proof I can do this."

## How it works

1. **Pick a name** — 3–30 lowercase letters, numbers, or hyphens.
2. **Point it somewhere** — a plain URL (no-code), or a public GitHub repo +
   its deployed URL (coders), the same idea as
   [is-a.dev](https://www.is-a.dev) but without a PR/YAML workflow.
3. **It gets reviewed** — every claim is checked by a human at `/admin`
   before it goes live, usually within a day.
4. **It's live** — `yourname.proves.work` proxies straight to your page.
   Free, forever. Well, not really. Until I run out of funds.

## Supporting the project

Donations aren't required for anything — the subdomains stay free either
way — but they help keep the project running, and each donation tier comes
with its own pixel-heart tag (Pulse, Beat, Blood, Soul, Breath) that can
boost your subdomain into the public showcase, grouped by tag with larger
donors surfaced first.

## What's in this repo

| Path | What it is |
|---|---|
| `index.html`, `home.js`, `home.css` | The public site: claim form, donate form, showcase, contact |
| `admin.html`, `admin.js`, `admin.css` | The private review dashboard (Google sign-in gated) |
| `showcase.css`, `styles.css`, `dazed.css`, `dazed-dark.css` | Shared styling |
| `worker/` | The Cloudflare Worker + KV storage that actually routes `*.proves.work` and powers the `/api/*` endpoints — see `worker/README.md` for setup |

This project is open source specifically so its purpose can't quietly
change: anyone can see exactly how claims are handled, run their own copy,
or hold this instance accountable to what it says it does.
