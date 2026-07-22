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

## Running on Cloudflare's free tier

This whole thing currently runs on Cloudflare's **free plan** — one
Worker, one wildcard route (`*.proves.work/*`), one KV namespace. That's
intentional: it's what makes "free subdomains, forever" actually
sustainable to promise instead of a marketing line.

A few things worth knowing about how that free tier holds up:

- **Registered subdomains cost nothing by themselves.** Whether 10 or
  10,000 names are claimed, it's still one wildcard DNS record and one
  KV namespace. The number of names on file doesn't eat into any limit.
- **What actually consumes the free tier is traffic**, not headcount:
  - **Workers requests** — 100,000/day, shared across every pageview to
    every `*.proves.work` site plus every `/api/*` call.
  - **KV reads** — 100,000/day. Every visit does one KV lookup to find
    where to proxy.
  - **KV writes** — 1,000/day, the tightest limit. New claims, status
    changes, donation confirms, and the per-IP rate limiter on the
    claim/contact forms all write here. (The visit counter is
    intentionally sampled at ~10% specifically to stay clear of this.)
  - **KV storage** — 1 GB. Thousands of small site records barely
    register against this.
- **In practice, this project runs out of free-tier headroom on
  *traffic*, not on how many people have claimed a name.** A steady flow
  of a few hundred combined daily visits across all subdomains is easy
  to absorb; real, sustained traffic in the tens of thousands of
  requests/day per day starts pushing toward the Workers Paid plan
  (~$5/mo base), mainly for CPU time and higher KV write throughput.

**If usage ever does outgrow the free tier**, the project doesn't
disappear — it just needs the Workers Paid plan turned on, which is a
Cloudflare dashboard toggle, not a rebuild. The code and architecture
here don't change either way.

## Keeping this hosted

If this project is useful to you and
you'd like to help keep it running (and eventually clear of free-tier
limits), donations go toward exactly that: **paying for Cloudflare's
Workers Paid plan and any KV overage** as traffic grows, rather than
anything else.

Ways to help:

- **Donate** via the QR code on the [`/donate`](https://proves.work/#donate)
  section of the site. Every tier gets a pixel-heart tag (Pulse, Beat,
  Blood, Soul, Breath) and an optional boost into the public showcase.
- **Point people here** if a free, no-nonsense place to prove their work
  is useful to them — more legitimate use is the best case for keeping
  this funded.
- **Run your own copy** if you'd rather not depend on this instance at
  all — it's open source for exactly that reason, and it'll happily run
  on Cloudflare's free tier for a smaller community the same way this
  one does.

# Human here

Yeah sorry for the AI post above. I didn't have enough time
(it's my enrollment period now). Yes, behind this idea is a human.
I'm sorry for using AI, even though I am aware of the environmental effects.
Everything I'll make it AI (well, ito lang muna) will be an open source project, 
and hopefully my ideas can hold on until I learn how to code on my own. Give or take 5 years.
Your donations will tremendously help.

Also, this way of creating projects isn't sustainable for me too.
I fear I'm becoming even more stupid than when I first started (haha).
But I can't wait for my skills to catch up with my intention behind
"proves.work" ---> a personalized subdomain that's straightforward,
not overtly branded, and can help you face your virtual, professional life
with a great domain. 

Just to clarify again: I don't know how to code so I won't know how to fix
specific bugs unless I use Claude's free tier. It's why I made this one
open-source; I don't want too assure anyone that they will be able to have a
well-maintained experience (especially when this only uses Cloudflare's free tier too)
so yeah, just treat this like a better "redirect link."

At least, this is much better than having a "bit.ly" sa resume, no?

That's all po. Thanks again?
