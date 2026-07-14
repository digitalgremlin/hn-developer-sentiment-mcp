import { describe, it, expect } from "vitest";
import { buildFeatureRequests } from "../src/tools/getFeatureRequests.js";
import { normalizeListing } from "../src/redditClient.js";
import fr from "./fixtures/feature-requests.json";

describe("buildFeatureRequests", () => {
  it("returns only cue-matching posts grouped by category", () => {
    const posts = normalizeListing(fr);
    const out = buildFeatureRequests("widget", ["programming"], 30, 50, posts, "2026-01-01T00:00:00.000Z");
    expect(out.count).toBeGreaterThan(0);
    expect(out.count).toBeLessThanOrEqual(posts.length);
    for (const it of out.items) expect(it.cueCategory).toBeDefined();
    const sum = Object.values(out.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(out.count);
  });
});
