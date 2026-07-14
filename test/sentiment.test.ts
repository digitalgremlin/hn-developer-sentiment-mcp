import { describe, it, expect } from "vitest";
import { scoreText, labelFor } from "../src/sentiment.js";

describe("scoreText", () => {
  it("scores positive, negative, and neutral text", () => {
    expect(scoreText("this is great and reliable")).toBeGreaterThan(0.05);
    expect(scoreText("terrible and buggy")).toBeLessThan(-0.05);
    expect(Math.abs(scoreText("the build runs on tuesday"))).toBeLessThanOrEqual(0.05);
  });
  it("handles negation and intensifiers", () => {
    expect(scoreText("not good")).toBeLessThan(0);
    expect(scoreText("really great")).toBeGreaterThan(scoreText("great"));
  });
  it("returns 0 for empty text", () => {
    expect(scoreText("")).toBe(0);
  });
});

describe("labelFor", () => {
  it("buckets at ±0.05", () => {
    expect(labelFor(0.05)).toBe("Positive");
    expect(labelFor(-0.05)).toBe("Negative");
    expect(labelFor(0.04)).toBe("Neutral");
  });
});
