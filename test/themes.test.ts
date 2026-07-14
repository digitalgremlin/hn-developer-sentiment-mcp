import { describe, it, expect } from "vitest";
import { extractThemes } from "../src/themes.js";

describe("extractThemes", () => {
  it("ranks unigrams/bigrams excluding stopwords and query terms", () => {
    const texts = [
      "type safety is great in this language",
      "the type safety really helps",
      "documentation could be better",
    ];
    const themes = extractThemes(texts, "language", 5);
    const terms = themes.map((t) => t.term);
    expect(terms).toContain("type safety");
    expect(terms).not.toContain("language"); // query term removed
    expect(themes[0].count).toBeGreaterThanOrEqual(themes[themes.length - 1].count); // desc
  });
});
