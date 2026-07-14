_What developers really think about your tool._

**A deterministic read on developer-Reddit sentiment for any brand, tool, or library** — sentiment, mention volume, recurring themes, and feature requests across public developer subreddits, exposed as **four agent-callable MCP tools**. The differentiator is **judgment and aggregation, not raw access**: it scores, clusters, and mines public posts so an AI agent can act in a single call, and returns the raw matched items alongside the aggregates so every number is auditable.

No LLM in the analysis layer — sentiment is a transparent lexicon-plus-rules scorer, so the same posts always produce the same answer.

## Who is this for?

- **AI agents** that need a one-call read on how developers feel about a product before drafting a comparison, a launch post, or a support reply.
- **DevRel and product teams** tracking how a tool, framework, or release is landing with developers.
- **Founders and marketers** validating positioning against what developers actually say in public.

## Why use Reddit Developer Sentiment?

- **One call, a usable answer** — sentiment label, net score, volume, top themes, and representative samples in a single structured response.
- **Deterministic and auditable** — no model temperature, no per-call drift. Same posts plus same config always produce the same output, and the raw items ship alongside the aggregates.
- **Built for agents** — a Standby MCP server speaking the Streamable HTTP transport, so any MCP client can connect and call it directly.
- **Cheap and fast** — one raw Reddit payload per query, cached and shared across the query tools. No LLM cost in the analysis path.

## How to use Reddit Developer Sentiment

1. **Deploy the Actor** — run it in Standby mode on Apify. It boots with no input required.
2. **Connect your MCP client** to the Standby endpoint (`https://<your-standby-url>/mcp`) using the Streamable HTTP transport.
3. **Add Reddit API credentials** — effectively required. Reddit's API rejects unauthenticated requests, so without a client ID/secret the tools return a credential error rather than data. See [Input](#input) for setup.
4. **Call `get_sentiment_summary`** with a `query` (a brand, tool, or topic) for the headline read.
5. **Drill in** with `search_mentions`, `get_feature_requests`, or `get_trending_discussions` when you need detail. The query tools share the same cached payload per query.

## The four tools

`query` is a brand/tool/topic string (e.g. `"prisma"`, `"tailwind"`). `subreddits`, `windowDays`, and `limit` are optional and fall back to the Actor's configured defaults. Subreddit names are normalized (an `r/` prefix is stripped and they are lowercased).

### `get_sentiment_summary` — the headline read

Aggregate sentiment, mention volume, top themes, and representative samples for a query. Input: `query` (required), `subreddits?`, `windowDays?`.

```jsonc
{
  "query": "prisma",
  "subredditsQueried": ["programming", "webdev", "devops", "machinelearning"],
  "windowDays": 30,
  "mentionVolume": 47,
  "netSentiment": 0.21,
  "sentimentLabel": "Positive",
  "breakdown": { "positive": 28, "neutral": 12, "negative": 7 },
  "topThemes": [
    { "term": "type safety", "count": 14 },
    { "term": "migrations", "count": 11 },
    { "term": "query performance", "count": 6 }
  ],
  "topSamples": [
    {
      "title": "Prisma 6 made our migrations painless",
      "subreddit": "webdev",
      "score": 312,
      "url": "https://www.reddit.com/r/webdev/comments/abc123/...",
      "createdAt": "2026-06-02T14:11:00.000Z",
      "sentiment": "Positive"
    }
  ],
  "fetchedAt": "2026-06-18T00:00:00.000Z"
}
```

`netSentiment` is the mean compound score in `[-1, 1]`; `sentimentLabel` buckets it at ±0.05. `topSamples` are the three highest-engagement posts. `topThemes` are stopword- and query-term-filtered unigrams/bigrams ranked by frequency.

### `search_mentions` — matched posts with per-item sentiment

Posts mentioning the query, each scored, ranked by score then recency. Input: `query` (required), `subreddits?`, `windowDays?`, `limit?`.

```jsonc
{
  "query": "prisma",
  "subredditsQueried": ["webdev"],
  "windowDays": 30,
  "count": 2,
  "items": [
    {
      "id": "t3_abc123",
      "title": "Prisma 6 made our migrations painless",
      "excerpt": "We migrated a 40-table schema with zero downtime and the typed client caught three bugs before...",
      "subreddit": "webdev",
      "score": 312,
      "numComments": 88,
      "url": "https://www.reddit.com/r/webdev/comments/abc123/...",
      "createdAt": "2026-06-02T14:11:00.000Z",
      "sentiment": "Positive",
      "sentimentScore": 0.74
    }
  ],
  "fetchedAt": "2026-06-18T00:00:00.000Z"
}
```

`excerpt` is the post body truncated to 280 characters. `sentimentScore` is the per-post compound in `[-1, 1]`.

### `get_feature_requests` — requests and pain points, grouped

Posts that voice a feature request, wish, gap, roadmap question, or pain point about the query — grouped by cue category. Input: `query` (required), `subreddits?`, `windowDays?`, `limit?`.

```jsonc
{
  "query": "prisma",
  "subredditsQueried": ["programming"],
  "windowDays": 30,
  "count": 3,
  "items": [
    {
      "id": "t3_req1",
      "title": "Prisma needs better JSON filtering",
      "excerpt": "Please add deep JSON path filters to the query API.",
      "cueCategory": "request",
      "subreddit": "programming",
      "score": 54,
      "url": "https://www.reddit.com/r/programming/comments/req1/...",
      "createdAt": "2026-06-09T18:30:00.000Z"
    }
  ],
  "byCategory": { "wish": 1, "missing": 1, "request": 1, "plans": 0, "painpoint": 0 },
  "fetchedAt": "2026-06-18T00:00:00.000Z"
}
```

`cueCategory` is one of `request` / `wish` / `missing` / `plans` / `painpoint` (matched by priority in that order). `excerpt` is the matching sentence. `byCategory` totals always sum to `count`.

### `get_trending_discussions` — highest-engagement threads (no query)

Top threads across the target subreddits by engagement, no query required. Input: `subreddits?`, `windowDays?`, `limit?`.

```jsonc
{
  "subredditsQueried": ["programming", "devops"],
  "windowDays": 7,
  "count": 2,
  "items": [
    {
      "id": "t3_xyz789",
      "title": "What broke in production this week — a thread",
      "subreddit": "devops",
      "score": 980,
      "numComments": 240,
      "engagement": 1220,
      "url": "https://www.reddit.com/r/devops/comments/xyz789/...",
      "createdAt": "2026-06-15T09:02:00.000Z",
      "sentiment": "Negative"
    }
  ],
  "fetchedAt": "2026-06-18T00:00:00.000Z"
}
```

`engagement` is `score + numComments`; items are ranked by it descending.

## Input

The server boots with **no input required** (a Standby constraint — all fields are optional in the schema so the container never crash-loops on startup). In practice, you must provide Reddit API credentials for the Actor to return data rather than a credential error.

| Field | Type | Default | Description |
|---|---|---|---|
| `redditClientId` | string (secret) | — | **Effectively required.** Client ID of a Reddit app (application-only OAuth). |
| `redditClientSecret` | string (secret) | — | **Effectively required.** Secret paired with the client ID. Stored encrypted; never logged or returned. |
| `defaultSubreddits` | array | `["programming", "webdev", "devops", "machinelearning"]` | Subreddits searched when a tool call doesn't specify its own (1–25 entries). |
| `windowDays` | integer | `30` | Default trailing look-back window in days (1–90). |
| `cacheTtlMinutes` | integer | `20` | How long a query's fetched payload is reused before refetching (1–240). |
| `maxItems` | integer | `100` | Upper bound on items per call; per-call `limit` is clamped to this (10–250). |

> **Reddit app setup.** Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) and create an app of type **script**. The **client ID** is the short string shown under the app name; the **secret** is labeled `secret`. This Actor uses application-only OAuth (the `client_credentials` grant) and reads **public subreddits only** — no user account access. For Standby deployments, set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` as environment variables (stored as secrets) so they persist across restarts rather than pasting them into the input field.

## Output

Each tool returns a single structured JSON object (shown above per tool). Responses are deterministic — the same posts plus the same config always produce the same result. Every response includes a `fetchedAt` timestamp reflecting when the underlying Reddit payload was pulled; a cached read returns the same payload (and timestamp) for that TTL window. You can download any dataset captured from runs in JSON, HTML, CSV, or Excel from the Apify Console.

## Data fields reference

| Field | What it tells you |
|---|---|
| `netSentiment` | Mean compound sentiment across matched posts, in `[-1, 1]` |
| `sentimentLabel` | Positive / Neutral / Negative, bucketed at ±0.05 |
| `breakdown` | Count of positive / neutral / negative posts |
| `mentionVolume` | Number of matched posts in the window |
| `topThemes` | Most frequent unigrams/bigrams (stopword- and query-term-filtered) |
| `topSamples` | The three highest-engagement matched posts |
| `sentimentScore` | Per-post compound sentiment, in `[-1, 1]` |
| `cueCategory` | Feature-request category: request / wish / missing / plans / painpoint |
| `byCategory` | Count of feature-request posts per cue category |
| `engagement` | `score + numComments` for a post (trending rank key) |
| `fetchedAt` | When the underlying Reddit payload was fetched |

## Pricing

This Actor runs in Standby mode and is billed for the compute used while warm and serving requests. Reads are lightweight — each query's Reddit data is fetched once, cached (default 20 minutes), and shared across the query tools, so calling several tools for the same query costs a single upstream fetch. There is no LLM in the analysis path, so no per-call model cost. Reddit API credentials are required in practice and add no extra Apify cost.

## Tips

- **Start with `get_sentiment_summary`** for the headline, then call a detail tool only when you need it — the query tools share the same cached payload.
- **Raise `cacheTtlMinutes`** when batching many queries to minimize Reddit API calls; lower it when you need fresh reads.
- **Set credentials as environment variables** (`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`) on the Actor so they persist across Standby restarts.
- **Narrow `subreddits`** per call to focus on a specific community, or widen `windowDays` (up to 90) to capture a steadier baseline.

## How it works

1. An MCP client sends a tool call (e.g. `get_sentiment_summary`) with a `query`.
2. The server checks an in-memory LRU + TTL cache. On a miss, it makes one application-only OAuth request to Reddit, fetches a single search (or `top`) payload, and caches the raw posts.
3. Pure analysis functions score sentiment (lexicon + negation/intensifier/emoji rules), aggregate it, extract themes, mine feature-request cues, and rank — with no further network calls.
4. The matched window is filtered to the exact day count, and the tool's structured result — aggregates plus raw items plus `fetchedAt` — is returned to the MCP client.

All analysis is deterministic and clock-injected (testable without network). Transient Reddit errors (network blips, 5xx) are retried with bounded backoff; rate limits (429) surface a `resetAt` for the caller to handle.

## Works well with

Part of a small slate of agent-focused Apify Actors:

- **[GitHub Repo Intelligence MCP](https://apify.com/joeslade/github-repo-intelligence-mcp)** — opinionated maintainability verdicts for any GitHub repo across five MCP tools.
- **[SERP Topic Gap Monitor](https://apify.com/joeslade/serp-topic-gap-monitor)** — finds topic gaps in search-result coverage and produces scored gap reports.
- **[Docs MCP Server](https://apify.com/joeslade/docs-mcp-server-starter)** — an MCP server giving AI assistants queryable access to framework documentation.

## FAQ and support

**Do I need a Reddit account or user login?**
No. The Actor uses application-only OAuth (`client_credentials`) and reads public subreddits only. You need a Reddit app's client ID and secret, not account access.

**Is the sentiment from an LLM?**
No. Sentiment is a transparent lexicon-plus-rules scorer (negation, intensifiers, emoji, VADER-style normalization). There is no model in the analysis layer, which is what makes every call deterministic and auditable.

**Why did a tool return a credential error?**
Add `redditClientId` and `redditClientSecret`. See [Input](#input). Creating a Reddit script app takes under a minute at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps).

**Is the output stable?**
Yes. Same posts plus same config always yield the same aggregates, and the raw matched items are returned alongside so you can audit every number.

**The Actor returned a rate-limit message — what do I do?**
Reddit rate limits (429) surface a `resetAt` timestamp; retry after it. Raising `cacheTtlMinutes` reduces upstream calls when batching.

**Found a bug or want a feature?**
Open an issue on the Actor's **Issues** tab. Custom variations are available on request.

## Acknowledgements

The sentiment lexicon is expanded from [VADER](https://github.com/cjhutto/vaderSentiment) (Hutto, C.J. & Gilbert, E.E., 2014), used under its MIT license.

## License

Copyright © 2026 Joe Slade.

Licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). You're free to use, study, modify, and self-host this software; if you run a modified version as a network service, the AGPL requires you to offer your modified source to its users under the same license. For a commercial license not subject to the AGPL's network-copyleft, contact the author.
