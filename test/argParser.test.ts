import { describe, it, expect } from "vitest";
import { parseQueryArgs, parseTrendingArgs, ArgError } from "../src/argParser.js";

const cfg = { defaultSubreddits: ["programming"], windowDays: 30, maxItems: 100 };

describe("parseQueryArgs", () => {
  it("normalizes subreddits and applies defaults", () => {
    const r = parseQueryArgs({ query: " react ", subreddits: ["r/WebDev", "DevOps"] }, cfg);
    expect(r).toEqual({ query: "react", subreddits: ["webdev", "devops"], windowDays: 30, limit: 100 });
  });
  it("rejects empty query", () => {
    expect(() => parseQueryArgs({ query: "   " }, cfg)).toThrow(ArgError);
  });
  it("clamps limit to maxItems and rejects out-of-range windowDays", () => {
    expect(parseQueryArgs({ query: "x", limit: 999 }, cfg).limit).toBe(100);
    expect(() => parseQueryArgs({ query: "x", windowDays: 0 }, cfg)).toThrow(ArgError);
    expect(() => parseQueryArgs({ query: "x", windowDays: 91 }, cfg)).toThrow(ArgError);
  });
});

describe("parseTrendingArgs", () => {
  it("does not require a query", () => {
    expect(parseTrendingArgs({}, cfg)).toEqual({ subreddits: ["programming"], windowDays: 30, limit: 100 });
  });
});
