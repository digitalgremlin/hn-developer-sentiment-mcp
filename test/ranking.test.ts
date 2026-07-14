import { describe, it, expect } from "vitest";
import { byMentionRank, byEngagement } from "../src/ranking.js";

const mk = (id: string, score: number, createdUtc: number, numComments = 0) =>
  ({ id, score, createdUtc, numComments } as any);

describe("byMentionRank", () => {
  it("sorts by score desc, then createdUtc desc, then id asc", () => {
    const items = [mk("b", 10, 100), mk("a", 10, 100), mk("c", 5, 200)];
    expect([...items].sort(byMentionRank).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("byEngagement", () => {
  it("sorts by score+numComments desc, then id asc", () => {
    const items = [mk("a", 10, 0, 5), mk("b", 20, 0, 0), mk("c", 1, 0, 100)];
    expect([...items].sort(byEngagement).map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
});
