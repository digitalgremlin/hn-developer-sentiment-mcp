import { scorePost } from './scorePost.js';
import { byMentionRank } from '../ranking.js';
import type { RawPost } from '../types.js';

export function buildSearchMentions(
  query: string,
  channels: string[],
  windowDays: number,
  limit: number,
  posts: RawPost[],
  fetchedAt: string,
) {
  const items = [...posts].sort(byMentionRank).slice(0, limit).map((p) => {
    const s = scorePost(p);

    return {
      id: s.id,
      title: s.title,
      excerpt: s.selftext.slice(0, 280),
      channel: s.channel,
      score: s.score,
      numComments: s.numComments,
      url: s.url,
      createdAt: s.createdAt,
      sentiment: s.sentiment,
      sentimentScore: s.sentimentScore,
    };
  });

  return { query, channelsQueried: channels, windowDays, count: items.length, items, fetchedAt };
}
