import { describe, it, expect } from "vitest";
import { scorePost } from "../src/tools/scorePost.js";

describe("scorePost", () => {
  it("attaches sentiment, absolute url, and ISO date", () => {
    const raw = { id: "t3_a", title: "great lib", selftext: "really reliable", channel: "webdev",
      score: 5, numComments: 2, permalink: "/r/webdev/comments/a/x/", createdUtc: 1000 };
    const s = scorePost(raw);
    expect(s.sentiment).toBe("Positive");
    expect(s.url).toBe("https://news.ycombinator.com/r/webdev/comments/a/x/");
    expect(s.createdAt).toBe(new Date(1000 * 1000).toISOString());
  });
});
