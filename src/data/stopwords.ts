export const STOPWORDS = new Set([
  "the","a","an","and","or","but","is","are","was","were","be","to","of","in","on","for","with","it","this","that",
  "i","you","we","they","my","your","our","at","as","by","from","so","just","like","really","also","get","got",
  "use","using","used","one","would","could","should","can","im","ive","dont","thing","things","way",
  // High-frequency function words that surfaced as false "themes" in live output.
  "not","no","have","has","had","all","if","about","how","what","why","when","where","who","which",
  "do","does","did","will","wont","them","they","their","there","then","than","been","being","into",
  "onto","over","only","very","out","up","down","off","more","most","some","any","such","same","other",
  "its","his","her","he","she","him","us","me","am","our","your","because","while","after","before",
  // HN-structural + contraction noise that leaked as "themes" in live output (0.1.3).
  "hn","it's","yes","show","ask","dont","doesnt","isnt","that's","don't","doesn't","isn't",
]);
