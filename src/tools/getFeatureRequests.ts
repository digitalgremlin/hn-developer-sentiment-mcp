import { mineCues } from '../cueMiner.js';
import { byMentionRank } from '../ranking.js';
import type { CueCategory, RawPost } from '../types.js';

type MinedCue = NonNullable<ReturnType<typeof mineCues>>;

function hasCue(entry: { p: RawPost; cue: MinedCue | null }): entry is { p: RawPost; cue: MinedCue } {
  return entry.cue !== null;
}

export function buildFeatureRequests(
  query: string,
  channels: string[],
  windowDays: number,
  limit: number,
  posts: RawPost[],
  fetchedAt: string,
) {
  const byCategory: Record<CueCategory, number> = { wish: 0, missing: 0, request: 0, plans: 0, painpoint: 0 };
  const items = [...posts]
    .sort(byMentionRank)
    .map((p) => ({ p, cue: mineCues(`${p.title}. ${p.selftext}`) }))
    .filter(hasCue)
    .slice(0, limit)
    .map(({ p, cue }) => {
      byCategory[cue.cueCategory] += 1;

      return {
        id: p.id,
        title: p.title,
        excerpt: cue.snippet,
        cueCategory: cue.cueCategory,
        channel: p.channel,
        score: p.score,
        url: `https://news.ycombinator.com${p.permalink}`,
        createdAt: new Date(p.createdUtc * 1000).toISOString(),
      };
    });

  return { query, channelsQueried: channels, windowDays, count: items.length, items, byCategory, fetchedAt };
}
