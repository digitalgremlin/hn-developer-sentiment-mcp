import type { Config } from "./types.js";

export class ConfigError extends Error {}
function intIn(value: unknown, def: number, lo: number, hi: number, name: string): number {
  if (value === undefined) return def;
  if (typeof value !== "number" || !Number.isInteger(value) || value < lo || value > hi) {
    throw new ConfigError(`${name} must be an integer ${lo}-${hi}`);
  }
  return value;
}

// Standby boots with no INPUT.json, so creds can't come from Actor input there.
// Overlay REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET env vars onto the input when input
// lacks them (input still wins), making the env-var path the schema description promises
// actually functional — and persistent across Standby restarts. Pure for testability.
export function withEnvCredentials(
  input: Record<string, unknown>,
  env: Record<string, string | undefined>,
): Record<string, unknown> {
  const out = { ...input };
  const fill = (key: "redditClientId" | "redditClientSecret", envName: string) => {
    if (typeof out[key] === "string" && (out[key] as string).length > 0) return;
    const v = env[envName];
    if (typeof v === "string" && v.length > 0) out[key] = v;
  };
  fill("redditClientId", "REDDIT_CLIENT_ID");
  fill("redditClientSecret", "REDDIT_CLIENT_SECRET");
  return out;
}

export function parseConfig(input: Record<string, unknown>): Config {
  const { redditClientId, redditClientSecret } = input;
  if (typeof redditClientId !== "string" || redditClientId.length === 0 ||
    typeof redditClientSecret !== "string" || redditClientSecret.length === 0) {
    throw new ConfigError("redditClientId and redditClientSecret are required");
  }

  const defaultSubreddits = Array.isArray(input.defaultSubreddits) && input.defaultSubreddits.length > 0
    ? input.defaultSubreddits.map((entry) => String(entry).trim().replace(/^\/?r\//i, "").toLowerCase()).filter(Boolean)
    : ["programming", "webdev", "devops", "machinelearning"];

  if (defaultSubreddits.length < 1 || defaultSubreddits.length > 25) {
    throw new ConfigError("defaultSubreddits must have 1 to 25 entries");
  }

  return {
    redditClientId,
    redditClientSecret,
    defaultSubreddits,
    windowDays: intIn(input.windowDays, 30, 1, 90, "windowDays"),
    cacheTtlMinutes: intIn(input.cacheTtlMinutes, 20, 1, 240, "cacheTtlMinutes"),
    maxItems: intIn(input.maxItems, 100, 10, 250, "maxItems"),
  };
}
