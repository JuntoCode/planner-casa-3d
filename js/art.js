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
const REPEAT = new Set(['subway', 'wallMosaic', 'wallHex', 'wpStripes', 'wpDamask', 'wpBotanical', 'wpGeo', 'brick', 'woodPanel', 'concreteWall']);

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
  // ---- lamp shades: used as colour and glow, so bright parts shine ----
  // Pierced brass with coloured glass stars (Moroccan lantern).
  moroccan(g, r) {
    g.fillStyle = '#2e2216';
    g.fillRect(0, 0, 512, 512);
    const cols = ['#ffb347', '#e0475b', '#3fb8a9', '#ffd56b', '#8c6bb1'];
    const star = (x, y, rad, col) => {
      g.fillStyle = col;
      g.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, rr = k % 2 ? rad * 0.5 : rad;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
    };
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const x = i * 64 + (j % 2 ? 32 : 0) + 32, y = j * 64 + 32;
      star(x, y, 20, pick(r, cols));
      g.fillStyle = '#ffe2a8';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + Math.cos(k * Math.PI / 2 + 0.78) * 30, y + Math.sin(k * Math.PI / 2 + 0.78) * 30, 3, 0, Math.PI * 2); g.fill(); }
    }
  },
  // Carved gourd: brown skin with rows of glowing dots and diamonds.
  gourd(g, r) {
    g.fillStyle = '#5c3a1e';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#ffd58a';
    for (let j = 0; j < 14; j++) for (let i = 0; i < 24; i++) {
      const x = i * (512 / 24) + (j % 2 ? 10 : 0), y = 20 + j * 34;
      const k = (i + j) % 6;
      g.beginPath();
      if (k === 0) { g.moveTo(x, y - 9); g.lineTo(x + 7, y); g.lineTo(x, y + 9); g.lineTo(x - 7, y); }
      else g.arc(x, y, k % 2 ? 2.5 : 4, 0, Math.PI * 2);
      g.fill();
    }
    r();
  },
  // Stained glass: jittered cells of coloured glass with dark leading.
  tiffany(g, r) {
    g.fillStyle = '#1d1a16';
    g.fillRect(0, 0, 512, 512);
    const pal = pick(r, [['#e8a33c', '#c96a2b', '#5f8f4a', '#e9d27a'], ['#3f6fb0', '#7fc7c0', '#e9d27a', '#9b5c7a'], ['#c0392b', '#e8a33c', '#2f6b4f', '#f2e3b3']]);
    const n = 10, s = 512 / n, pts = [];
    for (let j = 0; j <= n; j++) { pts[j] = []; for (let i = 0; i <= n; i++) pts[j][i] = [i * s + (i % n ? (r() - 0.5) * s * 0.5 : 0), j * s + (j % n ? (r() - 0.5) * s * 0.5 : 0)]; }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.fillStyle = j < 2 ? pal[3] : pick(r, pal);
      g.beginPath();
      for (const [a, b] of [[j, i], [j, i + 1], [j + 1, i + 1], [j + 1, i]]) g.lineTo(pts[a][b][0], pts[a][b][1]);
      g.closePath();
      g.fill();
      g.strokeStyle = '#1d1a16';
      g.lineWidth = 4;
      g.stroke();
    }
  },
  // Rattan weave: tan strips, light shining through the gaps.
  weave(g) {
    g.fillStyle = '#ffd98f';
    g.fillRect(0, 0, 512, 512);
    const s = 32;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      g.fillStyle = (i + j) % 2 ? '#a77a4a' : '#8a6038';
      if ((i + j) % 2) g.fillRect(i * s + 2, j * s + 8, s - 4, s - 16);
      else g.fillRect(i * s + 8, j * s + 2, s - 16, s - 4);
    }
  },
  // Dark carved wood with glowing zigzags and triangles.
  tribal(g, r) {
    g.fillStyle = '#3a2416';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#ffb35c';
    for (let band = 0; band < 6; band++) {
      const y = 30 + band * 82, kind = band % 3;
      g.beginPath();
      if (kind === 0) { for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + (x / 32 % 2 ? 0 : 22)); for (let x = 512; x >= 0; x -= 32) g.lineTo(x, y + 8 + (x / 32 % 2 ? 0 : 22)); }
      else if (kind === 1) for (let x = 8; x < 512; x += 42) { g.moveTo(x, y + 30); g.lineTo(x + 16, y); g.lineTo(x + 32, y + 30); }
      else for (let x = 16; x < 512; x += 32) { g.moveTo(x + 6, y + 15); g.arc(x, y + 15, 6, 0, Math.PI * 2); }
      g.fill();
    }
    r();
  },

  // ---- wall finishes (repeat over the walls; light colours so the paint colour can tint them) ----
  wpStripes(g) {
    g.fillStyle = '#f6f2ea';
    g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 64) {
      g.fillStyle = '#e4dccd';
      g.fillRect(x, 0, 30, 512);
      g.fillStyle = '#d8ccb6';
      g.fillRect(x + 44, 0, 3, 512);
    }
  },
  wpDamask(g) {
    g.fillStyle = '#f1ebdf';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#ddd1bb';
    const motif = (cx, cy) => {
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx, cy - 90);
        g.bezierCurveTo(cx + s * 70, cy - 60, cx + s * 20, cy - 10, cx + s * 60, cy + 20);
        g.bezierCurveTo(cx + s * 90, cy + 50, cx + s * 30, cy + 90, cx, cy + 70);
        g.closePath();
        g.fill();
      }
      g.beginPath(); g.arc(cx, cy - 100, 10, 0, Math.PI * 2); g.fill();
    };
    for (const [x, y] of [[128, 128], [384, 384]]) for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) motif(x + dx, y + dy);
  },
  wpBotanical(g, r) {
    g.fillStyle = '#eef1ea';
    g.fillRect(0, 0, 512, 512);
    const greens = ['#9fb58f', '#7f9a72', '#b8c9a8', '#6d8a62'];
    for (let k = 0; k < 34; k++) {
      const x = r() * 512, y = r() * 512, a = r() * Math.PI * 2, len = 30 + r() * 40, col = pick(r, greens);
      for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
        g.save();
        g.translate(x + dx, y + dy);
        g.rotate(a);
        g.fillStyle = col;
        g.beginPath(); g.ellipse(0, -len / 2, len * 0.28, len / 2, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len); g.stroke();
        g.restore();
      }
    }
  },
  // Art deco fans.
  wpGeo(g) {
    g.fillStyle = '#f3efe8';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#c9a24a';
    g.lineWidth = 3;
    const rr = 64;
    for (let j = -1; j <= 8; j++) for (let i = -1; i <= 4; i++) {
      const cx = i * 128 + (j % 2 ? 64 : 0), cy = j * 64;
      for (const k of [1, 0.66, 0.33]) { g.beginPath(); g.arc(cx, cy + rr, rr * k, Math.PI, 0); g.stroke(); }
    }
  },
  brick(g, r) {
    g.fillStyle = '#cbc2b4';
    g.fillRect(0, 0, 512, 512);
    const rows = 10, rh = 512 / rows, bw = 512 / 3;
    for (let j = 0; j < rows; j++) for (let i = -1; i < 4; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0);
      g.fillStyle = new THREE.Color(pick(r, ['#a5553a', '#9a4b33', '#b0654a', '#8f4630'])).offsetHSL(0, 0, (r() - 0.5) * 0.08).getStyle();
      g.fillRect(x + 3, j * rh + 3, bw - 6, rh - 6);
    }
  },
  // Wood panelling: vertical boards.
  woodPanel(g, r) {
    for (let i = 0; i < 10; i++) {
      g.fillStyle = new THREE.Color('#c49a6c').offsetHSL(0, (r() - 0.5) * 0.05, (r() - 0.5) * 0.08).getStyle();
      g.fillRect(i * 51.2, 0, 51.2, 512);
      g.fillStyle = 'rgba(80,50,20,0.12)';
      for (let k = 0; k < 6; k++) g.fillRect(i * 51.2 + 4 + r() * 42, 0, 1 + r() * 1.5, 512);
      g.fillStyle = 'rgba(40,25,10,0.45)';
      g.fillRect(i * 51.2, 0, 2, 512);
    }
  },
  concreteWall(g, r) {
    g.fillStyle = '#bdbab4';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.06 * r()})` : `rgba(0,0,0,${0.07 * r()})`;
      g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3);
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, 512, 2);
    g.fillRect(0, 0, 2, 512);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (const [x, y] of [[64, 64], [448, 64], [64, 448], [448, 448]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
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
