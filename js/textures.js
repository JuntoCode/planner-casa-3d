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
  herringbone: 'Parquet a spina di pesce',
  marble: 'Marmo',
  gresDark: 'Gres antracite 60×60',
  checker: 'Scacchiera bianco e nero',
  hex: 'Esagonette',
  cementine: 'Cementine decorate',
  mosaic: 'Mosaico',
  slate: 'Ardesia',
  terrazzo: 'Graniglia (terrazzo)',
  // outdoor
  grass: 'Prato',
  gravel: 'Ghiaia',
  stone: 'Lastre di pietra',
  pavers: 'Autobloccanti',
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

// Chevron parquet: columns of slanted planks, alternating direction.
function herringbone(seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = '#3a2a1c';
  g.fillRect(0, 0, 512, 512);
  for (let col = 0; col < 4; col++) {
    const x0 = col * 128, up = col % 2 === 0;
    for (let k = -3; k < 9; k++) {
      g.fillStyle = new THREE.Color('#b98c5e').offsetHSL(0, (r() - 0.5) * 0.06, (r() - 0.5) * 0.1).getStyle();
      for (const dy of [0, 512]) {
        const y = k * 64 + dy;
        g.beginPath();
        if (up) { g.moveTo(x0 + 1, y + 1); g.lineTo(x0 + 127, y + 127); g.lineTo(x0 + 127, y + 190); g.lineTo(x0 + 1, y + 64); }
        else { g.moveTo(x0 + 1, y + 128); g.lineTo(x0 + 127, y + 2); g.lineTo(x0 + 127, y + 65); g.lineTo(x0 + 1, y + 191); }
        g.closePath();
        g.fill();
      }
    }
  }
  return c;
}

// Marble slabs: pale base with soft veins.
function marble(base, vein, seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = vein;
  for (let i = 0; i < 14; i++) {
    g.globalAlpha = 0.15 + r() * 0.35;
    g.lineWidth = 0.6 + r() * 2;
    g.beginPath();
    let x = r() * 512, y = r() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 120; y += (r() - 0.5) * 120; g.quadraticCurveTo(x - 40 * r(), y + 40 * r(), x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 255, 512, 2);
  g.fillRect(255, 0, 2, 512);
  return c;
}

function checker() {
  const [c, g] = makeCanvas();
  const s = 128;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    g.fillStyle = (i + j) % 2 ? '#2b2b2b' : '#f1efe9';
    g.fillRect(i * s, j * s, s, s);
  }
  g.fillStyle = 'rgba(120,120,120,0.5)';
  for (let i = 0; i <= 4; i++) { g.fillRect(i * s - 1, 0, 2, 512); g.fillRect(0, i * s - 1, 512, 2); }
  return c;
}

// Hexagon tiles: 7 across and 8 rows make the pattern wrap seamlessly.
function hexTiles(base, grout, seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = grout;
  g.fillRect(0, 0, 512, 512);
  const cols = 7, rows = 8, w = 512 / cols, h = 512 / rows, R = w / Math.sqrt(3), sy = h / (1.5 * R);
  for (let j = -1; j <= rows; j++) for (let i = -1; i <= cols; i++) {
    const cx = i * w + (j % 2 ? w / 2 : 0), cy = j * h;
    g.fillStyle = new THREE.Color(base).offsetHSL(0, 0, (r() - 0.5) * 0.06).getStyle();
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      g.lineTo(cx + Math.cos(a) * (R - 2.5), cy + Math.sin(a) * (R - 2.5) * sy);
    }
    g.closePath();
    g.fill();
  }
  return c;
}

// Encaustic tiles: the same flower in every tile.
function cementine() {
  const [c, g] = makeCanvas();
  const s = 128, pal = ['#2f4a6b', '#c56b45', '#d9b44a', '#56704f'];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * s, y = j * s;
    g.fillStyle = '#efe8da';
    g.fillRect(x + 1, y + 1, s - 2, s - 2);
    g.save();
    g.beginPath(); g.rect(x + 1, y + 1, s - 2, s - 2); g.clip();
    g.fillStyle = pal[0];
    for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s]]) { g.beginPath(); g.arc(x + cx, y + cy, 30, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.fillStyle = pal[1];
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.ellipse(x + s / 2 + Math.cos(k * Math.PI / 2) * 22, y + s / 2 + Math.sin(k * Math.PI / 2) * 22, 20, 10, k * Math.PI / 2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = pal[2];
    g.beginPath(); g.arc(x + s / 2, y + s / 2, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = pal[3]; g.lineWidth = 3;
    g.strokeRect(x + 10, y + 10, s - 20, s - 20);
  }
  return c;
}

function mosaic(base, seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  const n = 24, s = 512 / n;
  g.fillStyle = '#e8e6e0';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = new THREE.Color(base).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2).getStyle();
    g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
  }
  return c;
}

// Speckled terrazzo (graniglia).
function terrazzo(seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = '#e7e2d9';
  g.fillRect(0, 0, 512, 512);
  const pal = ['#9a948a', '#c9a57a', '#5b5f63', '#b8735a', '#f8f6f1'];
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = pal[Math.floor(r() * pal.length)];
    const rad = 1 + r() * 5;
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function grass(seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = '#6b8f48';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = new THREE.Color('#6b8f48').offsetHSL((r() - 0.5) * 0.05, (r() - 0.5) * 0.1, (r() - 0.5) * 0.16).getStyle();
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 3 + r() * 5);
  }
  return c;
}

function gravel(seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = '#a49c90';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = new THREE.Color('#bfb6a8').offsetHSL(0, 0, (r() - 0.5) * 0.35).getStyle();
    const rad = 1.5 + r() * 3.5;
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, rad, rad * 0.75, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

// Irregular stone slabs in staggered rows.
function stone(seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = '#7d776e';
  g.fillRect(0, 0, 512, 512);
  const rows = 4, rh = 512 / rows;
  for (let j = 0; j < rows; j++) {
    let x = r() * 120;
    const end = x + 512;
    while (x < end) {
      const len = Math.min(90 + r() * 120, end - x);
      g.fillStyle = new THREE.Color('#c8bfae').offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.14).getStyle();
      for (const dx of [0, -512]) g.fillRect(x + dx + 3, j * rh + 3, len - 6, rh - 6);
      x += len;
    }
  }
  return c;
}

// Concrete pavers in running bond.
function pavers(seed) {
  const [c, g] = makeCanvas();
  const r = rng(seed);
  g.fillStyle = '#6f6a64';
  g.fillRect(0, 0, 512, 512);
  const rows = 16, rh = 512 / rows, bw = 64;
  for (let j = 0; j < rows; j++) {
    for (let i = -1; i < 8; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0);
      g.fillStyle = new THREE.Color(r() > 0.85 ? '#a8705a' : '#a39d94').offsetHSL(0, 0, (r() - 0.5) * 0.08).getStyle();
      g.fillRect(x + 1.5, j * rh + 1.5, bw - 3, rh - 3);
    }
  }
  return c;
}

// Leafy surface for hedges.
export function hedgeTexture() {
  if (!cache.hedge) {
    const [c, g] = makeCanvas(256);
    const r = rng(41);
    g.fillStyle = '#3e6a32';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = new THREE.Color('#4f7f3f').offsetHSL((r() - 0.5) * 0.06, (r() - 0.5) * 0.2, (r() - 0.5) * 0.25).getStyle();
      g.beginPath();
      g.ellipse(r() * 256, r() * 256, 2 + r() * 3, 1 + r() * 2, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    cache.hedge = toTexture(c);
  }
  return cache.hedge;
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
      herringbone: () => herringbone(43),
      marble: () => marble('#f1efea', '#8d8a85', 47),
      gresDark: () => tiles(2, '#4a4b4d', '#2f3032', 53),
      checker: () => checker(),
      hex: () => hexTiles('#e9e5dc', '#b4ada2', 59),
      cementine: () => cementine(),
      mosaic: () => mosaic('#4f8a9b', 67),
      slate: () => tiles(3, '#4f5559', '#33383b', 71),
      terrazzo: () => terrazzo(73),
      grass: () => grass(79),
      gravel: () => gravel(83),
      stone: () => stone(89),
      pavers: () => pavers(97),
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
