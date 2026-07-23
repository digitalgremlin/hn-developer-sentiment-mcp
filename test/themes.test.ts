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

  it("filters HN-structural + contraction noise (0.1.3) but keeps real themes", () => {
    const texts = [
      "Show HN: I built a docker tool. Yes it's great, ask HN what you think.",
      "docker and kubernetes work well. It's the docker workflow that wins.",
      "Ask HN: best docker setup? Show HN posts say docker.",
    ];
    const terms = extractThemes(texts, "kubernetes", 8).map((t) => t.term);
    expect(terms).toContain("docker"); // real theme survives
    for (const noise of ["show", "hn", "ask", "yes", "it's"]) {
      expect(terms).not.toContain(noise);
    }
  });
});
