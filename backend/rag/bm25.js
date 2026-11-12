/**
 * Small in-process BM25 keyword index. The knowledge base is a few hundred
 * chunks at most, so this avoids spending one of the free Atlas cluster's
 * three search indexes on full-text search. Works for Hindi (Devanagari) too.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "is", "are", "with", "by",
  "at", "from", "as", "be", "this", "that", "it", "can", "i", "my", "me", "what", "which",
  "how", "do", "does", "should", "will", "any", "there", "about",
  "का", "की", "के", "है", "हैं", "में", "से", "को", "और", "क्या", "मैं", "मेरा", "मेरे", "पर", "भी", "कैसे",
]);

const tokenize = (text = "") =>
  text
    .toLowerCase()
    .normalize("NFC")
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));

class BM25Index {
  constructor(docs = [], { k1 = 1.4, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.docs = docs;
    this.termFreqs = docs.map((doc) => {
      const tf = new Map();
      for (const token of tokenize(`${doc.title} ${doc.title} ${doc.text}`)) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }
      return tf;
    });
    this.lengths = this.termFreqs.map((tf) => [...tf.values()].reduce((a, b) => a + b, 0));
    this.avgLength = this.lengths.reduce((a, b) => a + b, 0) / (docs.length || 1);
    this.docFreq = new Map();
    for (const tf of this.termFreqs) {
      for (const term of tf.keys()) this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
    }
  }

  idf(term) {
    const n = this.docs.length;
    const df = this.docFreq.get(term) || 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** Returns [{ doc, score }] sorted best first; only docs passing `filter`. */
  search(query, { limit = 10, filter = () => true } = {}) {
    const terms = [...new Set(tokenize(query))];
    if (terms.length === 0) return [];

    const results = [];
    this.docs.forEach((doc, i) => {
      if (!filter(doc)) return;
      const tf = this.termFreqs[i];
      let score = 0;
      for (const term of terms) {
        const freq = tf.get(term);
        if (!freq) continue;
        const norm = freq + this.k1 * (1 - this.b + (this.b * this.lengths[i]) / this.avgLength);
        score += this.idf(term) * ((freq * (this.k1 + 1)) / norm);
      }
      if (score > 0) results.push({ doc, score });
    });

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

module.exports = { BM25Index, tokenize };
