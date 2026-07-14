import { labelFor } from "./sentiment.js";
import type { SentimentLabel } from "./types.js";

export interface SentimentAggregate {
  netSentiment: number;
  sentimentLabel: SentimentLabel;
  breakdown: { positive: number; neutral: number; negative: number };
}

export function aggregateSentiment(scores: number[]): SentimentAggregate {
  const breakdown = { positive: 0, neutral: 0, negative: 0 };
  let total = 0;

  for (const score of scores) {
    total += score;
    const label = labelFor(score);
    if (label === "Positive") breakdown.positive += 1;
    else if (label === "Negative") breakdown.negative += 1;
    else breakdown.neutral += 1;
  }

  const netSentiment = scores.length === 0 ? 0 : total / scores.length;
  return { netSentiment, sentimentLabel: labelFor(netSentiment), breakdown };
}
