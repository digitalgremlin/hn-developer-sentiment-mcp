import type { CueCategory } from "../types.js";
// Priority order = array order (earlier wins when multiple match).
export const CUES: { category: CueCategory; patterns: RegExp[] }[] = [
  { category: "request",   patterns: [/please add/i, /feature request/i, /can you add/i, /would love (?:to see|if)/i] },
  { category: "wish",      patterns: [/i wish it (?:could|had|would)/i, /wish it (?:could|had|would)/i, /it would be (?:nice|great) if/i] },
  { category: "missing",   patterns: [/doesn'?t support/i, /no way to/i, /lacks? /i, /missing (?:a |the )?/i] },
  { category: "plans",     patterns: [/any plans to/i, /roadmap for/i, /will it ever/i] },
  { category: "painpoint", patterns: [/hate that/i, /so frustrating/i, /keeps breaking/i, /drives me crazy/i] },
];
