import { labelFor, scoreText } from "../sentiment.js";
import type { RawPost, ScoredPost } from "../types.js";

export function scorePost(p: RawPost): ScoredPost {
  const sentimentScore = scoreText(`${p.title}. ${p.selftext}`);

  return {
    ...p,
    sentimentScore,
    sentiment: labelFor(sentimentScore),
    url: `https://news.ycombinator.com${p.permalink}`,
    createdAt: new Date(p.createdUtc * 1000).toISOString(),
  };
}
