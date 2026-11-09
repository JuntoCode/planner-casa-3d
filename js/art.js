import * as THREE from 'three';

// Pictures drawn on a canvas for paintings, posters, tapestries, rugs and wall
// tiles. `seed` picks one of a few variants, so two paintings rarely match.

const VARIANTS = 8;
const cache = new Map();

export function artTexture(kind, seed = 1) {
  const v = ((seed % VARIANTS) + VARIANTS) % VARIANTS;
  const key = kind + v;
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    (PAINT[kind] || PAINT.abstract)(g, rng(v * 7919 + kind.length * 31 + 1), v);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (REPEAT.has(kind)) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    cache.set(key, t);
  }
  return cache.get(key);
}

// Texture kinds meant to repeat over a surface (wall tiles).
const REPEAT = new Set(['subway', 'wallMosaic', 'wallHex']);

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

const PALETTES = [
  ['#f2e8d5', '#2f4a6b', '#c56b45', '#d9b44a', '#1d2430'],
  ['#efe9e1', '#8a9a7b', '#56704f', '#e8b7a8', '#3b3f45'],
  ['#1d2430', '#4f8a8b', '#f2c14e', '#f78154', '#fdf6ec'],
  ['#f6f1ea', '#9b5c7a', '#e8b7a8', '#2f4a6b', '#d9d6cf'],
  ['#e9e1d3', '#b8735a', '#7d5a44', '#2b2b2b', '#c9a57a'],
  ['#fbf7f0', '#3f5e7a', '#7d8a96', '#d9b44a', '#c56b45'],
];

const PAINT = {
  // Bold shapes on a plain ground.
  abstract(g, r) {
    const pal = pick(r, PALETTES);
    g.fillStyle = pal[0];
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = pal[1 + Math.floor(r() * 4)];
      g.globalAlpha = 0.75 + r() * 0.25;
      const x = r() * 512, y = r() * 512, s = 60 + r() * 200;
      const k = Math.floor(r() * 3);
      g.beginPath();
      if (k === 0) g.arc(x, y, s / 2, 0, Math.PI * 2);
      else if (k === 1) g.rect(x - s / 2, y - s / 4, s, s / 2);
      else { g.arc(x, y, s / 2, Math.PI, 0); g.closePath(); }
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = pal[4];
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(r() * 512, r() * 512);
    g.bezierCurveTo(r() * 512, r() * 512, r() * 512, r() * 512, r() * 512, r() * 512);
    g.stroke();
  },
  // Sky, sun and layered hills.
  landscape(g, r) {
    const skies = [['#9fc6e8', '#f4e6c8'], ['#f7b267', '#f4845f'], ['#a8c5da', '#e6eef2'], ['#2e3a59', '#8b6f8e']];
    const [s0, s1] = pick(r, skies);
    const sky = g.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, s0);
    sky.addColorStop(1, s1);
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(255,245,220,0.9)';
    g.beginPath();
    g.arc(120 + r() * 280, 90 + r() * 100, 30 + r() * 25, 0, Math.PI * 2);
    g.fill();
    const greens = ['#7c9a6a', '#5f7f55', '#466347', '#2f4a39'];
    for (let l = 0; l < 4; l++) {
      g.fillStyle = greens[l];
      g.beginPath();
      const base = 260 + l * 65;
      g.moveTo(0, 512);
      g.lineTo(0, base);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, base - Math.sin(x / (60 + l * 20) + r() * 6) * (20 + r() * 25));
      g.lineTo(512, 512);
      g.fill();
    }
  },
  // Big shape and a title, like a print or a gig poster.
  poster(g, r) {
    const pal = pick(r, PALETTES);
    g.fillStyle = pal[0];
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = pal[1];
    g.beginPath();
    g.arc(256, 210, 150, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pal[2];
    g.fillRect(0, 300, 512, 60);
    g.fillStyle = pal[4];
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(pick(r, ['JAZZ', 'ROMA', 'SUMMER', 'TOKYO', 'BLOOM', 'MARE', 'VINYL', 'LOFI']), 256, 440);
    g.font = '24px system-ui, sans-serif';
    g.fillText(pick(r, ['1984', 'LIVE · 21:00', 'EXHIBITION', 'COLLECTION', 'VOL. 2']), 256, 480);
  },
  // Concentric rings of petals on dark cloth.
  mandala(g, r) {
    const grounds = ['#24304f', '#3d1f3a', '#1f3d3a', '#5a2a1e', '#f1e6d2'];
    const ground = pick(r, grounds);
    const light = ground === '#f1e6d2';
    g.fillStyle = ground;
    g.fillRect(0, 0, 512, 512);
    const inks = light ? ['#5a2a1e', '#2f4a6b', '#b8735a'] : ['#f2c14e', '#f1e6d2', '#e8b7a8', '#7fc7c0'];
    g.translate(256, 256);
    for (let ring = 7; ring >= 1; ring--) {
      const rad = ring * 32, n = 6 + ring * 4;
      g.fillStyle = inks[ring % inks.length];
      g.strokeStyle = inks[(ring + 1) % inks.length];
      g.lineWidth = 2;
      for (let k = 0; k < n; k++) {
        g.save();
        g.rotate((k / n) * Math.PI * 2);
        g.beginPath();
        g.ellipse(0, -rad + 12, 7 + ring, 16, 0, 0, Math.PI * 2);
        if (ring % 2) g.fill(); else g.stroke();
        g.beginPath();
        g.arc(0, -rad - 6, 2.5, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.beginPath();
      g.arc(0, 0, rad - 22, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = inks[0];
    g.beginPath();
    g.arc(0, 0, 14, 0, Math.PI * 2);
    g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.strokeStyle = inks[0];
    g.lineWidth = 6;
    g.strokeRect(12, 12, 488, 488);
  },
  // Persian rug: borders, medallion and a small repeated motif.
  persian(g, r) {
    const pal = pick(r, [['#8b2f2f', '#1f2f4a', '#e8d9b5', '#c9a24a'], ['#1f2f4a', '#8b2f2f', '#e8d9b5', '#7fa0a8'], ['#6b4a2f', '#2f4a39', '#f1e6d2', '#c56b45']]);
    g.fillStyle = pal[0];
    g.fillRect(0, 0, 512, 512);
    for (const [m, col] of [[12, pal[1]], [36, pal[2]], [44, pal[1]]]) {
      g.strokeStyle = col;
      g.lineWidth = m === 36 ? 6 : 14;
      g.strokeRect(m, m, 512 - 2 * m, 512 - 2 * m);
    }
    g.fillStyle = pal[3];
    for (let x = 70; x < 450; x += 34) for (let y = 70; y < 450; y += 34) {
      g.beginPath();
      g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y);
      g.fill();
    }
    g.translate(256, 256);
    for (const [s, col] of [[150, pal[1]], [118, pal[2]], [86, pal[0]], [52, pal[3]]]) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -s); g.lineTo(s * 0.7, 0); g.lineTo(0, s); g.lineTo(-s * 0.7, 0);
      g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  },
  // Berber rug: cream wool with a dark diamond lattice.
  berber(g, r) {
    g.fillStyle = '#efe7d8';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = pick(r, ['#2b2b2b', '#5b4636', '#3f5e7a']);
    g.lineWidth = 5;
    for (let k = -512; k < 1024; k += 96) {
      g.beginPath();
      g.moveTo(k, 0); g.lineTo(k + 512, 512);
      g.moveTo(k + 512, 0); g.lineTo(k, 512);
      g.stroke();
    }
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(120,100,80,${0.05 + r() * 0.08})`;
      g.fillRect(r() * 512, r() * 512, 2, 2);
    }
  },
  // Kilim: colored stripes with zigzag bands.
  kilim(g, r) {
    const pal = pick(r, PALETTES);
    let y = 0;
    while (y < 512) {
      const h = 18 + r() * 50;
      g.fillStyle = pal[Math.floor(r() * 5)];
      g.fillRect(0, y, 512, h);
      if (h > 40) {
        g.fillStyle = pal[Math.floor(r() * 5)];
        g.beginPath();
        for (let x = 0; x <= 512; x += 24) g.lineTo(x, y + (x / 24 % 2 ? h * 0.25 : h * 0.75));
        g.lineTo(512, y + h / 2 + 4); g.lineTo(0, y + h / 2 + 4);
        g.fill();
      }
      y += h;
    }
  },
  // Wall tiles: 60 x 60 cm per texture.
  subway(g) {
    g.fillStyle = '#c9c6c0';
    g.fillRect(0, 0, 512, 512);
    const rows = 8, rh = 512 / rows, bw = 128;
    for (let j = 0; j < rows; j++) for (let i = -1; i < 5; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0);
      const grd = g.createLinearGradient(0, j * rh, 0, j * rh + rh);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(1, '#eceae6');
      g.fillStyle = grd;
      g.fillRect(x + 2, j * rh + 2, bw - 4, rh - 4);
    }
  },
  wallMosaic(g, r) {
    g.fillStyle = '#e8e6e0';
    g.fillRect(0, 0, 512, 512);
    const n = 32, s = 512 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = new THREE.Color(r() > 0.5 ? '#e9eef0' : '#cfdde2').offsetHSL(0, 0, (r() - 0.5) * 0.1).getStyle();
      g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
    }
  },
  wallHex(g, r) {
    g.fillStyle = '#b4ada2';
    g.fillRect(0, 0, 512, 512);
    const cols = 7, rows = 8, w = 512 / cols, h = 512 / rows, R = w / Math.sqrt(3), sy = h / (1.5 * R);
    for (let j = -1; j <= rows; j++) for (let i = -1; i <= cols; i++) {
      const cx = i * w + (j % 2 ? w / 2 : 0), cy = j * h;
      g.fillStyle = new THREE.Color('#f4f1ea').offsetHSL(0, 0, (r() - 0.5) * 0.05).getStyle();
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        g.lineTo(cx + Math.cos(a) * (R - 2.5), cy + Math.sin(a) * (R - 2.5) * sy);
      }
      g.fill();
    }
  },
  // Piano keys seen from above (52 white keys stretched over the texture).
  keys(g) {
    g.fillStyle = '#f7f5f0';
    g.fillRect(0, 0, 512, 512);
    const n = 52, kw = 512 / n;
    g.fillStyle = '#9a9a9a';
    for (let i = 1; i < n; i++) g.fillRect(i * kw - 0.5, 0, 1, 512);
    g.fillStyle = '#1d1d1f';
    for (let i = 0; i < n - 1; i++) {
      const note = (i + 5) % 7; // start from A
      if (note === 2 || note === 6) continue; // no black key after E and B
      g.fillRect(i * kw + kw * 0.65, 0, kw * 0.7, 310);
    }
  },
  // A computer desktop: wallpaper and a couple of windows.
  screen(g, r) {
    const grd = g.createLinearGradient(0, 0, 512, 512);
    grd.addColorStop(0, pick(r, ['#2f4a6b', '#4f8a8b', '#3d1f3a']));
    grd.addColorStop(1, pick(r, ['#f78154', '#d9b44a', '#7fc7c0']));
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillRect(60, 70, 260, 190);
    g.fillRect(230, 230, 220, 160);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(0, 488, 512, 24);
  },
};
