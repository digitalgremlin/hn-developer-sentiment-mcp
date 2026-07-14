// Raw post as normalized from a Hacker News (Algolia) search hit.
export interface RawPost {
  id: string;             // Algolia objectID
  title: string;          // "" for comments
  selftext: string;       // story_text (Ask HN) / comment_text / ""
  channel: string;        // HN post type: story | ask_hn | show_hn | comment
  score: number;          // HN points
  numComments: number;    // 0 for comments
  permalink: string;      // "/item?id=..."
  createdUtc: number;     // epoch seconds (created_at_i)
}

export type SentimentLabel = "Positive" | "Neutral" | "Negative";

export interface ScoredPost extends RawPost {
  sentimentScore: number; // compound, [-1,1]
  sentiment: SentimentLabel;
  url: string;            // absolute https news.ycombinator.com url
  createdAt: string;      // ISO-8601 from createdUtc
}

export type CueCategory = "wish" | "missing" | "request" | "plans" | "painpoint";

export type HnChannel = "story" | "ask_hn" | "show_hn" | "comment";

export interface Config {
  defaultChannels: HnChannel[];
  windowDays: number;
  cacheTtlMinutes: number;
  maxItems: number;
}
