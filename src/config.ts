import type { Config, HnChannel } from "./types.js";

export class ConfigError extends Error {}

export const CHANNELS: HnChannel[] = ["story", "ask_hn", "show_hn", "comment"];

function intIn(value: unknown, def: number, lo: number, hi: number, name: string): number {
  if (value === undefined) return def;
  if (typeof value !== "number" || !Number.isInteger(value) || value < lo || value > hi) {
    throw new ConfigError(`${name} must be an integer ${lo}-${hi}`);
  }
  return value;
}

function parseChannels(value: unknown, def: HnChannel[]): HnChannel[] {
  if (value === undefined) return [...def];
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConfigError("defaultChannels must be a non-empty array");
  }
  const out = value.map((v) => String(v)) as HnChannel[];
  for (const c of out) {
    if (!CHANNELS.includes(c)) throw new ConfigError(`invalid channel: ${c}`);
  }
  return out;
}

// No credentials: the Algolia HN API is open, so the actor is useful on first boot.
export function parseConfig(input: Record<string, unknown>): Config {
  return {
    defaultChannels: parseChannels(input.defaultChannels, CHANNELS),
    windowDays: intIn(input.windowDays, 30, 1, 90, "windowDays"),
    cacheTtlMinutes: intIn(input.cacheTtlMinutes, 20, 1, 240, "cacheTtlMinutes"),
    maxItems: intIn(input.maxItems, 100, 10, 250, "maxItems"),
  };
}
