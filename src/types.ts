// Raw post as normalized from a Reddit listing child's `data`.
export interface RawPost {
  id: string;             // e.g. "t3_abc123"
  title: string;
  selftext: string;       // "" for link posts
  subreddit: string;      // lowercased, no "r/"
  score: number;
  numComments: number;
  permalink: string;      // "/r/.../comments/..."
  createdUtc: number;     // epoch seconds
}

export type SentimentLabel = "Positive" | "Neutral" | "Negative";

export interface ScoredPost extends RawPost {
  sentimentScore: number; // compound, [-1,1]
  sentiment: SentimentLabel;
  url: string;            // absolute https reddit url
  createdAt: string;      // ISO-8601 from createdUtc
}

export type CueCategory = "wish" | "missing" | "request" | "plans" | "painpoint";

export interface Config {
  redditClientId: string;
  redditClientSecret: string;
  defaultSubreddits: string[];
  windowDays: number;
  cacheTtlMinutes: number;
  maxItems: number;
}
