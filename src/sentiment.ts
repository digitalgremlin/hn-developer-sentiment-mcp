import { EMOJI, INTENSIFIERS, LEXICON, NEGATIONS } from "./data/lexicon.js";
import type { SentimentLabel } from "./types.js";

const TOKEN_RE = /[a-z']+|:\)|:\(|[\u{1F300}-\u{1FAFF}☀-➿]/gu;

export function scoreText(text: string): number {
  if (text.trim() === "") return 0;

  const tokens = text.toLowerCase().match(TOKEN_RE) ?? [];
  let sum = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    let valence = LEXICON[token] ?? EMOJI[token] ?? 0;
    if (valence === 0) continue;

    const previous = tokens[i - 1];
    if (previous !== undefined && previous in INTENSIFIERS) {
      valence += Math.sign(valence) * INTENSIFIERS[previous] * 4;
    }

    const start = Math.max(0, i - 3);
    for (let j = start; j < i; j += 1) {
      if (NEGATIONS.has(tokens[j])) {
        valence *= -0.74;
        break;
      }
    }

    sum += valence;
  }

  return sum / Math.sqrt(sum * sum + 15);
}

export function labelFor(compound: number): SentimentLabel {
  if (compound >= 0.05) return "Positive";
  if (compound <= -0.05) return "Negative";
  return "Neutral";
}
