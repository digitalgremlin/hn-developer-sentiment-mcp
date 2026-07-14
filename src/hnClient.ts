import type { RawPost, HnChannel } from "./types.js";

const BASE = "https://hn.algolia.com/api/v1";

export class HnRateLimitError extends Error {
  constructor(public resetAt: string) { super("rate limited"); }
}
export class HnHttpError extends Error {
  constructor(public status: number) { super(`HN request failed (${status})`); }
}

interface HnClientOptions {
  fetchFn?: typeof fetch;
  clock?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

// Algolia tag group. A single tag is passed bare; multiple are OR'd with (a,b).
export function channelTags(channels: HnChannel[]): string {
  return channels.length === 1 ? channels[0] : `(${channels.join(",")})`;
}

// HN Algolia text is HTML-ish: <p>/<a>/<i>/<pre> tags and hex/decimal entities
// (&#x2F; &#x27; &gt; ...). Reddit selftext was plain, so the engine assumed clean
// prose; strip tags + decode entities here so themes/sentiment see real words.
export function decodeHnText(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&amp;/gi, "&")
    .replace(/https?:\/\/\S+/g, " ") // after entity decode: HN encodes URL slashes as &#x2F;
    .replace(/\s+/g, " ")
    .trim();
}

function deriveChannel(tags: unknown): string {
  const t = Array.isArray(tags) ? tags : [];
  if (t.includes("ask_hn")) return "ask_hn";
  if (t.includes("show_hn")) return "show_hn";
  if (t.includes("comment")) return "comment";
  return "story";
}

// Algolia search response -> RawPost[]. Comments carry text but no title;
// stories carry a title and optional story_text (Ask HN self text).
export function normalizeHits(json: unknown): RawPost[] {
  const hits = (json as { hits?: unknown[] } | null)?.hits ?? [];
  return (hits as Record<string, unknown>[]).map((h) => ({
    id: String(h.objectID),
    title: decodeHnText((h.title as string) ?? ""),
    selftext: decodeHnText((h.story_text as string) ?? (h.comment_text as string) ?? ""),
    channel: deriveChannel(h._tags),
    score: (h.points as number) ?? 0,
    numComments: (h.num_comments as number) ?? 0,
    permalink: `/item?id=${h.objectID}`,
    createdUtc: (h.created_at_i as number) ?? 0,
  }));
}

export class HnClient {
  private readonly fetchFn: typeof fetch;
  private readonly clock: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(opts: HnClientOptions = {}) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.clock = opts.clock ?? (() => Date.now());
    this.sleepFn = opts.sleepFn ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRetries ?? 2;
  }

  private backoffMs(attempt: number): number { return 250 * 2 ** attempt; }

  private async fetchWithRetry(url: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await this.fetchFn(url);
        if (res.status >= 500 && attempt < this.maxRetries) { await this.sleepFn(this.backoffMs(attempt)); continue; }
        return res;
      } catch (err) {
        if (attempt < this.maxRetries) { await this.sleepFn(this.backoffMs(attempt)); continue; }
        throw err;
      }
    }
  }

  private async getJson(url: string): Promise<unknown> {
    const res = await this.fetchWithRetry(url);
    if (res.status === 429) throw new HnRateLimitError(new Date(this.clock() + 60000).toISOString());
    if (!res.ok) throw new HnHttpError(res.status);
    return res.json();
  }

  private url(path: string, params: Record<string, string>): string {
    const u = new URL(`${BASE}/${path}`);
    u.search = new URLSearchParams(params).toString();
    return u.toString();
  }

  private sinceParam(windowDays: number): string {
    const since = Math.floor(this.clock() / 1000) - windowDays * 86400;
    return `created_at_i>${since}`;
  }

  // Relevance search across the selected channels (stories + comments by default).
  async search(query: string, channels: HnChannel[], windowDays: number, limit: number): Promise<RawPost[]> {
    return normalizeHits(await this.getJson(this.url("search", {
      query,
      tags: channelTags(channels),
      numericFilters: this.sinceParam(windowDays),
      hitsPerPage: String(Math.min(limit, 1000)),
    })));
  }

  // Recent stories only (trending is story-level; ranking.ts sorts by engagement).
  async top(windowDays: number, limit: number): Promise<RawPost[]> {
    return normalizeHits(await this.getJson(this.url("search_by_date", {
      tags: "story",
      numericFilters: this.sinceParam(windowDays),
      hitsPerPage: String(Math.min(limit, 1000)),
    })));
  }
}
