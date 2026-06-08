// Core word-combo game logic: grid generation, path validation, scoring.
import { buildNeighbors, isWord, solveGrid } from './words.js';

export const GRID_SIZE = 4;

// Classic 16-die Boggle distribution. The "Q" die face represents "Qu".
const DICE = [
  'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS',
  'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
  'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW',
  'EIOSST', 'ELRTTY', 'HIMNQU', 'HLNNRZ',
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate a grid. Returns { cells, display } where cells[i] is the lowercase
// value used for word-building ("qu" for the Q tile) and display[i] is what the
// UI shows ("Qu").
export function generateGrid() {
  const dice = shuffle(DICE);
  const cells = [];
  const display = [];
  for (const die of dice) {
    const face = die[Math.floor(Math.random() * die.length)];
    if (face === 'Q') {
      cells.push('qu');
      display.push('Qu');
    } else {
      cells.push(face.toLowerCase());
      display.push(face);
    }
  }
  return { cells, display };
}

// Arcade-flavoured scoring by letter count (Qu counts as its 2 letters).
export function scoreWord(word) {
  const n = word.length;
  if (n <= 2) return 0;
  if (n === 3) return 100;
  if (n === 4) return 200;
  if (n === 5) return 400;
  if (n === 6) return 700;
  if (n === 7) return 1100;
  return 2000; // 8+
}

// Validate a traced path against the grid. `path` is an array of cell indices.
// Returns the assembled lowercase word, or null if the path is illegal.
export function wordFromPath(cells, path, size = GRID_SIZE) {
  if (!Array.isArray(path) || path.length < 1) return null;
  const neighbors = buildNeighbors(size);
  const seen = new Set();
  let word = '';
  for (let i = 0; i < path.length; i++) {
    const idx = path[i];
    if (!Number.isInteger(idx) || idx < 0 || idx >= cells.length) return null;
    if (seen.has(idx)) return null; // no reusing a tile
    if (i > 0 && !neighbors[path[i - 1]].includes(idx)) return null; // must be adjacent
    seen.add(idx);
    word += cells[idx];
  }
  return word;
}

// Full submission check. Returns { ok, reason, word, points }.
export function evaluateSubmission(grid, path, alreadyFound) {
  const word = wordFromPath(grid.cells, path);
  if (!word) return { ok: false, reason: 'badpath' };
  if (word.length < 3) return { ok: false, reason: 'tooshort', word };
  if (!isWord(word)) return { ok: false, reason: 'notword', word };
  if (alreadyFound.has(word)) return { ok: false, reason: 'dupe', word };
  return { ok: true, word, points: scoreWord(word) };
}

// Precompute every possible word in the grid for end-of-round stats.
export function analyzeGrid(grid) {
  const { words, count, best } = solveGrid(grid.cells, GRID_SIZE, scoreWord);
  return { possibleCount: count, possibleWords: words, best };
}
