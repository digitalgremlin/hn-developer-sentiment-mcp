import { scorePost } from './scorePost.js';
import { byEngagement } from '../ranking.js';
import type { RawPost } from '../types.js';

export function buildTrending(
  subreddits: string[],
  windowDays: number,
  limit: number,
  posts: RawPost[],
  fetchedAt: string,
) {
  const items = [...posts].sort(byEngagement).slice(0, limit).map((p) => {
    const s = scorePost(p);
    return {
      id: s.id,
      title: s.title,
      subreddit: s.subreddit,
      score: s.score,
      numComments: s.numComments,
      engagement: s.score + s.numComments,
      url: s.url,
      createdAt: s.createdAt,
      sentiment: s.sentiment,
    };
  });

  return { subredditsQueried: subreddits, windowDays, count: items.length, items, fetchedAt };
}
