import { describe, it, expect } from "vitest";
import { parseConfig, withEnvCredentials, ConfigError } from "../src/config.js";

describe("parseConfig", () => {
  it("applies defaults and requires creds", () => {
    const c = parseConfig({ redditClientId: "id", redditClientSecret: "sec" });
    expect(c.defaultSubreddits).toEqual(["programming", "webdev", "devops", "machinelearning"]);
    expect(c).toMatchObject({ windowDays: 30, cacheTtlMinutes: 20, maxItems: 100 });
  });
  it("throws when credentials missing", () => {
    expect(() => parseConfig({})).toThrow(ConfigError);
  });
  it("validates numeric ranges", () => {
    expect(() => parseConfig({ redditClientId: "a", redditClientSecret: "b", maxItems: 9 })).toThrow(ConfigError);
  });
});

describe("withEnvCredentials", () => {
  it("fills missing creds from REDDIT_CLIENT_ID/SECRET env vars (Standby boots with no input)", () => {
    const merged = withEnvCredentials({}, { REDDIT_CLIENT_ID: "env-id", REDDIT_CLIENT_SECRET: "env-sec" });
    expect(merged).toMatchObject({ redditClientId: "env-id", redditClientSecret: "env-sec" });
    // and the merged result must be usable by parseConfig
    expect(parseConfig(merged).redditClientId).toBe("env-id");
  });

  it("lets input creds take precedence over env vars", () => {
    const merged = withEnvCredentials(
      { redditClientId: "input-id", redditClientSecret: "input-sec" },
      { REDDIT_CLIENT_ID: "env-id", REDDIT_CLIENT_SECRET: "env-sec" },
    );
    expect(merged).toMatchObject({ redditClientId: "input-id", redditClientSecret: "input-sec" });
  });

  it("fills only the credential that input is missing", () => {
    const merged = withEnvCredentials(
      { redditClientId: "input-id" },
      { REDDIT_CLIENT_ID: "env-id", REDDIT_CLIENT_SECRET: "env-sec" },
    );
    expect(merged).toMatchObject({ redditClientId: "input-id", redditClientSecret: "env-sec" });
  });

  it("does not inject creds when env vars are absent or empty (parseConfig still throws)", () => {
    const merged = withEnvCredentials({}, { REDDIT_CLIENT_ID: "", REDDIT_CLIENT_SECRET: undefined });
    expect(merged.redditClientId).toBeUndefined();
    expect(() => parseConfig(merged)).toThrow(ConfigError);
  });

  it("preserves other input fields untouched", () => {
    const merged = withEnvCredentials({ windowDays: 7, defaultSubreddits: ["rust"] }, { REDDIT_CLIENT_ID: "env-id", REDDIT_CLIENT_SECRET: "env-sec" });
    expect(merged).toMatchObject({ windowDays: 7, defaultSubreddits: ["rust"], redditClientId: "env-id", redditClientSecret: "env-sec" });
  });
});
