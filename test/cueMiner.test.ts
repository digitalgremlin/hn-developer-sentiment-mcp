import { describe, it, expect } from "vitest";
import { mineCues } from "../src/cueMiner.js";

describe("mineCues", () => {
  it("returns highest-priority category and the matching snippet", () => {
    const r = mineCues("Love the tool. Please add dark mode. Also I wish it could export.");
    expect(r).not.toBeNull();
    expect(r!.cueCategory).toBe("request"); // request outranks wish
    expect(r!.snippet.toLowerCase()).toContain("please add dark mode");
  });
  it("returns null when no cue present", () => {
    expect(mineCues("This library is fast and reliable.")).toBeNull();
  });
});
