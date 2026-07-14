import type { RawPost } from "./types.js";

export const byMentionRank = (a: RawPost, b: RawPost): number =>
  b.score - a.score || b.createdUtc - a.createdUtc || a.id.localeCompare(b.id);

export const byEngagement = (a: RawPost, b: RawPost): number =>
  b.score + b.numComments - (a.score + a.numComments) || a.id.localeCompare(b.id);
