// Shared instrument layout for Sur — used by the server (to assign instruments)
// and the clients (host audio + phone pads). Melodic instruments are locked to
// a pentatonic scale so ANY combination of taps always sounds harmonious.

// C major pentatonic (MIDI), the "it always sounds good" trick.
export const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];

export const INSTRUMENTS = [
  { id: 'tabla', name: 'Tabla', emoji: '🥁', type: 'perc',
    pads: [{ label: 'Tin' }, { label: 'Na' }, { label: 'Dha' }, { label: 'Ge' }] },
  { id: 'dholak', name: 'Dholak', emoji: '🪘', type: 'perc',
    pads: [{ label: 'Hi' }, { label: 'Lo' }] },
  { id: 'sitar', name: 'Sitar', emoji: '🪕', type: 'pluck',
    pads: [{ label: 'Sa', note: 60 }, { label: 'Ga', note: 64 }, { label: 'Pa', note: 67 }, { label: 'Dha', note: 69 }] },
  { id: 'bansuri', name: 'Bansuri', emoji: '🎶', type: 'flute',
    pads: [{ label: 'Pa', note: 67 }, { label: 'Dha', note: 69 }, { label: 'Sa', note: 72 }, { label: 'Ga', note: 76 }] },
  { id: 'bells', name: 'Manjira', emoji: '🔔', type: 'bell',
    pads: [{ label: 'Ting', note: 84 }, { label: 'Ling', note: 79 }] },
];

export const getInstrument = (id) => INSTRUMENTS.find((i) => i.id === id) || INSTRUMENTS[0];
