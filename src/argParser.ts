import type { HnChannel } from "./types.js";
import { CHANNELS } from "./config.js";

interface ArgConfig {
  defaultChannels: HnChannel[];
  windowDays: number;
  maxItems: number;
}

export class ArgError extends Error {}

function parseChannels(args: Record<string, unknown>, cfg: ArgConfig): HnChannel[] {
  const { channels } = args;
  if (channels === undefined) return [...cfg.defaultChannels];
  if (!Array.isArray(channels) || !channels.every((item) => typeof item === "string")) {
    throw new ArgError("channels must be an array of strings");
  }
  if (channels.length < 1 || channels.length > 4) {
    throw new ArgError("channels must include 1 to 4 entries");
  }
  for (const c of channels) {
    if (!CHANNELS.includes(c as HnChannel)) {
      throw new ArgError(`invalid channel: ${c} (allowed: ${CHANNELS.join(", ")})`);
    }
  }
  return channels as HnChannel[];
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
    channels: parseChannels(args, cfg),
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
