// Shared drawing board for Doodle. Strokes are normalized to [0,1] on a square
// surface so they scale identically on the big host screen and a phone.
//   const board = createBoard(canvasEl, { drawable:true, onSegment });
//   board.drawSegment(seg);  board.clear();  board.setColor(c);  board.setWidth(w);
export function createBoard(canvas, { drawable = false, onSegment, onClearInput } = {}) {
  const ctx = canvas.getContext('2d');
  let color = '#1a0b2e';
  let width = 6; // in normalized*1000 units; scaled per surface below

  function fit() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);

  const W = () => canvas.getBoundingClientRect().width;
  const H = () => canvas.getBoundingClientRect().height;

  function drawSegment(seg) {
    const w = W(), h = H();
    ctx.strokeStyle = seg.c || '#1a0b2e';
    ctx.lineWidth = (seg.w || 6) / 1000 * Math.min(w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.x0 * w, seg.y0 * h);
    ctx.lineTo(seg.x1 * w, seg.y1 * h);
    ctx.stroke();
  }
  function clear() { ctx.clearRect(0, 0, W(), H()); }

  // --- drawing input (drawer only; toggle with setDrawable) --------------
  let inputEnabled = drawable;
  let last = null;
  const pt = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const start = (e) => { if (!inputEnabled) return; e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); last = pt(e); };
  const move = (e) => {
    if (!inputEnabled || !last) return;
    e.preventDefault();
    const p = pt(e);
    const seg = { x0: last.x, y0: last.y, x1: p.x, y1: p.y, c: color, w: width };
    drawSegment(seg);
    onSegment?.(seg);
    last = p;
  };
  const end = () => { last = null; };
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  return {
    drawSegment, clear, fit,
    setColor: (c) => { color = c; },
    setWidth: (w) => { width = w; },
    setDrawable: (b) => { inputEnabled = b; last = null; },
  };
}
