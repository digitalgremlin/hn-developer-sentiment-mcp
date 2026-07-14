import { describe, it, expect } from "vitest";
import { buildSentimentSummary } from "../src/tools/getSentimentSummary.js";
import { normalizeHits } from "../src/hnClient.js";
import positive from "./fixtures/positive.json";

describe("buildSentimentSummary", () => {
  it("aggregates sentiment, themes, and samples deterministically", () => {
    const posts = normalizeHits(positive);
    const out = buildSentimentSummary("react", ["webdev"], 30, posts, "2026-01-01T00:00:00.000Z");
    expect(out.query).toBe("react");
    expect(out.mentionVolume).toBe(posts.length);
    expect(out.sentimentLabel).toBe("Positive");
    expect(out.breakdown.positive).toBeGreaterThan(0);
    expect(out.topSamples.length).toBeLessThanOrEqual(3);
    expect(out.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
