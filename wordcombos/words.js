// Dictionary loader + Boggle solver utilities.
// The package ships a JSON array that is already sorted alphabetically,
// which lets us do prefix pruning with a binary search (no giant prefix set).
import wordsRaw from 'an-array-of-english-words/index.json' with { type: 'json' };

// Lowercase, a-z only, length >= 3. The source is already sorted & lowercased,
// but we filter to be safe and keep it sorted.
export const WORDS = wordsRaw.filter((w) => w.length >= 3 && /^[a-z]+$/.test(w));
export const WORD_SET = new Set(WORDS);

// For prefix pruning we need the FULL sorted list (including 1-2 letter words
// would not matter, but we just reuse WORDS since prefixes of valid words of
// length>=3 are what we care about). WORDS is sorted ascending.
const SORTED = WORDS;

export function isWord(w) {
  return WORD_SET.has(w);
}

// Returns true if any dictionary word starts with `prefix`.
export function hasPrefix(prefix) {
  let lo = 0;
  let hi = SORTED.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (SORTED[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  const candidate = SORTED[lo];
  return candidate !== undefined && candidate.startsWith(prefix);
}

// Solve a Boggle-style grid. `cells` is an array of length size*size, each a
// lowercase string ("qu" allowed for the Q tile). Adjacency includes diagonals.
// Returns { words: Set, count, best } where best is the highest-scoring word.
export function solveGrid(cells, size, scoreFn) {
  const neighbors = buildNeighbors(size);
  const found = new Set();

  const dfs = (idx, used, path, prefix) => {
    const next = prefix + cells[idx];
    if (!hasPrefix(next)) return; // prune dead branches
    if (next.length >= 3 && WORD_SET.has(next)) found.add(next);
    used[idx] = true;
    for (const n of neighbors[idx]) {
      if (!used[n]) dfs(n, used, path, next);
    }
    used[idx] = false;
  };

  for (let i = 0; i < cells.length; i++) {
    dfs(i, new Array(cells.length).fill(false), [], '');
  }

  let best = null;
  let bestScore = -1;
  for (const w of found) {
    const s = scoreFn(w);
    if (s > bestScore || (s === bestScore && best && w.length > best.length)) {
      bestScore = s;
      best = w;
    }
  }
  return { words: found, count: found.size, best };
}

export function buildNeighbors(size) {
  const neighbors = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const list = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            list.push(nr * size + nc);
          }
        }
      }
      neighbors.push(list);
    }
  }
  return neighbors;
}
