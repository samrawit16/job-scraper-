# Remote Job Market Scraper

I built this to answer a simple question: what does the remote job market actually look like right now — what levels are companies hiring for, and what skills do they keep asking for?

The pipeline scrapes real postings from two sources, uses an LLM to classify seniority and extract skills from the free text, and then — importantly — checks its own accuracy against human labels instead of just trusting the model.

## Pipeline

1. **Scrape** — pulls job listings from WeWorkRemotely (RSS feed, scraping permitted per their robots.txt) and Jobicy's public API. I checked robots.txt for the obvious alternatives first: RemoteOK and Remotive both disallow it, so they were left out. Result: 243 postings across 5 categories.
2. **Classify** — an LLM (`openai/gpt-oss-20b` via Groq's API) assigns each posting a seniority label: `intern`, `junior`, `mid`, `senior`, `lead`, or `unknown`. Postings are sent in batches of 10 to keep API usage reasonable.
3. **Extract skills** — the same model pulls up to 6 skills per posting from the description.
4. **Audit** — a random sample of 30 postings is hand-labeled (by me, reading the actual postings), then compared to the model's predictions: overall accuracy, per-label precision/recall, and confusion counts.
5. **Refine** — postings the LLM leaves `unknown` get a deterministic title-based fallback (Senior/Sr. → senior, Lead/Director/VP → lead, no signal → mid). This is a hybrid approach: the LLM handles the messy cases, cheap rules handle the obvious ones.

## Results

| | |
|---|---|
| Postings scraped | 243 (117 WeWorkRemotely, 126 Jobicy) |
| Classified with a concrete level | 184/243 (59 honestly `unknown`) |
| Human audit accuracy (LLM only) | 66.7% |
| Human audit accuracy (with fallback) | **76.7%** |

Per-label performance after the fallback:

| label | precision | recall |
|---|---|---|
| senior | 100% | 91% |
| lead | 67% | 100% |
| mid | 58% | 78% |
| junior | 100% | 33% |

The failure mode is consistent and understandable: the model is conservative. Its main error is predicting `unknown` (or `mid`) for postings a human would confidently call `junior` or `lead` — e.g. "Customer Service Representative" or "Engineering Manager II". It almost never guesses a *higher* level than reality, which is the safer direction to err in.

## What the data says

- **Remote hiring skews experienced.** Of the labeled postings, 49% are senior-level and only 13% junior. Companies hiring remotely are mostly not hiring juniors.
- **"AI" is the most-mentioned skill** (32 of 243 postings), ahead of automation, communication, and cloud. It's no longer just an engineering keyword — it shows up in marketing, ops, and support postings too.

## Things that broke, and what I did

- **Gemini's free tier is 20 requests/day per model.** Mid-run, every request started returning 429 and my script silently wrote `unknown` for everything — which the audit then caught as 0% precision on every label. Fix: switched to Groq, and made the audit step in the first place (it was the audit that surfaced the bug, which is exactly why it exists).
- **Rate limits on Groq too.** The scripts are now resumable with delays between batches: re-running only processes the jobs that don't have labels yet, so progress is never lost.
- **The naive fallback made things worse first.** My first version mapped any title containing "manager" to `lead` — but an "Account Manager" is a mid-level sales role, not leadership. Removing `manager` from the rule and defaulting no-signal titles to `mid` took accuracy from 66.7% to 76.7%.

## Running it

```bash
npm install
npx tsx src/scrape.ts                  
npx tsx --env-file=.env src/enrich.ts  
npx tsx --env-file=.env src/skills.ts  
npx tsx src/audit.ts                   # writes a 30-posting sample for human labeling
npx tsx src/evaluate.ts                # compares model vs. human labels
npx tsx src/fallback.ts                # applies the title-based fallback to unknowns
