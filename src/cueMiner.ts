import { CUES } from "./data/cues.js";
import type { CueCategory } from "./types.js";

export function mineCues(text: string): { cueCategory: CueCategory; snippet: string } | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const { category, patterns } of CUES) {
    for (const sentence of sentences) {
      if (patterns.some((pattern) => pattern.test(sentence))) {
        return { cueCategory: category, snippet: sentence };
      }
    }
  }

  return null;
}
