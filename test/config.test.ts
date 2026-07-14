import { describe, it, expect } from "vitest";
import { parseConfig, ConfigError } from "../src/config.js";

describe("parseConfig", () => {
  it("applies defaults with no input (open API — no credentials required)", () => {
    const c = parseConfig({});
    expect(c.defaultChannels).toEqual(["story", "ask_hn", "show_hn", "comment"]);
    expect(c).toMatchObject({ windowDays: 30, cacheTtlMinutes: 20, maxItems: 100 });
  });
  it("accepts a custom channel subset", () => {
    expect(parseConfig({ defaultChannels: ["story", "comment"] }).defaultChannels).toEqual(["story", "comment"]);
  });
  it("rejects an invalid channel", () => {
    expect(() => parseConfig({ defaultChannels: ["subreddit"] })).toThrow(ConfigError);
  });
  it("rejects an empty channel array", () => {
    expect(() => parseConfig({ defaultChannels: [] })).toThrow(ConfigError);
  });
  it("validates numeric ranges", () => {
    expect(() => parseConfig({ maxItems: 9 })).toThrow(ConfigError);
    expect(() => parseConfig({ windowDays: 91 })).toThrow(ConfigError);
  });
});
