import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeHits, channelTags, HnClient, decodeHnText, matchesQuery, queryTokens } from "../src/hnClient.js";

describe("decodeHnText", () => {
  it("strips HTML tags and decodes hex/named entities", () => {
    const out = decodeHnText("<p>path&#x2F;to&#x2F;file and &quot;quotes&quot; &amp; tags</p>");
    expect(out).toBe('path/to/file and "quotes" & tags');
    expect(out).not.toContain("x2f");
    expect(out).not.toContain("<");
  });
});

describe("channelTags", () => {
  it("passes a single tag bare and OR-groups multiple", () => {
    expect(channelTags(["ask_hn"])).toBe("ask_hn");
    expect(channelTags(["story", "comment"])).toBe("(story,comment)");
  });
});

describe("normalizeHits", () => {
  it("maps a story hit to a RawPost", () => {
    const [p] = normalizeHits({
      hits: [{ objectID: "1", title: "Prisma 6 is great", points: 312, num_comments: 88,
        created_at_i: 1750000000, _tags: ["story", "author_x"] }],
    });
    expect(p).toMatchObject({ id: "1", title: "Prisma 6 is great", channel: "story", score: 312,
      numComments: 88, permalink: "/item?id=1", createdUtc: 1750000000, selftext: "" });
  });

  it("maps a comment hit (no title; text from comment_text; numComments 0)", () => {
    const [p] = normalizeHits({
      hits: [{ objectID: "2", title: null, comment_text: "migrations are painless now",
        points: null, created_at_i: 1750000100, _tags: ["comment", "author_y", "story_1"] }],
    });
    expect(p).toMatchObject({ title: "", selftext: "migrations are painless now", channel: "comment",
      score: 0, numComments: 0 });
  });

  it("gives ask_hn/show_hn precedence over the story tag", () => {
    const [ask] = normalizeHits({ hits: [{ objectID: "3", title: "Ask HN: best ORM?", created_at_i: 1, _tags: ["story", "ask_hn"] }] });
    const [show] = normalizeHits({ hits: [{ objectID: "4", title: "Show HN: my tool", created_at_i: 1, _tags: ["story", "show_hn"] }] });
    expect(ask.channel).toBe("ask_hn");
    expect(show.channel).toBe("show_hn");
  });

  it("round-trips the real captured Algolia fixture", () => {
    const j = JSON.parse(readFileSync(new URL("./fixtures/hn-algolia-sample.json", import.meta.url), "utf8"));
    const posts = normalizeHits(j);
    expect(posts.length).toBeGreaterThan(0);
    for (const p of posts) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.createdUtc).toBe("number");
      expect(["story", "ask_hn", "show_hn", "comment"]).toContain(p.channel);
    }
  });
});

describe("matchesQuery / queryTokens", () => {
  it("keeps whole-word mentions and rejects prefix/typo look-alikes", () => {
    const m = (title: string) => matchesQuery({ title, selftext: "" }, "prisma");
    expect(m("Prisma 6 is great")).toBe(true);
    expect(m("we migrated to prisma last week")).toBe(true);
    expect(m("prisma's migrations")).toBe(true);
    expect(m("The primary purpose of code review")).toBe(false);
    expect(m("Primate is the last web framework")).toBe(false);
    expect(m("Prismata confines prompt injection")).toBe(false);
  });

  it("matches a query term found in the body, not just the title", () => {
    expect(matchesQuery({ title: "Ask HN: best ORM?", selftext: "I like prisma" }, "prisma")).toBe(true);
  });

  it("requires every token of a multi-word query to appear", () => {
    expect(matchesQuery({ title: "GitHub Copilot autocompletes tests", selftext: "" }, "github copilot")).toBe(true);
    expect(matchesQuery({ title: "GitHub Actions is down", selftext: "" }, "github copilot")).toBe(false);
  });

  it("leaves pathological single-char queries unfiltered rather than zeroing them", () => {
    expect(queryTokens("c")).toEqual([]);
    expect(matchesQuery({ title: "anything at all", selftext: "" }, "c")).toBe(true);
  });
});

describe("HnClient (injected fetch — no network)", () => {
  const okResponse = (hits: unknown[]) => ({
    ok: true, status: 200, json: async () => ({ hits }),
  }) as unknown as Response;

  it("search hits /search with query, tags, a time filter, and typoTolerance off", async () => {
    let calledUrl = "";
    const fetchFn = (async (url: string) => { calledUrl = url; return okResponse([{ objectID: "9", title: "Prisma 6 released", created_at_i: 5, _tags: ["story"] }]); }) as unknown as typeof fetch;
    const client = new HnClient({ fetchFn, clock: () => 1_000_000_000_000 });
    const posts = await client.search("prisma", ["story", "comment"], 30, 10);
    expect(posts).toHaveLength(1);
    expect(calledUrl).toContain("/search?");
    expect(calledUrl).toContain("query=prisma");
    expect(decodeURIComponent(calledUrl)).toContain("created_at_i>");
    expect(decodeURIComponent(calledUrl)).toContain("(story,comment)");
    expect(decodeURIComponent(calledUrl)).toContain("typoTolerance=false");
  });

  it("search drops Algolia typo/prefix false positives, keeping only real mentions", async () => {
    const hits = [
      { objectID: "1", title: "Prisma 6 ships typed SQL", created_at_i: 5, _tags: ["story"] },      // real
      { objectID: "2", title: "The primary purpose of code review", created_at_i: 5, _tags: ["story"] }, // "primary"
      { objectID: "3", title: "Primate Is the Last Great Web Framework", created_at_i: 5, _tags: ["story"] }, // "Primate"
      { objectID: "4", title: null, comment_text: "prisma migrations are painless", created_at_i: 5, _tags: ["comment"] }, // real (body)
      { objectID: "5", title: "Prismata: cross-site prompt injection", created_at_i: 5, _tags: ["story"] }, // "Prismata"
    ];
    const fetchFn = (async () => okResponse(hits)) as unknown as typeof fetch;
    const client = new HnClient({ fetchFn, clock: () => 1_000_000_000_000 });
    const posts = await client.search("prisma", ["story", "comment"], 30, 100);
    expect(posts.map((p) => p.id).sort()).toEqual(["1", "4"]);
  });

  it("top hits /search_by_date with story tag only", async () => {
    let calledUrl = "";
    const fetchFn = (async (url: string) => { calledUrl = url; return okResponse([]); }) as unknown as typeof fetch;
    const client = new HnClient({ fetchFn, clock: () => 1_000_000_000_000 });
    await client.top(7, 20);
    expect(calledUrl).toContain("/search_by_date?");
    expect(decodeURIComponent(calledUrl)).toContain("tags=story");
  });
});
