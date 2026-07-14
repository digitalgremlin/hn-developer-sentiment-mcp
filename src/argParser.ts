interface ArgConfig {
  defaultSubreddits: string[];
  windowDays: number;
  maxItems: number;
}

export class ArgError extends Error {}

function normalizeSubreddit(value: string): string {
  return value.trim().replace(/^\/?r\//i, "").trim().toLowerCase();
}

function parseSubreddits(args: Record<string, unknown>, cfg: ArgConfig): string[] {
  const { subreddits } = args;
  if (subreddits === undefined) return [...cfg.defaultSubreddits];
  if (!Array.isArray(subreddits) || !subreddits.every((item) => typeof item === "string")) {
    throw new ArgError("subreddits must be an array of strings");
  }

  const normalized = subreddits.map(normalizeSubreddit).filter((item) => item.length > 0);
  if (normalized.length < 1 || normalized.length > 25) {
    throw new ArgError("subreddits must include 1 to 25 entries");
  }
  return normalized;
}

function parseWindowDays(args: Record<string, unknown>, cfg: ArgConfig): number {
  const { windowDays } = args;
  if (windowDays === undefined) return cfg.windowDays;
  if (typeof windowDays !== "number" || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 90) {
    throw new ArgError("windowDays must be an integer from 1 to 90");
  }
  return windowDays;
}

function parseLimit(args: Record<string, unknown>, cfg: ArgConfig): number {
  const { limit } = args;
  if (limit === undefined) return cfg.maxItems;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
    throw new ArgError("limit must be a positive integer");
  }
  return Math.min(limit, cfg.maxItems);
}

function parseBaseArgs(args: Record<string, unknown>, cfg: ArgConfig) {
  return {
    subreddits: parseSubreddits(args, cfg),
    windowDays: parseWindowDays(args, cfg),
    limit: parseLimit(args, cfg),
  };
}

export function parseQueryArgs(args: Record<string, unknown>, cfg: ArgConfig) {
  const { query } = args;
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new ArgError("query must be a non-empty string");
  }
  return { query: query.trim(), ...parseBaseArgs(args, cfg) };
}

export function parseTrendingArgs(args: Record<string, unknown>, cfg: ArgConfig) {
  return parseBaseArgs(args, cfg);
}
