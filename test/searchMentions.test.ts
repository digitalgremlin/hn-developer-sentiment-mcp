import { describe, it, expect } from "vitest";
import { buildSearchMentions } from "../src/tools/searchMentions.js";
import { normalizeListing } from "../src/redditClient.js";
import positive from "./fixtures/positive.json";

describe("buildSearchMentions", () => {
  it("returns scored items ordered by rank with excerpt ≤ 280 chars", () => {
    const posts = normalizeListing(positive);
    const out = buildSearchMentions("react", ["webdev"], 30, 50, posts, "2026-01-01T00:00:00.000Z");
    expect(out.count).toBe(posts.length);
    expect(out.items[0].sentimentScore).toBeTypeOf("number");
    for (const it of out.items) expect(it.excerpt.length).toBeLessThanOrEqual(280);
    const scores = out.items.map((i) => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a)); // score desc dominant
  });
});
