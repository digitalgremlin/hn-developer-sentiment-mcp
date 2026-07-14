import { describe, it, expect } from "vitest";
import { parseQueryArgs, parseTrendingArgs, ArgError } from "../src/argParser.js";
import type { HnChannel } from "../src/types.js";

const cfg = { defaultChannels: ["story", "comment"] as HnChannel[], windowDays: 30, maxItems: 100 };

describe("parseQueryArgs", () => {
  it("applies default channels and trims the query", () => {
    const r = parseQueryArgs({ query: " react " }, cfg);
    expect(r).toEqual({ query: "react", channels: ["story", "comment"], windowDays: 30, limit: 100 });
  });
  it("accepts an explicit channel list", () => {
    expect(parseQueryArgs({ query: "x", channels: ["ask_hn"] }, cfg).channels).toEqual(["ask_hn"]);
  });
  it("rejects an invalid channel", () => {
    expect(() => parseQueryArgs({ query: "x", channels: ["webdev"] }, cfg)).toThrow(ArgError);
  });
  it("rejects an empty query", () => {
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
    expect(parseTrendingArgs({}, cfg)).toEqual({ channels: ["story", "comment"], windowDays: 30, limit: 100 });
  });
});
