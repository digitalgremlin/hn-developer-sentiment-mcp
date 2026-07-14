import { describe, it, expect } from "vitest";
import { buildTrending } from "../src/tools/getTrendingDiscussions.js";
import { normalizeHits } from "../src/hnClient.js";
import positive from "./fixtures/positive.json";

describe("buildTrending", () => {
  it("ranks by engagement and exposes the engagement key", () => {
    const posts = normalizeHits(positive);
    const out = buildTrending(["webdev", "devops"], 7, 25, posts, "2026-01-01T00:00:00.000Z");
    const eng = out.items.map((i) => i.engagement);
    expect(eng).toEqual([...eng].sort((a, b) => b - a));
    expect(out.items[0].engagement).toBe(out.items[0].score + out.items[0].numComments);
  });
});
