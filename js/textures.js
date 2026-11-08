import * as THREE from 'three';

// Procedural floor textures drawn on a canvas: no image assets needed.
// Every texture covers TILE_M x TILE_M meters of floor.
export const TILE_M = 1.2;

export const FLOORS = {
  parquet: 'Parquet rovere',
  walnut: 'Parquet noce',
  tiles: 'Piastrelle 30×30',
  gres: 'Gres 60×60',
  concrete: 'Resina / cemento',
  carpet: 'Moquette',
};

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeCanvas(n = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return [c, c.getContext('2d')];
}

function planks(base, seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  const rows = 8, rh = 512 / rows;
  // Draw a rect twice so planks wrap seamlessly across the tile edge.
  const rect = (x, y, w, h) => { g.fillRect(x, y, w, h); g.fillRect(x - 512, y, w, h); };
  for (let i = 0; i < rows; i++) {
    let x = r() * 512;
    const end = x + 512;
    while (x < end) {
      const len = Math.min(180 + r() * 220, end - x);
      const col = new THREE.Color(base).offsetHSL(0, (r() - 0.5) * 0.06, (r() - 0.5) * 0.09);
      g.fillStyle = col.getStyle();
      rect(x, i * rh, len, rh);
      g.fillStyle = 'rgba(0,0,0,0.05)';
      for (let k = 0; k < 7; k++) rect(x, i * rh + r() * rh, len, 1 + r());
      g.fillStyle = 'rgba(0,0,0,0.35)';
      rect(x, i * rh, 1.5, rh);
      x += len;
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, i * rh, 512, 1.5);
  }
  return c;
}

function tiles(count, base, grout, seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  const s = 512 / count;
  g.fillStyle = grout;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      g.fillStyle = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.04).getStyle();
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
  }
  return c;
}

function noise(base, amount, seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${amount * r()})` : `rgba(0,0,0,${amount * r()})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3);
  }
  return c;
}

const cache = {};
export function floorTexture(kind) {
  if (!cache[kind]) {
    const canvas = {
      parquet: () => planks('#c9a57a', 7),
      walnut: () => planks('#7a5638', 11),
      tiles: () => tiles(4, '#e9e7e2', '#bdb8b0', 3),
      gres: () => tiles(2, '#cfcac2', '#a8a29a', 5),
      concrete: () => noise('#b9b6b1', 0.08, 9),
      carpet: () => noise('#8e9aa6', 0.12, 13),
    }[kind] || (() => noise('#cccccc', 0.05, 1));
    const t = new THREE.CanvasTexture(canvas());
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    cache[kind] = t;
  }
  return cache[kind];
}
