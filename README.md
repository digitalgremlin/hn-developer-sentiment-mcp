_What developers really think about your tool._

**A deterministic read on Hacker News developer sentiment for any brand, tool, or library** — sentiment, mention volume, recurring themes, and feature requests across HN stories and comments, exposed as **four agent-callable MCP tools**. The differentiator is **judgment and aggregation, not raw access**: it scores, clusters, and mines public HN discussion so an AI agent can act in a single call, and returns the raw matched items alongside the aggregates so every number is auditable.

**Zero setup — no API key.** The Hacker News (Algolia) API is open, so this Actor boots and returns data immediately. No credentials, no approval queue, no first-run friction.

No LLM in the analysis layer — sentiment is a transparent lexicon-plus-rules scorer, so the same posts always produce the same answer.

## Who is this for?

- **AI agents** that need a one-call read on how developers feel about a product before drafting a comparison, a launch post, or a support reply.
- **DevRel and product teams** tracking how a tool, framework, or release is landing with the Hacker News crowd.
- **Founders and marketers** validating positioning against what developers actually say in public.

## Why use Hacker News Developer Sentiment?

- **Zero setup** — no API key, no login, no approval process. Deploy and call.
- **One call, a usable answer** — sentiment label, net score, volume, top themes, and representative samples in a single structured response.
- **Deterministic and auditable** — no model temperature, no per-call drift. Same posts plus same config always produce the same output, and the raw items ship alongside the aggregates.
- **Built for agents** — a Standby MCP server speaking the Streamable HTTP transport, so any MCP client can connect and call it directly.
- **Cheap and fast** — one HN payload per query, cached and shared across the query tools. No LLM cost in the analysis path.

## How to use Hacker News Developer Sentiment

1. **Deploy the Actor** — run it in Standby mode on Apify. It boots with no input required and returns data immediately.
2. **Connect your MCP client** to the Standby endpoint (`https://<your-standby-url>/mcp`) using the Streamable HTTP transport.
3. **Call `get_sentiment_summary`** with a `query` (a brand, tool, or topic) for the headline read.
4. **Drill in** with `search_mentions`, `get_feature_requests`, or `get_trending_discussions` when you need detail. The query tools share the same cached payload per query.

## The four tools

`query` is a brand/tool/topic string (e.g. `"prisma"`, `"tailwind"`). `channels`, `windowDays`, and `limit` are optional and fall back to the Actor's configured defaults. `channels` selects HN post types — `story`, `ask_hn`, `show_hn`, `comment` — and defaults to all (stories **and** comments, since HN opinion lives in the comments).

### `get_sentiment_summary` — the headline read

Aggregate sentiment, mention volume, top themes, and representative samples for a query. Input: `query` (required), `channels?`, `windowDays?`.

```jsonc
{
  "query": "prisma",
  "channelsQueried": ["story", "ask_hn", "show_hn", "comment"],
  "windowDays": 30,
  "mentionVolume": 52,
  "netSentiment": 0.18,
  "sentimentLabel": "Positive",
  "breakdown": { "positive": 29, "neutral": 16, "negative": 7 },
  "topThemes": [
    { "term": "type safety", "count": 15 },
    { "term": "migrations", "count": 12 },
    { "term": "query performance", "count": 7 }
  ],
  "topSamples": [
    {
      "title": "Prisma 6 made our migrations painless",
      "channel": "story",
      "score": 312,
      "url": "https://news.ycombinator.com/item?id=48800001",
      "createdAt": "2026-06-02T14:11:00.000Z",
      "sentiment": "Positive"
    }
  ],
  "fetchedAt": "2026-07-14T00:00:00.000Z"
}
```

`netSentiment` is the mean compound score in `[-1, 1]`; `sentimentLabel` buckets it at ±0.05. `topSamples` are the three highest-engagement items. `topThemes` are stopword- and query-term-filtered unigrams/bigrams ranked by frequency.

### `search_mentions` — matched items with per-item sentiment

Stories and comments mentioning the query, each scored, ranked by score then recency. Input: `query` (required), `channels?`, `windowDays?`, `limit?`.

```jsonc
{
  "query": "prisma",
  "channelsQueried": ["story", "comment"],
  "windowDays": 30,
  "count": 2,
  "items": [
    {
      "id": "48800001",
      "title": "Prisma 6 made our migrations painless",
      "excerpt": "We migrated a 40-table schema with zero downtime and the typed client caught three bugs before...",
      "channel": "story",
      "score": 312,
      "numComments": 88,
      "url": "https://news.ycombinator.com/item?id=48800001",
      "createdAt": "2026-06-02T14:11:00.000Z",
      "sentiment": "Positive",
      "sentimentScore": 0.74
    }
  ],
  "fetchedAt": "2026-07-14T00:00:00.000Z"
}
```

`excerpt` is the item text truncated to 280 characters. `sentimentScore` is the per-item compound in `[-1, 1]`. Comments have an empty `title` and `numComments: 0`.

### `get_feature_requests` — requests and pain points, grouped

Items that voice a feature request, wish, gap, roadmap question, or pain point about the query — grouped by cue category. Input: `query` (required), `channels?`, `windowDays?`, `limit?`.

```jsonc
{
  "query": "prisma",
  "channelsQueried": ["story", "ask_hn", "comment"],
  "windowDays": 30,
  "count": 3,
  "items": [
    {
      "id": "48800042",
      "title": "Ask HN: does Prisma support deep JSON filtering yet?",
      "excerpt": "Please add deep JSON path filters to the query API.",
      "cueCategory": "request",
      "channel": "ask_hn",
      "score": 54,
      "url": "https://news.ycombinator.com/item?id=48800042",
      "createdAt": "2026-06-09T18:30:00.000Z"
    }
  ],
  "byCategory": { "wish": 1, "missing": 1, "request": 1, "plans": 0, "painpoint": 0 },
  "fetchedAt": "2026-07-14T00:00:00.000Z"
}
```

`cueCategory` is one of `request` / `wish` / `missing` / `plans` / `painpoint` (matched by priority in that order). `excerpt` is the matching sentence. `byCategory` totals always sum to `count`.

### `get_trending_discussions` — highest-engagement stories (no query)

Top Hacker News stories by engagement, no query required. Input: `windowDays?`, `limit?`.

```jsonc
{
  "channelsQueried": ["story"],
  "windowDays": 7,
  "count": 2,
  "items": [
    {
      "id": "48841676",
      "title": "Postgres rewritten in Rust, now passing 100% of the regression tests",
      "channel": "story",
      "score": 980,
      "numComments": 240,
      "engagement": 1220,
      "url": "https://news.ycombinator.com/item?id=48841676",
      "createdAt": "2026-07-12T09:02:00.000Z",
      "sentiment": "Neutral"
    }
  ],
  "fetchedAt": "2026-07-14T00:00:00.000Z"
}
```

`engagement` is `score + numComments`; items are ranked by it descending. Trending is story-level (comments excluded — they have no thread engagement).

## Input

The server boots with **no input required** and returns data immediately — the Hacker News (Algolia) API needs no credentials. All fields below are optional.

| Field | Type | Default | Description |
|---|---|---|---|
| `defaultChannels` | array | `["story","ask_hn","show_hn","comment"]` | HN post types searched when a tool call doesn't specify its own. Allowed: `story`, `ask_hn`, `show_hn`, `comment`. |
| `windowDays` | integer | `30` | Default trailing look-back window in days (1–90). |
| `cacheTtlMinutes` | integer | `20` | How long a query's fetched payload is reused before refetching (1–240). |
| `maxItems` | integer | `100` | Upper bound on items per call; per-call `limit` is clamped to this (10–250). |

## Output

Each tool returns a single structured JSON object (shown above per tool). Responses are deterministic — the same posts plus the same config always produce the same result. Every response includes a `fetchedAt` timestamp reflecting when the underlying Hacker News payload was pulled; a cached read returns the same payload (and timestamp) for that TTL window.

## Data fields reference

| Field | What it tells you |
|---|---|
| `netSentiment` | Mean compound sentiment across matched items, in `[-1, 1]` |
| `sentimentLabel` | Positive / Neutral / Negative, bucketed at ±0.05 |
| `breakdown` | Count of positive / neutral / negative items |
| `mentionVolume` | Number of matched items in the window |
| `topThemes` | Most frequent unigrams/bigrams (stopword- and query-term-filtered) |
| `topSamples` | The three highest-engagement matched items |
| `sentimentScore` | Per-item compound sentiment, in `[-1, 1]` |
| `channel` | HN post type: `story` / `ask_hn` / `show_hn` / `comment` |
| `cueCategory` | Feature-request category: request / wish / missing / plans / painpoint |
| `byCategory` | Count of feature-request items per cue category |
| `engagement` | `score + numComments` for a story (trending rank key) |
| `fetchedAt` | When the underlying Hacker News payload was fetched |

## Pricing

This Actor runs in Standby mode and is billed for the compute used while warm and serving requests. Reads are lightweight — each query's HN data is fetched once, cached (default 20 minutes), and shared across the query tools, so calling several tools for the same query costs a single upstream fetch. There is no LLM in the analysis path, so no per-call model cost, and the Hacker News API is free.

## Tips

- **Start with `get_sentiment_summary`** for the headline, then call a detail tool only when you need it — the query tools share the same cached payload.
- **Narrow `channels`** (e.g. `["ask_hn"]`) to focus on solicitation threads, or drop `comment` to look only at story-level signal.
- **Raise `cacheTtlMinutes`** when batching many queries; lower it when you need fresh reads.
- **Widen `windowDays`** (up to 90) to capture a steadier baseline.

## How it works

1. An MCP client sends a tool call (e.g. `get_sentiment_summary`) with a `query`.
2. The server checks an in-memory LRU + TTL cache. On a miss, it makes one request to the open Hacker News (Algolia) search API across the selected channels and caches the raw items.
3. HN text (which arrives HTML-ish) is stripped of tags and decoded, then pure analysis functions score sentiment (lexicon + negation/intensifier/emoji rules), aggregate it, extract themes, mine feature-request cues, and rank — with no further network calls.
4. The matched window is filtered to the exact day count, and the tool's structured result — aggregates plus raw items plus `fetchedAt` — is returned to the MCP client.

All analysis is deterministic and clock-injected (testable without network). Transient errors (network blips, 5xx) are retried with bounded backoff; rate limits (429) surface a `resetAt` for the caller to handle.

## Works well with

Part of a small slate of agent-focused Apify Actors:

- **[GitHub Repo Intelligence MCP](https://apify.com/joeslade/github-repo-intelligence-mcp)** — opinionated maintainability verdicts for any GitHub repo across five MCP tools.
- **[SERP Topic Gap Monitor](https://apify.com/joeslade/serp-topic-gap-monitor)** — finds topic gaps in search-result coverage and produces scored gap reports.
- **[Docs MCP Server](https://apify.com/joeslade/docs-mcp-server-starter)** — an MCP server giving AI assistants queryable access to framework documentation.

## FAQ and support

**Do I need an API key or account?**
No. The Hacker News (Algolia) search API is open — the Actor boots and returns data with zero setup.

**Is the sentiment from an LLM?**
No. Sentiment is a transparent lexicon-plus-rules scorer (negation, intensifiers, emoji, VADER-style normalization). There is no model in the analysis layer, which is what makes every call deterministic and auditable.

**Does it read comments or just stories?**
Both, by default — HN opinion lives in the comments. Use the `channels` argument to narrow to specific post types.

**Is the output stable?**
Yes. Same items plus same config always yield the same aggregates, and the raw matched items are returned alongside so you can audit every number.

**It returned a rate-limit message — what do I do?**
Hacker News rate limits (429) surface a `resetAt` timestamp; retry after it. Raising `cacheTtlMinutes` reduces upstream calls when batching.

**Found a bug or want a feature?**
Open an issue on the Actor's **Issues** tab. Custom variations are available on request.

## Acknowledgements

The sentiment lexicon is expanded from [VADER](https://github.com/cjhutto/vaderSentiment) (Hutto, C.J. & Gilbert, E.E., 2014), used under its MIT license. Hacker News data via the [Algolia HN Search API](https://hn.algolia.com/api).

## License

Copyright © 2026 Joe Slade.

Licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). You're free to use, study, modify, and self-host this software; if you run a modified version as a network service, the AGPL requires you to offer your modified source to its users under the same license. For a commercial license not subject to the AGPL's network-copyleft, contact the author.
