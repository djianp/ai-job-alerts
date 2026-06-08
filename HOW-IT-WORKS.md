# How It Works — The Story Behind AI Job Alerts

> A plain-language tour of what this project does, how it's built, why it's built that
> way, and — most importantly — what it can teach you. If the `README` is the spec
> sheet, this is the director's commentary: the decisions, the dead ends, the bugs that
> bit us, and the way of thinking that turns a pile of API calls into something that
> quietly works every single morning.

---

## Table of Contents

1. [The Problem (or: why a robot does my job hunting)](#1-the-problem)
2. [The 30,000-Foot View](#2-the-30000-foot-view)
3. [A Walk Down the Assembly Line](#3-a-walk-down-the-assembly-line)
4. [How the Code Is Actually Organized](#4-how-the-code-is-actually-organized)
5. [The Toolbox (and why each tool earned its place)](#5-the-toolbox)
6. [War Stories: Every Bug We Hit and How We Killed It](#6-war-stories)
7. [How Good Engineers Think (the part that transfers)](#7-how-good-engineers-think)
8. [Pitfalls & How to Dodge Them Next Time](#8-pitfalls--how-to-dodge-them)
9. [What's Still Broken (being honest)](#9-whats-still-broken)
10. [The One-Paragraph Version](#10-the-one-paragraph-version)

---

## 1. The Problem

Imagine you're hunting for a very specific kind of job: **senior AI Product Management roles**, ideally in Europe or remote-friendly. These roles are rare. They're scattered across maybe a hundred companies. And the good ones get hundreds of applicants within days of posting.

So the naive approach is: every morning, open 96 career pages, scan each one for new postings, mentally filter out the 200 engineering and sales roles to find the 1 product role, check whether you've already seen it, and decide whether it's worth your time.

That's not a job hunt. That's a part-time job *about* job hunting. Nobody sustains it past week two.

> 💡 **The reframe:** The interesting insight here is that this is not really a "job hunting" problem — it's a **data pipeline** problem wearing a job-hunting costume. You have many messy sources, you need to extract a signal, filter it, rank it, remember what you've seen, and get notified about what's new. Once you see it that way, the whole solution falls out.

So instead of doing it by hand, we built a tireless robot intern. Every day at 8am Paris time, it visits all 96 companies, reads every open role, throws away the ~99% that don't matter, ranks what's left by how relevant it is to *you*, checks it against a memory of everything it's seen before, and sends a Slack message with only the genuinely new, genuinely relevant roles — complete with apply links.

You wake up, glance at Slack, and either apply or ignore. The grind is gone.

---

## 2. The 30,000-Foot View

The whole system is one **n8n workflow** — think of n8n as a visual flowchart where each box ("node") does one small job and hands its output to the next box. Our flowchart has about **two dozen boxes (24 nodes)**, and they form a straight-ish line from "wake up" to "send Slack message."

> 🏭 **Analogy — the assembly line.** Picture a factory conveyor belt. Raw material goes in one end (thousands of job postings). It moves from station to station — one station bolts on a part, the next paints it, the next inspects it, the next boxes it up. Nobody station does everything; each does one thing well and passes the work along. Our pipeline is exactly this, except the "material" is job data and the "stations" are little JavaScript functions.

Here's the belt, end to end, grouped into four phases:

```
   ⏰ TRIGGER          📥 FETCH                 🔍 FILTER & SCORE       📤 DEDUPE & ALERT
   ─────────          ────────                 ────────────────       ────────────────
   8am daily     →    Pull ~13,000 jobs   →    Keep ~PM roles,   →    Compare to memory,
   (or manual)        from 96 companies        rank them               alert only what's NEW
```

In one sentence: **Extract → Transform → Load → Notify.** If you've ever heard the term "ETL pipeline," congratulations, you now understand the backbone of this project and roughly half of all data engineering.

Two numbers shape *everything* about how this is built, so keep them in your back pocket:

- **Every node must finish in under 60 seconds.** (n8n Cloud kills any code that runs longer.)
- **The whole run must stay under ~38 MB of memory.**

Almost every "weird" decision in this codebase exists because of one of those two limits. They're the gravity this system is built in. We'll come back to them constantly.

---

## 3. A Walk Down the Assembly Line

Let's follow a single morning's run from start to finish. I'll name the actual files so you can match the story to the code in [`nodes/`](nodes/).

### Station 1 — The alarm clock (`Schedule Trigger`)

A cron schedule (`0 8 * * *`, Europe/Paris) fires once a day. That's it. There's also a **Manual Trigger** wired in parallel so you can press "run" yourself for testing without waiting until tomorrow morning. Both lead to the same next station.

> 🧠 **Small but real lesson:** having a manual trigger alongside the scheduled one means you can test the *entire real pipeline* on demand. A system you can only observe once a day at 8am is a system you can barely debug. Make your automation runnable by hand.

### Station 2 — The address book (`01_company_list.js`)

This node holds the list of all 96 companies, grouped by which **Applicant Tracking System (ATS)** they use to post jobs:

| ATS platform | Companies | How we reach them |
| --- | --- | --- |
| Greenhouse | 43 | Public JSON API per company |
| Lever | 2 | Public JSON API per company |
| Ashby | 21 | Public JSON API per company |
| Adzuna | 30 | A third-party jobs *aggregator* API |

It outputs four arrays. Everything downstream reads from this single source of truth. Want to add a company? You edit exactly one file.

### Stations 3–6 — The fetchers (`02` → `05`)

Now we go get the jobs. This is split across four nodes:

- `02_fetch_gh_batch1.js` — Greenhouse companies 1–20
- `03_fetch_gh_batch2.js` — Greenhouse companies 21–43
- `04_fetch_lever_ashby.js` — both Lever companies + the first 10 Ashby companies
- `05_fetch_ashby_batch2.js` — the remaining Ashby companies

Why on earth split fetching into four nodes instead of one tidy loop? **The 60-second limit.** Each API call takes ~1.5 seconds on a good day and up to ~4 seconds under load. Multiply by 96 companies and a single node would run for minutes — and get guillotined at 60 seconds, every time.

> 🏃 **Analogy — the relay race.** You can't run a marathon in a 60-second sprint. So you don't. You break the distance into legs and hand the baton to a fresh runner each time. Each fetch node is one runner sprinting its leg, then passing the accumulated jobs to the next. The baton here is a growing list of jobs that each node receives, adds to, and passes on.

There's a subtle, clever move hiding in these fetchers. When we read a job's description (often 1,300+ characters of HTML), we **don't keep it.** Instead we immediately compute two tiny facts from it —

- `ai_in_desc`: a true/false — does this description mention AI/ML/LLM/etc.?
- `domain_score_from_desc`: a 0–20 score — how many relevant domain keywords (growth, fintech, b2b, …) appear?

— and then we *throw the description away.*

> ✉️ **Analogy — read the letter, keep the sticky note.** Imagine sorting a thousand letters. You could photocopy every letter and carry the stack around (heavy, slow, and you'll need a bigger bag). Or you could read each letter, scribble "mentions AI: yes; relevance: 7/10" on a sticky note, and recycle the letter. We do the sticky note. It shrinks each job from ~1,300 bytes to ~300 bytes — a ~4× reduction — which is the difference between fitting under the 38 MB ceiling and crashing.

### Station 7 — The memory firewall (`06_pre_filter_jobs.js`)

By now we've accumulated **~10,000 jobs** in memory. We're about to go fetch *more* from Adzuna. If we carry all 10,000 forward, we'll blow the memory budget.

So this node does a brutally simple, deliberately *dumb* filter:

```js
title.includes('product') || title.includes('cpo') ||
/\bpm\b/.test(title) || title.includes('gpm')
```

That's it. Just the title, just a handful of words. It cuts ~10,000 jobs down to ~500 in well under a second, dropping execution memory from ~43 MB to ~30 MB.

> 🧹 **Analogy — clear the counter before the next ingredient.** A small kitchen counter can only hold so much. Before you bring in the groceries for the next dish, you clear away what you no longer need. The pre-filter clears the counter so the Adzuna fetches have room to work.

Why is it deliberately *dumb* (just titles, very permissive)? Because at this stage, **a false positive is cheap but a false negative is forever.** If we wrongly keep a non-PM job, the real filter downstream will catch it. But if we wrongly *drop* a real PM job here, it's gone — we'll never alert on it. So we err massively toward keeping things. Precision comes later; right now we only care about not losing anything real.

> 🧠 **This is a genuinely important pattern:** *coarse cheap filter first, fine expensive filter later.* It's the same reason airport security does a quick boarding-pass glance before the detailed bag X-ray, and the same reason a recruiter keyword-screens 500 résumés before reading 30 closely. Do the cheap rejection early so the expensive work only runs on survivors.

### Stations 8–12 — The Adzuna fetchers (`07`, `08`, `08b`, `09`, `09b`)

For ~30 big companies (Google, Meta, Microsoft, Apple, Netflix…) there is **no public ATS API** — they run custom, locked-down career sites. So we reach them through **Adzuna**, a job-search aggregator with an API, and ask it "what jobs does company X have?"

This is split into five nodes by market: three for the US (10 companies each), one for the UK, one for a dozen EU-relevant companies across France/Germany/Netherlands. Same reason as before: the 60-second limit.

These nodes hide the single most instructive bug in the whole project (the "thundering herd," [told in full below](#war-3)), so they're built with two defensive tricks:

- **Staggering:** instead of firing all requests at once, each one starts 750 ms after the previous (`setTimeout(i * 750)`). At most ~7 are ever in flight together.
- **Retry-on-429:** a small `fetchWithRetry` wrapper notices "429 Too Many Requests," waits 2 seconds, and tries once more.

### Stations 13–14 — The real filter and the scorer (`10`, `11`)

Now the careful work. `10_filter_pm_roles.js` decides what actually counts as a relevant role. A job survives only if it is **(a product role OR a "PM"-style title) AND (senior-level OR has an AI signal)**:

```js
const isMatch = (isProductRole || isPMAbbrev) && (isSenior || hasAISignal);
```

This catches "Head of Product," "Senior AI PM," "VP, Product," "Director of AI Products" — while rejecting "Product Marketing Manager" (not really product management) and junior roles without an AI angle.

Then `11_score_priority.js` ranks the survivors two ways:

- **Priority (P1/P2/P3)** by location: remote/EU = P1 (best), remote/US = P2, everything else = P3.
- **Match score (50–100)** by signal strength: seniority in the title (+15), AI in the title (+10), domain keywords (+up to 20), and so on.

The output is a sorted shortlist — best-fit roles first.

### Stations 15–17 — Memory and the great comparison (`Read Existing Jobs`, `12_sheet_buffer.js`, `13_compare_detect_new.js`)

How does the robot avoid spamming you with the same job every single day? It keeps a **memory**, and that memory is a humble **Google Sheet**. Every job it has ever alerted on lives there as a row.

1. `Read Existing Jobs` (a Google Sheets node) reads every row already logged.
2. `13_compare_detect_new.js` builds a set of every job ID it's seen, then keeps only today's jobs whose ID *isn't* in that set. Those are the genuinely new ones.

But wait — what about `12_sheet_buffer.js`, that odd little node in the middle? It's four lines, and it exists because of a delightfully nasty quirk:

```js
const items = $input.all();
return items.length > 0 ? items : [{ json: {} }];
```

> 🔌 **Analogy — the pilot light.** In n8n, when a node outputs *zero* items, every downstream node simply doesn't run — the conveyor belt shuts off. On the very first run, the Google Sheet is empty, so `Read Existing Jobs` returns zero rows, and the *entire rest of the pipeline silently dies.* The Sheet Buffer is a pilot light: if nothing comes through, it injects a single empty placeholder `{}` to keep the belt moving. Tiny node, saves the whole machine.

### Stations 18–24 — The fork and the alert (`Any New Jobs?` → `14`/`15`/`16` → Slack)

An **IF node** asks one question: were any new jobs found?

- **Yes →** `14_split_into_rows.js` turns the batch into one row per job, `Append to Sheet` writes them into the Google Sheet memory, `15_format_slack_alert.js` builds a nicely formatted message, and the HTTP node POSTs it to Slack.
- **No →** `16_no_new_jobs_log.js` builds a *heartbeat* message ("✅ Daily scan complete — 13,000 jobs scanned, 0 new roles") and sends that instead.

> ❤️ **Why send a message even when there's nothing to report?** Silence is ambiguous. If you hear nothing, did the robot run and find nothing — or did it die quietly three days ago and you've been missing roles ever since? The heartbeat removes the ambiguity. It's the "I'm alive and I did my job" text. The *absence* of any message now means something is genuinely wrong, which is exactly the signal you want.

There's one more touch of polish worth calling out. Not all "errors" are equal, so the alert formatter sorts them into three buckets like a triage nurse:

| Symbol | Meaning | Is it actionable? |
| --- | --- | --- |
| ⚠️ | Real fetch error (timeout, 5xx, network) | Yes — something broke |
| ℹ️ | Adzuna "taxonomy gap" (company simply isn't in Adzuna's index for that country) | No — structural, expected |
| 📊 | Result cap (a company had >100 jobs; we fetched the first 100) | No — informational |

This matters more than it looks. If you label everything "ERROR," you train yourself to ignore errors. By separating "this is broken" from "this is just how the world is," the ⚠️ symbol stays meaningful.

---

## 4. How the Code Is Actually Organized

Here's the thing that surprises most people coming from traditional programming: **there is no `main()`. There are no imports between these files. Each node script is an island.**

The files in [`nodes/`](nodes/) — `01_company_list.js` through `16_no_new_jobs_log.js` (with `08b` and `09b` for the split-out Adzuna nodes) — are not modules that call each other. They're 18 independent snippets that n8n runs one after another. The *only* way one node talks to the next is through the data it returns.

### The data contract: one envelope passed down the line

Almost every node receives, and returns, a **single JSON object** shaped roughly like this:

```js
{
  total_fetched: 13000,        // running count of everything seen
  errors: [ ... ],             // accumulated problems, never thrown — just collected
  jobs: [ {job}, {job}, ... ]  // the growing/shrinking list of jobs
}
```

> 📦 **Analogy — the shared envelope.** Picture a single envelope traveling down the assembly line. Each station opens it, reads what's inside, adds or removes some pages, reseals it, and passes it on. `jobs` is the stack of pages. `errors` is a running list of "things that went wrong but didn't stop us." `total_fetched` is the page count. By the end, the envelope contains a tidy summary and a shortlist instead of 13,000 raw postings.

Two non-obvious details make this work:

1. **Most of the pipeline carries the entire batch inside *one* item's `json`.** A more naive n8n design would emit one item per job and let them flow individually — but then 13,000 items would each carry overhead, and you couldn't easily compute totals. By keeping the whole batch in a single object until the very end (`14_split_into_rows.js`), we stay lean and keep full control. We only "explode" into one-item-per-job at the last moment, right before writing to the sheet.

2. **Later nodes can reach *back* to earlier ones by name.** n8n lets a node say `$('Score Priority & Match').first().json` to grab another node's output directly, not just the node immediately upstream. The comparison node uses this to pull the scored jobs from one place and the sheet rows from another and diff them. It's like a worker on the line being allowed to walk back and grab a part from an earlier station when they need it.

### Two copies of the same brain

One more structural fact worth understanding: this repository (`github-export/`) is a **public, secrets-redacted mirror** of a workflow that actually lives inside n8n Cloud. The real workflow is stored as one big JSON blob on the n8n server. These `.js` files are human-readable extracts of each node's code, kept here so the project can be read, reviewed, and version-controlled on GitHub.

> 🔐 **Why keep them separate?** Because the live version contains secrets — a Slack webhook URL, an Adzuna API key, a Google Sheet ID. Those must *never* land in a public repo. So the public mirror is deliberately scrubbed, and real credentials live only in environment variables and a private spec. **"Public code, private secrets" is not optional hygiene — it's the difference between a portfolio piece and a security incident.** (More than one company has leaked its entire infrastructure because an API key rode along in a Git commit. Git never forgets, so a leaked secret is leaked forever, even if you delete it in the next commit.)

---

## 5. The Toolbox

Every tool here was chosen for a reason, and every choice was a trade-off. Knowing *why* is far more valuable than knowing *what*.

### n8n — the workflow engine

**What it is:** a low-code automation platform. You build pipelines visually by wiring nodes together, and you can drop into JavaScript whenever the visual blocks aren't enough (which, here, is often).

**Why we chose it:** it gives you scheduling, HTTP requests, retries, credential management, and integrations (Google Sheets, Slack) for free, so you write *logic*, not plumbing. The alternative — a standalone script on a server with its own cron job, secret storage, and error handling — is more code to write and more to maintain.

**The trade-off:** you inherit n8n Cloud's constraints. The 60-second-per-node limit and the ~38 MB memory ceiling are *its* rules, and as you've seen, they dictated half our architecture. Choosing a managed platform always means trading some freedom for a lot of convenience.

### Greenhouse / Lever / Ashby — the ATS APIs

**What they are:** the systems companies use to post jobs and manage applicants. The good news: many expose a clean, public, no-authentication JSON endpoint listing all open roles. `https://boards-api.greenhouse.io/v1/boards/{company}/jobs` and you're done.

**Why they're the gold standard here:** direct from the source, structured, reliable, free. When a company uses one of these, we get near-perfect coverage.

**The trade-off:** only works for companies that use these platforms *and* leave the public endpoint open. Plenty of big names don't — which is why Adzuna exists in this project.

### Adzuna — the aggregator fallback

**What it is:** a job-search engine with an API. We query it by company name to reach the ~30 big companies with no public ATS.

**Why we use it:** partial coverage of giants (Google, Meta, etc.) beats zero coverage.

**The trade-off:** it's noisier and less complete than a direct feed, it rate-limits aggressively (see the war stories), and its internal company names don't always match reality — Adzuna files Meta under "Facebook" and Salesforce under "Salesforce.com." Aggregators are a compromise: broader reach, lower fidelity.

### Google Sheets — the database that isn't a database

**What it is:** a spreadsheet. We use it as the system's long-term memory: one row per job ever seen.

**Why a spreadsheet and not a "real" database?** Because for this scale (low thousands of rows), a real database would be overkill. The Sheet costs nothing, needs no server, and — the killer feature — **you can open it and read it with your own eyes.** You can sort it, add a "Notes" column, fix a typo, eyeball what the robot's been finding. A Postgres instance gives you none of that human touch.

> 📁 **Analogy — the filing cabinet you can actually open.** A "proper" database is a vault: powerful, but you need special tools to look inside. A Google Sheet is a filing cabinet in the corner of the room — humble, but anyone can walk over, pull a drawer, and read a file. For a personal tool tracking a few thousand jobs, the filing cabinet wins. **The right tool is the simplest one that solves the actual problem — not the most impressive one.**

**The trade-off:** it won't scale to millions of rows, and concurrent writes would get hairy. But we will never have millions of jobs, and only one robot ever writes to it. Constraints met, simplicity won.

### Slack incoming webhooks — the delivery

**What it is:** a URL you POST a JSON message to, and it appears in a Slack channel. No app, no OAuth dance, just an HTTP request.

**Why:** it's the lowest-friction way to get a real-time notification onto your phone and laptop. One POST, done.

### Git & GitHub — version control

Every change to the node scripts is committed with a message explaining *why*. The Git log becomes a story: "moved LinkedIn from Adzuna to Greenhouse," "fixed Adzuna rate limiting." Six months from now, that history is the only thing that remembers why a decision was made. (We even hit a classic Git snag *while writing this very document* — see the last war story.)

### MCP (Model Context Protocol) — how the AI manages it

**What it is:** a standard that lets an AI assistant (the one that helps maintain this workflow) talk directly to the n8n instance — inspect nodes, edit them, run tests — through a defined set of tools. It's the bridge that lets "change the filter to also catch 'Group PM'" become an actual edit to the live workflow.

> 🆕 **Newer tech worth knowing:** MCP is recent and increasingly standard for connecting AI assistants to real systems. The lesson isn't the protocol's details — it's the *shape* of the future: tools and AI agents speaking a common language so the AI can take real actions, not just give advice.

---

## 6. War Stories

This is the section to actually remember. **Every one of these was a real failure that taught a real lesson.** Bugs aren't embarrassing — they're the curriculum.

### War 1 — The 60-Second Guillotine

**What happened:** the very first instinct was to fetch all companies in one tidy loop. It worked in testing with a few companies. Then we pointed it at all of them and n8n killed the node at exactly 60 seconds, every run. Half the companies never got fetched, and the failures looked random.

**Why:** n8n Cloud hard-kills any Code node at 60 seconds. ~96 companies × ~1.5–4s each blows way past that.

**The fix:** split fetching into batches sized to stay safely under the ceiling (~15–20 calls per node), each accumulating onto the last. The marathon became a relay.

**The lesson:** **know your platform's hard limits before you design, not after.** Every managed platform has invisible walls — request timeouts, memory caps, payload size limits, rate limits. Find them early; they're not edge cases, they're the *shape of the box you're building in.*

### War 2 — The 38 MB Ceiling

**What happened:** even with batching, longer runs started failing with out-of-memory crashes near the end of the pipeline.

**Why:** n8n keeps each node's input *and* output in memory for the whole run. As jobs accumulated across nodes — each carrying a fat 1,300-byte description — the total crept past ~38 MB right as the last fetchers ran.

**The fix — two moves:**
1. **Consume descriptions at the source.** Compute `ai_in_desc` and `domain_score_from_desc` the moment we read a description, then drop the raw text. (~1,300 → ~300 bytes per job.)
2. **The memory firewall** (`06_pre_filter_jobs.js`): cut ~10,000 jobs to ~500 *before* the memory-hungry Adzuna fetches. Execution memory fell from ~43 MB to ~30 MB.

**The lesson:** **don't carry data you've already extracted the value from.** The description's *value* was two small facts; the 1,300 bytes of HTML were just packaging. Extract the signal, drop the packaging. This is the single highest-leverage idea in the whole codebase.

<a name="war-3"></a>
### War 3 — The Thundering Herd (the best bug)

**What happened:** to speed up the Adzuna fetches, we made all the requests fire at once with `Promise.allSettled` — fully parallel, very fast. For a while it was glorious. Then one day: **49 errors in a single run.** Companies returning "429 Too Many Requests." The faster we tried to go, the *less* data we got.

**Why:** firing 20–60 simultaneous requests at Adzuna tripped its rate limiter. It saw a flood and slammed the door.

> 🚪 **Analogy — everyone rushing one doorway.** If a hundred people sprint at a single door at the same instant, nobody gets through — they jam the frame. But a steady stream, one every second, flows smoothly and everyone's inside in no time. Counterintuitively, *slowing down each request made the whole batch faster*, because none of them got rejected and retried.

**The fix:** **stagger** the requests 750 ms apart (`setTimeout(i * 750)`), capping concurrency at ~7, plus a `fetchWithRetry` that waits 2 seconds and retries once on a 429. Smooth flow, zero rejections.

**The lesson:** **maximum parallelism is not maximum throughput.** Every shared resource (an API, a database, a disk) has a comfortable pace. Past it, you don't just stop gaining — you go *backwards*, as rejections and retries pile up. The art is finding the fast-but-sustainable pace. This is one of the most broadly useful lessons in all of systems engineering.

### War 4 — The Silent Pipeline

**What happened:** on the very first run, with an empty Google Sheet, the whole workflow just… stopped halfway. No error. No Slack message. Nothing.

**Why:** an empty sheet means `Read Existing Jobs` returns zero items, and in n8n, **zero items downstream = nothing runs.** The pipeline didn't crash; it evaporated.

**The fix:** `12_sheet_buffer.js` — four lines that inject a placeholder `{}` when the input is empty, keeping the belt moving.

**The lesson:** **the empty case is a real case.** Zero rows, zero results, the first-ever run, the file that doesn't exist yet — these aren't exotic edge cases, they're *guaranteed* to happen (the empty state is literally where every system starts). The most common source of "it works on my machine but dies in the real world" is forgetting that sometimes the answer is *nothing*, and *nothing* needs handling too.

### War 5 — The Miscount

**What happened:** Slack proudly reported scanning a few hundred jobs when the real number was over 13,000. Not a crash — just a quietly wrong number that made the system look broken.

**Why:** the Adzuna nodes were overwriting the running `total_fetched` count instead of adding to it.

**The fix:** track the delta — `prevTotalFetched + (newJobs - prevJobCount)` — so each node *adds* its contribution rather than clobbering the total.

**The lesson:** **a wrong number is more dangerous than a crash.** A crash screams for attention. A plausible-but-wrong number sits there looking fine while quietly eroding your trust in the whole system. Be as careful with your counters and summaries as with your core logic — people make decisions based on those numbers.

### War 6 — The Name Game

**What happened:** Adzuna kept returning zero jobs for Meta, Salesforce, Adobe, Palantir, and Block — companies that obviously have tons of openings.

**Why:** Adzuna's internal company index uses *different names*. Meta is filed as "Facebook," Salesforce as "Salesforce.com," Block as "Square." We were asking for the brand name; the database knew them by another.

> 📞 **Analogy — the old phone book.** A phone book lists people by legal name, not nickname. If you only know your friend as "Buzz," you'll never find him under B — you need to know he's filed as "Edwin Aldrin." We had to learn each company's "legal name" in Adzuna's directory.

**The fix:** split the concept in two — a `name` field (what Adzuna calls it, used for the query) and a `displayName` field (the real brand, shown to humans in Slack and the Sheet). And critically, when a company *genuinely* isn't in Adzuna's index for a country, we mark it ℹ️ (expected gap), not ⚠️ (broken).

**The lesson:** **the map is not the territory.** External systems have their own internal model of the world, and it rarely matches yours exactly. Build a translation layer between "how I name things" and "how they name things" — and learn to tell the difference between *your* bug and *their* limitation. Mislabeling the second as the first sends you hunting for fixes that don't exist.

### War 7 — The Members-Only Clubs

**What happened:** Meta, Apple, Netflix, and Uber have thousands of real jobs we *still* can't see well. Meta's sitemap lists 1,214 jobs; we capture ~3.

**Why:** they run custom career sites with active anti-bot defenses (CSRF tokens, browser-session requirements). They're built specifically to block automated access, and Adzuna barely indexes them either.

**The fix:** …there isn't a clean one, and that's the point. We documented the gap honestly, captured what little Adzuna offers, and moved on.

**The lesson:** **know the difference between a hard problem and an impossible-for-now one, and be honest about it.** Sinking a week into scraping Netflix's bot-defended site — likely violating its terms of service in the process — would be worse than spending zero. A mature engineer maps the boundary of what's feasible, documents what's outside it and why, and doesn't pretend a known gap is covered. **Honesty about limitations is a feature, not an admission of defeat.**

### War 8 — The Stale Map (this one happened *today*)

**What happened:** while pushing the banner image for this very repo, the push was rejected: *"Updates were rejected because the remote contains work that you do not have locally."*

**Why:** this repo's `.git` folder syncs through Dropbox across machines. Meanwhile, someone had merged a pull request (a Mermaid-diagram fix) on GitHub directly. So the local clone's idea of the remote was *stale* — it thought it was up to date, but GitHub had moved on. Git only re-checks reality at push time, which is why the surprise landed there.

**The fix:** `git fetch` to see the truth, confirm the remote's change (a different part of the same file) wouldn't collide, then `git rebase` to replay the local commit cleanly on top of the remote's work, then push.

**The lesson:** **your cached picture of a shared system can silently drift from reality.** Whether it's Git refs, a CDN cache, a stale API response, or your mental model of "how the code works" — the safe move before changing a shared thing is to *re-sync with the source of truth first.* `fetch` before you `push`. Look before you leap. And rebase-over-merge keeps history a clean straight line instead of a tangle of merge commits.

---

## 7. How Good Engineers Think

Strip away the specifics and a handful of mental habits show up again and again. These are the transferable part — the stuff worth internalizing whether or not you ever touch n8n.

**1. Constraints are the design.** The 60-second and 38 MB limits weren't annoyances *around* the design — they *were* the design. Batching, the memory firewall, description-consumption: all of it is a direct response to a hard limit. Good engineers don't fight constraints; they let constraints shape an elegant solution. The first question on any platform is "where are the walls?"

**2. Fail soft, not hard.** Notice that no fetch ever crashes the pipeline. Every company is wrapped in `try/catch`; a failure gets pushed onto an `errors` list and the run keeps going. One dead API never takes down the other 95. **Isolate failure so a problem stays local instead of cascading.**

**3. Make the invisible visible.** The heartbeat message, the three-way error triage (⚠️/ℹ️/📊), the accurate scan counts — none of these find a single extra job. They exist so a *human* can trust the system at a glance. **A system you can't observe is a system you can't trust, and one you'll eventually stop using.**

**4. Cheap before expensive.** The dumb pre-filter runs before the smart filter. The boolean flag is computed before memory runs out. Always do the cheap rejection first so the expensive work runs on the smallest possible pile.

**5. Idempotency — running twice is safe.** Run the workflow five times in a morning and you won't get five copies of the same alert, because the Sheet remembers what's been seen. **A good automated job can be safely re-run** — that's what makes it safe to retry, schedule, and trust.

**6. Build vs. buy, honestly.** We *bought* (used) n8n, Adzuna, Google Sheets, and Slack instead of *building* a scheduler, a scraper, a database, and a notification service. We wrote only the ~18 small pieces of genuinely custom logic. **Write only the code that's actually unique to your problem; rent the rest.**

**7. The simplest thing that works.** A spreadsheet for a database. A keyword match instead of a machine-learning classifier. Could the filtering be a fine-tuned model? Sure. Would it be better for this? No — it'd be slower, costlier, harder to debug, and no more accurate at this scale. **Reach for sophistication only when simplicity actually fails you,** not because it's more impressive.

> 🎙️ **A note for the interview room:** the memorable answer to "tell me about a technical project" is never a feature list. It's a *story with tension* — "I made all the requests parallel for speed, it started failing with rate-limit errors, and I learned that slowing each request down actually made the whole batch faster." That arc (decision → failure → insight) is what makes an interviewer lean in, because it shows judgment, not just activity. Every war story above is one of those arcs, ready to tell.

---

## 8. Pitfalls & How to Dodge Them

A field guide for next time, distilled from the scars above:

| Pitfall | How to dodge it |
| --- | --- |
| Designing before knowing platform limits | Find the hard caps (timeouts, memory, payload, rate limits) *first*; design within them |
| Carrying raw data you've already mined | Extract the signal at the source, then drop the bulk |
| Assuming more parallelism = more speed | Respect each resource's sustainable pace; stagger + retry on shared APIs |
| Forgetting the empty / first-run case | Always ask "what if there are zero results?" and handle it explicitly |
| Trusting your cached view of a shared system | Re-sync with the source of truth before you change it (`fetch` before `push`) |
| Treating all errors as equal | Separate "broken" from "expected" so real alarms stay loud |
| Letting one failure kill everything | Wrap risky calls in `try/catch`; collect errors, keep going |
| Plausible-but-wrong numbers | Test your counters and summaries as carefully as your core logic |
| Secrets in a public repo | Keep credentials in env vars / a private file; never commit them — Git remembers forever |
| Silence as your only "all clear" | Send a heartbeat so absence becomes a meaningful alarm |

---

## 9. What's Still Broken

A real system has a real to-do list. Pretending otherwise is the tell of an amateur. Honest gaps:

- **The members-only clubs.** Meta, Apple, Netflix, and Uber remain largely invisible behind anti-bot defenses. No clean fix.
- **Adzuna noise.** The aggregator path is lower-fidelity than direct ATS feeds. A planned query change (from `product+growth+cpo` to a tighter `product manager`) should cut noise substantially.
- **Silent source rot.** If a company switches ATS platforms, its job count quietly drops to zero and nothing screams about it. A planned "Source Health" tab would log per-company counts daily and alert on suspicious drops — turning a silent failure into a loud one (lesson #3 again).
- **No test harness for the filter.** The keyword logic is tested by eye. If it grows more complex, a small set of known example jobs ("this one *should* match, this one *shouldn't*") would catch regressions automatically.

Notice the theme: most future work is about **making more failures visible**, not adding features. That's usually where a maturing system's real work lives.

---

## 10. The One-Paragraph Version

*AI Job Alerts is a daily automated pipeline that scans 96 companies' career pages — via their Greenhouse/Lever/Ashby APIs, plus the Adzuna aggregator for big tech that has no public API — filters ~13,000 raw postings down to senior AI Product Management roles, scores them by location and relevance, deduplicates against a Google Sheet that serves as its memory, and posts only the genuinely new matches to Slack (with a heartbeat message on quiet days so silence always means something is wrong). It's built as a ~24-node n8n workflow, and almost every design decision — batched fetching, a memory-firewall pre-filter, consuming job descriptions into tiny flags, staggered rate-limited API calls — traces back to two hard platform limits: 60 seconds per step and ~38 MB of memory. The bugs along the way taught the durable lessons: respect platform constraints, do cheap work before expensive work, slow down to go faster against rate limits, handle the empty case, make failures visible, and keep secrets out of public code.*

---

*Want the precise node-by-node spec, the exact filter keywords, and setup instructions? See the [`README`](README.md). Want to read the actual code? It's all in [`nodes/`](nodes/), numbered in execution order.*
