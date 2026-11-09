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
  decking: 'Doghe esterne',
  cotto: 'Cotto',
};

// Outdoor decking: long boards with dark gaps.
function decking(seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  const rows = 6, rh = 512 / rows;
  g.fillStyle = '#3b3530';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < rows; i++) {
    g.fillStyle = new THREE.Color('#8f7a64').offsetHSL(0, (r() - 0.5) * 0.05, (r() - 0.5) * 0.08).getStyle();
    g.fillRect(0, i * rh + 4, 512, rh - 8);
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let k = 0; k < 9; k++) g.fillRect(0, i * rh + 4 + r() * (rh - 8), 512, 1);
  }
  return c;
}

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
      decking: () => decking(17),
      cotto: () => tiles(3, '#b5674a', '#d8c7b4', 19),
    }[kind] || (() => noise('#cccccc', 0.05, 1));
    cache[kind] = toTexture(canvas());
  }
  return cache[kind];
}

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---- wood finishes for furniture

export const WOODS = {
  oak: { label: 'Rovere', base: '#c49a6c' },
  ash: { label: 'Frassino', base: '#e0cba8' },
  cherry: { label: 'Ciliegio', base: '#9a5a3c' },
  walnut: { label: 'Noce', base: '#6e4b33' },
  wenge: { label: 'Wengé', base: '#3e2f25' },
};

function woodGrain(base, seed) {
  const [c, g] = makeCanvas(256);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  // Long wavy grain lines, darker and lighter.
  for (let i = 0; i < 70; i++) {
    const y0 = r() * 256, amp = 2 + r() * 6, freq = 0.01 + r() * 0.02, ph = r() * 6;
    g.strokeStyle = r() > 0.4 ? `rgba(0,0,0,${0.05 + r() * 0.1})` : `rgba(255,255,255,${0.04 + r() * 0.06})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = y0 + Math.sin(x * freq + ph) * amp;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

export function woodTexture(kind) {
  const key = 'wood-' + kind;
  if (!cache[key]) cache[key] = toTexture(woodGrain(WOODS[kind]?.base || '#c49a6c', kind.length * 31 + 7));
  return cache[key];
}

// ---- outdoor surfaces

export function groundTexture(kind) {
  const key = 'ground-' + kind;
  if (!cache[key]) {
    const canvas = {
      grass: () => {
        const [c, g] = makeCanvas(256);
        const r = rng(23);
        g.fillStyle = '#6d8f4c';
        g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 5000; i++) {
          g.fillStyle = new THREE.Color('#6d8f4c').offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.14).getStyle();
          g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 2 + r() * 4);
        }
        return c;
      },
      paving: () => tiles(6, '#b7b2a9', '#99938a', 31),
      asphalt: () => noise('#4a4d52', 0.14, 29),
    }[kind];
    cache[key] = toTexture(canvas());
  }
  return cache[key];
}

// One bay of a building facade (wall + window); repeated over the walls.
export function facadeTexture(wall, glass, seed) {
  const key = `facade-${wall}-${glass}`;
  if (!cache[key]) {
    const [c, g] = makeCanvas(64);
    const r = rng(seed);
    g.fillStyle = wall;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(14, 46, 36, 3);
    g.fillStyle = glass;
    g.fillRect(16, 14, 32, 32);
    g.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.15})`;
    g.fillRect(16, 14, 32, 10);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(31, 14, 2, 32);
    cache[key] = toTexture(c);
  }
  return cache[key];
}
