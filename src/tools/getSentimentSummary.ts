import { scorePost } from './scorePost.js';
import { aggregateSentiment } from '../aggregate.js';
import { extractThemes } from '../themes.js';
import { byEngagement } from '../ranking.js';
import type { RawPost } from '../types.js';

export function buildSentimentSummary(
  query: string,
  subreddits: string[],
  windowDays: number,
  posts: RawPost[],
  fetchedAt: string,
) {
  const scored = posts.map(scorePost);
  const agg = aggregateSentiment(scored.map((s) => s.sentimentScore));
  const themes = extractThemes(scored.map((s) => s.title + '. ' + s.selftext), query, 8);
  const topSamples = [...scored].sort(byEngagement).slice(0, 3).map((s) => ({
    title: s.title,
    subreddit: s.subreddit,
    score: s.score,
    url: s.url,
    createdAt: s.createdAt,
    sentiment: s.sentiment,
  }));

  return {
    query,
    subredditsQueried: subreddits,
    windowDays,
    mentionVolume: scored.length,
    netSentiment: agg.netSentiment,
    sentimentLabel: agg.sentimentLabel,
    breakdown: agg.breakdown,
    topThemes: themes,
    topSamples,
    fetchedAt,
  };
}
