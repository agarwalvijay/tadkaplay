import laddoo from './laddoo.js';
import chai from './chai.js';
import donut from './donut.js';
import mithai from './mithai.js';

export const PACKS = [laddoo, chai, donut, mithai];

export function listPacks() {
  return PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
}

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || null;
}
