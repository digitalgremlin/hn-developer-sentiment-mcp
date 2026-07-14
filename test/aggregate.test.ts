import { describe, it, expect } from "vitest";
import { aggregateSentiment } from "../src/aggregate.js";

describe("aggregateSentiment", () => {
  it("computes mean and breakdown", () => {
    const r = aggregateSentiment([0.6, 0.0, -0.6, 0.6]);
    expect(r.netSentiment).toBeCloseTo(0.15, 5);
    expect(r.breakdown).toEqual({ positive: 2, neutral: 1, negative: 1 });
    expect(r.sentimentLabel).toBe("Positive");
  });
  it("handles empty input", () => {
    const r = aggregateSentiment([]);
    expect(r.netSentiment).toBe(0);
    expect(r.breakdown).toEqual({ positive: 0, neutral: 0, negative: 0 });
    expect(r.sentimentLabel).toBe("Neutral");
  });
});
