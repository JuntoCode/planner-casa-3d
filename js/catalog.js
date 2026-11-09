import * as THREE from 'three';
import { WOODS, woodTexture } from './textures.js';
import { decorBuilders } from './decor.js';

// Furniture catalog. Every model is built from primitives so it scales to any
// size the user types. Builders get sizes in meters; local axes:
// x = width (centered), z = depth (centered, front faces +z), y = up from 0.
// A color is either a hex value or a wood finish such as "wood:oak".

export const isWood = c => typeof c === 'string' && c.startsWith('wood:');
export const baseColor = c => (isWood(c) ? WOODS[c.slice(5)]?.base || '#c49a6c' : c);

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const m = isWood(color)
      ? new THREE.MeshStandardMaterial({ map: woodTexture(color.slice(5)), roughness: 0.62, metalness: 0, ...opts })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...opts });
    m.userData.shared = true; // cached: scene cleanup must not dispose it
    matCache.set(key, m);
  }
  return matCache.get(key);
}

const GLASS = { transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false };
const METAL = { metalness: 0.6, roughness: 0.35 };
const DARK = '#2b2b2b';
const WHITE = '#f4f3ef';

const shade = (c, l) => '#' + new THREE.Color(baseColor(c)).offsetHSL(0, 0, l).getHexString();

function box(g, w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}

function cyl(g, rt, rb, h, color, x = 0, y = 0, z = 0, opts, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}

function legs4(g, w, d, h, size, color, inset = 0.04) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(g, size, h, size, color, sx * (w / 2 - inset - size / 2), 0, sz * (d / 2 - inset - size / 2));
  }
}

// Vertical gaps between doors/drawers on a front face.
function doorLines(g, w, h, d, n, y0 = 0, handleY = null) {
  const dw = w / n;
  for (let i = 1; i < n; i++) box(g, 0.005, h - 0.02, 0.004, DARK, -w / 2 + i * dw, y0 + 0.01, d / 2 + 0.002);
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + i * dw + dw / 2;
    const hx = n === 1 ? cx + dw * 0.38 : cx + (i % 2 === 0 ? dw * 0.4 : -dw * 0.4);
    box(g, 0.014, 0.16, 0.02, '#8a8a8a', hx, handleY ?? y0 + h / 2 - 0.08, d / 2 + 0.01, METAL);
  }
}

function drawers(g, w, h, d, n, y0 = 0) {
  const dh = h / n;
  for (let i = 1; i < n; i++) box(g, w - 0.02, 0.005, 0.004, DARK, 0, y0 + i * dh, d / 2 + 0.002);
  for (let i = 0; i < n; i++) box(g, Math.min(0.2, w * 0.4), 0.014, 0.02, '#8a8a8a', 0, y0 + i * dh + dh * 0.6, d / 2 + 0.01, METAL);
}

const B = {
  bed(g, w, d, h, c) {
    legs4(g, w, d, 0.06, 0.05, DARK, 0.02);
    box(g, w, 0.24, d, c, 0, 0.06, 0);
    box(g, w - 0.04, 0.2, d - 0.1, WHITE, 0, 0.3, 0.03);
    box(g, w, Math.max(h, 0.6), 0.07, c, 0, 0, -d / 2 + 0.035);
    const n = w > 1.2 ? 2 : 1;
    const pw = (w - 0.12) / n;
    for (let i = 0; i < n; i++) box(g, pw - 0.06, 0.1, 0.34, '#ffffff', -w / 2 + 0.06 + pw * i + pw / 2, 0.5, -d / 2 + 0.28);
    box(g, w - 0.01, 0.05, d * 0.62, shade(c, 0.18), 0, 0.5, d / 2 - d * 0.31 - 0.02);
  },
  sofa(g, w, d, h, c, seats) {
    const arm = 0.18;
    legs4(g, w, d, 0.08, 0.04, DARK, 0.04);
    box(g, w, 0.3, d, c, 0, 0.08, 0);
    for (const s of [-1, 1]) box(g, arm, 0.55, d, c, s * (w / 2 - arm / 2), 0.08, 0);
    box(g, w - 2 * arm, h - 0.08, 0.2, c, 0, 0.08, -d / 2 + 0.1);
    const inner = w - 2 * arm;
    const n = typeof seats === 'number' ? seats : Math.max(1, Math.round(inner / 0.65)); // 6th arg is the item when built from the catalog
    const cw = inner / n;
    for (let i = 0; i < n; i++) {
      const x = -inner / 2 + cw * i + cw / 2;
      box(g, cw - 0.02, 0.14, d - 0.24, shade(c, 0.06), x, 0.38, 0.1);
      box(g, cw - 0.04, h - 0.5, 0.14, shade(c, 0.06), x, 0.5, -d / 2 + 0.27);
    }
  },
  armchair(g, w, d, h, c) { B.sofa(g, w, d, h, c, 1); },
  table(g, w, d, h, c) {
    box(g, w, 0.04, d, c, 0, h - 0.04, 0);
    legs4(g, w, d, h - 0.04, 0.05, shade(c, -0.15), 0.05);
  },
  roundTable(g, w, d, h, c) {
    const top = cyl(g, w / 2, w / 2, 0.04, c, 0, h - 0.04, 0);
    top.scale.z = d / w;
    cyl(g, 0.04, 0.04, h - 0.04, shade(c, -0.15), 0, 0, 0);
    cyl(g, 0.25, 0.28, 0.03, shade(c, -0.15), 0, 0, 0);
  },
  coffeeTable(g, w, d, h, c) {
    box(g, w, 0.04, d, c, 0, h - 0.04, 0);
    box(g, w - 0.06, 0.02, d - 0.06, c, 0, 0.1, 0);
    legs4(g, w, d, h - 0.04, 0.04, shade(c, -0.15), 0.02);
  },
  chair(g, w, d, h, c) {
    const sh = 0.45;
    legs4(g, w, d, sh - 0.04, 0.035, shade(c, -0.15), 0.02);
    box(g, w, 0.04, d, c, 0, sh - 0.04, 0);
    box(g, w, h - sh, 0.03, c, 0, sh, -d / 2 + 0.015);
  },
  officeChair(g, w, d, h, c) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = box(g, 0.03, 0.03, w / 2, DARK, Math.sin(a) * w / 4, 0.04, Math.cos(a) * w / 4);
      leg.rotation.y = a;
    }
    cyl(g, 0.025, 0.025, 0.4, '#777', 0, 0.06, 0, METAL);
    box(g, w * 0.9, 0.08, d * 0.85, c, 0, 0.44, 0.02);
    box(g, w * 0.85, h - 0.6, 0.06, c, 0, 0.58, -d / 2 + 0.06);
  },
  desk(g, w, d, h, c) {
    box(g, w, 0.03, d, c, 0, h - 0.03, 0);
    box(g, 0.03, h - 0.03, d - 0.02, c, -w / 2 + 0.015, 0, 0);
    const unit = new THREE.Group();
    unit.position.x = w / 2 - 0.2;
    g.add(unit);
    box(unit, 0.4, h - 0.03, d - 0.02, c);
    drawers(unit, 0.4, h - 0.05, d - 0.02, 3, 0.02);
    box(g, w - 0.45, 0.3, 0.02, c, -0.185, h - 0.33, -d / 2 + 0.03);
  },
  wardrobe(g, w, d, h, c) {
    box(g, w, 0.08, d - 0.04, shade(c, -0.2), 0, 0, -0.02);
    box(g, w, h - 0.08, d, c, 0, 0.08, 0);
    doorLines(g, w, h - 0.08, d, Math.max(1, Math.round(w / 0.5)), 0.08, 1.05);
  },
  bookshelf(g, w, d, h, c) {
    const t = 0.025;
    for (const s of [-1, 1]) box(g, t, h, d, c, s * (w / 2 - t / 2), 0, 0);
    box(g, w, 0.01, d, shade(c, -0.1), 0, 0, 0);
    box(g, w - 2 * t, t, d, c, 0, h - t, 0);
    box(g, w, h, 0.01, shade(c, -0.12), 0, 0, -d / 2 + 0.005);
    const n = Math.max(2, Math.round(h / 0.36));
    const sh = (h - t) / n;
    const r = mulberry(Math.round(w * 100 + h * 10));
    const colors = ['#8b3a3a', '#2f5d8a', '#c9a227', '#3f7d4e', '#d9d4c7', '#5a4a7a', '#b5652b'];
    for (let i = 0; i < n; i++) {
      const y = i * sh;
      if (i > 0) box(g, w - 2 * t, t, d - 0.01, c, 0, y, 0.005);
      let x = -w / 2 + t + 0.02;
      while (x < w / 2 - t - 0.06 && r() > 0.12) {
        const bw = 0.02 + r() * 0.04;
        const bh = Math.min(sh - 0.05, 0.18 + r() * 0.12);
        box(g, bw, bh, d * 0.75, colors[Math.floor(r() * colors.length)], x + bw / 2, y + t, 0.01);
        x += bw + 0.002;
      }
    }
  },
  nightstand(g, w, d, h, c) {
    legs4(g, w, d, 0.08, 0.03, shade(c, -0.15), 0.02);
    box(g, w, h - 0.08, d, c, 0, 0.08, 0);
    drawers(g, w, h - 0.08, d, 2, 0.08);
  },
  dresser(g, w, d, h, c) {
    box(g, w, 0.06, d - 0.04, shade(c, -0.2), 0, 0, -0.02);
    box(g, w, h - 0.06, d, c, 0, 0.06, 0);
    drawers(g, w, h - 0.06, d, Math.max(2, Math.round(h / 0.25)), 0.06);
  },
  tvStand(g, w, d, h, c) {
    box(g, w, h - 0.06, d, c, 0, 0.06, 0);
    legs4(g, w, d, 0.06, 0.03, DARK, 0.03);
    doorLines(g, w, h - 0.06, d, Math.max(2, Math.round(w / 0.6)), 0.06);
    const tw = Math.min(w * 0.85, 1.45);
    box(g, 0.25, 0.02, 0.18, DARK, 0, h, -d / 2 + 0.15);
    box(g, 0.05, 0.12, 0.03, DARK, 0, h, -d / 2 + 0.15);
    box(g, tw, tw * 0.57, 0.04, '#111111', 0, h + 0.08, -d / 2 + 0.15, { roughness: 0.2 });
  },
  kitchenBase(g, w, d, h, c, extra) {
    box(g, w, 0.1, d - 0.06, DARK, 0, 0, -0.03);
    box(g, w, h - 0.14, d - 0.03, c, 0, 0.1, -0.015);
    box(g, w, 0.04, d, '#4a4743', 0, h - 0.04, 0);
    doorLines(g, w, h - 0.14, d - 0.03, Math.max(1, Math.round(w / 0.6)), 0.1, h - 0.18);
    if (extra === 'sink') {
      box(g, Math.min(0.5, w - 0.1), 0.006, d * 0.6, '#9aa3a8', 0, h, 0.02, METAL);
      cyl(g, 0.015, 0.015, 0.28, '#c0c4c6', 0, h, -d / 2 + 0.08, METAL);
      box(g, 0.025, 0.025, 0.18, '#c0c4c6', 0, h + 0.26, -d / 2 + 0.16, METAL);
    }
    if (extra === 'hob') {
      box(g, w - 0.06, 0.006, d - 0.12, '#111111', 0, h, 0, { roughness: 0.15 });
      for (const [x, z, r] of [[-0.14, -0.1, 0.09], [0.14, -0.1, 0.07], [-0.14, 0.12, 0.07], [0.14, 0.12, 0.09]]) {
        cyl(g, r, r, 0.002, '#444', x * (w / 0.6), h + 0.006, z, undefined, 32);
      }
      box(g, w - 0.04, 0.45, 0.01, '#1c1c1c', 0, 0.3, d / 2 - 0.01, { roughness: 0.2 });
    }
  },
  sinkUnit(g, w, d, h, c) { B.kitchenBase(g, w, d, h, c, 'sink'); },
  hobUnit(g, w, d, h, c) { B.kitchenBase(g, w, d, h, c, 'hob'); },
  wallCabinet(g, w, d, h, c) {
    box(g, w, h, d, c, 0, 0, 0);
    doorLines(g, w, h, d, Math.max(1, Math.round(w / 0.6)), 0, 0.1);
  },
  // Wall cabinet with a slim pull-out hood underneath.
  hoodCabinet(g, w, d, h, c) {
    const hh = 0.12;
    box(g, w, h - hh, d, c, 0, hh, 0);
    doorLines(g, w, h - hh, d, Math.max(1, Math.round(w / 0.6)), hh, hh + 0.1);
    box(g, w - 0.01, hh - 0.01, d - 0.02, '#c0c4c6', 0, 0.01, -0.01, METAL);
    box(g, w - 0.01, 0.04, 0.03, '#a7abae', 0, 0.01, d / 2 + 0.005, METAL);
    box(g, w - 0.1, 0.005, d - 0.1, '#3a3d40', 0, 0.006, -0.02);
    for (const s of [-1, 1]) cyl(g, 0.03, 0.03, 0.004, '#fff6dc', s * w * 0.25, 0.004, 0.02, { emissive: '#fff1c9', emissiveIntensity: 0.8 }, 16);
  },
  // Chimney hood: a tapered canopy and a flue going up to the ceiling.
  chimneyHood(g, w, d, h, c) {
    const canopy = 0.28;
    box(g, w, 0.05, d, c, 0, 0, 0, METAL);
    box(g, w - 0.06, 0.004, d - 0.06, '#3a3d40', 0, -0.002, 0);
    const taper = new THREE.Group();
    taper.scale.set(w, 1, d);
    g.add(taper);
    const top = 0.34 / Math.max(w, d);
    const m = cyl(taper, top / Math.SQRT2, 1 / Math.SQRT2, canopy - 0.05, c, 0, 0.05, 0, METAL, 4);
    m.rotation.y = Math.PI / 4;
    box(g, 0.3, Math.max(0.1, h - canopy), 0.26, c, 0, canopy, -d / 2 + 0.13, METAL);
  },
  fridge(g, w, d, h, c) {
    box(g, w, h, d, c, 0, 0, 0, { roughness: 0.35 });
    box(g, w - 0.01, 0.006, 0.004, '#999', 0, h * 0.62, d / 2 + 0.002);
    box(g, 0.02, 0.35, 0.03, '#999', w / 2 - 0.06, h * 0.62 + 0.08, d / 2 + 0.015, METAL);
    box(g, 0.02, 0.35, 0.03, '#999', w / 2 - 0.06, h * 0.62 - 0.45, d / 2 + 0.015, METAL);
  },
  washer(g, w, d, h, c) {
    box(g, w, h, d, c, 0, 0, 0, { roughness: 0.35 });
    const door = cyl(g, 0.17, 0.17, 0.03, '#9aa6ad', 0, 0, 0, { roughness: 0.15 }, 36);
    door.rotation.x = Math.PI / 2;
    door.position.set(0, h * 0.45, d / 2 + 0.01);
    box(g, w - 0.04, 0.08, 0.005, '#d0d0d0', 0, h - 0.12, d / 2 + 0.003);
  },
  toilet(g, w, d, h, c) {
    const bowl = cyl(g, w / 2, w / 2.4, 0.4, c, 0, 0, 0.08, { roughness: 0.2 });
    bowl.scale.z = 1.3;
    box(g, w, 0.04, w * 1.25, c, 0, 0.4, 0.08, { roughness: 0.2 });
    box(g, w * 0.95, Math.max(0.2, h - 0.4), 0.18, c, 0, 0.4, -d / 2 + 0.09, { roughness: 0.2 });
  },
  bidet(g, w, d, h, c) {
    const back = -d / 2 + 0.05;
    box(g, w * 0.7, h, 0.1, c, 0, 0, back, { roughness: 0.2 });
    const bowl = cyl(g, w / 2, w / 2.4, h, c, 0, 0, 0.04, { roughness: 0.2 });
    bowl.scale.z = (d - 0.08) / w;
    const basin = cyl(g, w / 2 - 0.04, w / 2 - 0.04, 0.004, '#dfe7ea', 0, h, 0.05, { roughness: 0.1 });
    basin.scale.z = (d - 0.16) / (w - 0.08);
    cyl(g, 0.014, 0.014, 0.12, '#c0c4c6', 0, h, back + 0.03, METAL);
    box(g, 0.022, 0.022, 0.09, '#c0c4c6', 0, h + 0.1, back + 0.075, METAL);
  },
  washbasin(g, w, d, h, c) {
    box(g, w - 0.04, h - 0.32, d - 0.04, c, 0, 0.18, -0.02);
    drawers(g, w - 0.04, h - 0.32, d - 0.04, 1, 0.18);
    box(g, w, 0.14, d, WHITE, 0, h - 0.14, 0, { roughness: 0.2 });
    cyl(g, 0.012, 0.012, 0.18, '#c0c4c6', 0, h, -d / 2 + 0.06, METAL);
    box(g, Math.min(0.45, w * 0.7), 0.6, 0.02, '#cfe0e8', 0, h + 0.25, -d / 2 + 0.01, { roughness: 0.05, metalness: 0.5 });
  },
  shower(g, w, d, h, c) {
    box(g, w, 0.06, d, WHITE, 0, 0, 0, { roughness: 0.25 });
    box(g, w, h - 0.06, 0.01, c, 0, 0.06, d / 2 - 0.005, GLASS);
    box(g, 0.01, h - 0.06, d, c, w / 2 - 0.005, 0.06, 0, GLASS);
    cyl(g, 0.012, 0.012, h - 0.2, '#c0c4c6', -w / 2 + 0.08, 0.06, -d / 2 + 0.05, METAL);
    cyl(g, 0.11, 0.11, 0.015, '#c0c4c6', -w / 2 + 0.2, h - 0.2, -d / 2 + 0.18, METAL);
  },
  bathtub(g, w, d, h, c) {
    box(g, w, h, d, c, 0, 0, 0, { roughness: 0.2 });
    box(g, w - 0.14, 0.004, d - 0.14, '#bcd6e2', 0, h, 0, { roughness: 0.1 });
    cyl(g, 0.012, 0.012, 0.18, '#c0c4c6', -w / 2 + 0.05, h, 0, METAL);
  },
  rug(g, w, d, h, c) {
    const m = box(g, w, Math.max(h, 0.008), d, c, 0, 0, 0, { roughness: 1 });
    m.castShadow = false;
    box(g, w - 0.12, 0.002, d - 0.12, shade(c, 0.12), 0, Math.max(h, 0.008), 0, { roughness: 1 }).castShadow = false;
  },
  lamp(g, w, d, h, c) {
    cyl(g, w * 0.4, w * 0.45, 0.03, DARK, 0, 0, 0);
    cyl(g, 0.012, 0.012, h - 0.3, DARK, 0, 0.03, 0, METAL);
    cyl(g, w * 0.3, w * 0.5, 0.3, c, 0, h - 0.3, 0, { emissive: baseColor(c), emissiveIntensity: 0.25, side: THREE.DoubleSide }, 32);
  },
  plant(g, w, d, h, c) {
    cyl(g, w * 0.35, w * 0.28, h * 0.3, c, 0, 0, 0);
    const r = mulberry(Math.round(h * 100));
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(w * (0.25 + r() * 0.15), 1), mat(i % 2 ? '#4f7f3f' : '#3d6b34', { flatShading: true }));
      s.position.set((r() - 0.5) * w * 0.4, h * 0.45 + r() * h * 0.42, (r() - 0.5) * d * 0.4);
      s.castShadow = true;
      g.add(s);
    }
  },
  door(g, w, d, h, c) {
    const f = 0.06;
    for (const s of [-1, 1]) box(g, f, h, d + 0.03, WHITE, s * (w / 2 - f / 2), 0, 0);
    box(g, w, f, d + 0.03, WHITE, 0, h - f, 0);
    const lw = w - 2 * f;
    // The leaf turns on its hinge (left side) towards +z; walking you open and close it.
    const leaf = hinged(g, -lw / 2, 0, 0, { axis: 'y', to: -Math.PI / 2 });
    box(leaf, lw, h - f - 0.01, 0.04, c, lw / 2, 0.01, 0);
    box(leaf, 0.12, 0.02, 0.06, '#9a9a9a', lw - 0.1, 1.0, 0, METAL);
    g.children.forEach(m => { m.userData.tall = true; });
    // Swing arc on the floor (stays visible with low walls).
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(lw - 0.012, lw, 32, 1, 0, Math.PI / 2),
      mat('#7a8794', { side: THREE.DoubleSide }),
    );
    arc.rotation.x = Math.PI / 2;
    arc.position.set(-lw / 2, 0.004, d / 2);
    arc.userData.swing = true;
    g.add(arc);
    const line = box(g, 0.012, 0.002, lw, '#7a8794', -lw / 2 + 0.006, 0.003, d / 2 + lw / 2);
    line.castShadow = false;
    line.userData.swing = true;
  },
  // Two leaves with glass, opening from the middle.
  doubleDoor(g, w, d, h, c) {
    const f = 0.06;
    doorFrame(g, w, d, h, f);
    const lw = (w - 2 * f) / 2;
    for (const s of [-1, 1]) {
      const leaf = hinged(g, s * (w / 2 - f), 0, 0, { axis: 'y', to: (s * Math.PI) / 2 });
      const cx = (-s * lw) / 2;
      for (const x of [cx - lw / 2 + 0.05, cx + lw / 2 - 0.05]) box(leaf, 0.1, h - f - 0.01, 0.045, c, x, 0.01, 0);
      for (const y of [0.01, 0.9, h - f - 0.12]) box(leaf, lw - 0.2, 0.11, 0.045, c, cx, y, 0);
      for (const [y0, y1] of [[0.12, 0.9], [1.01, h - f - 0.12]]) box(leaf, lw - 0.2, y1 - y0, 0.01, '#bfe0f0', cx, y0, 0, GLASS);
      box(leaf, 0.02, 0.18, 0.06, '#9a9a9a', -s * (lw - 0.07), 0.95, 0, METAL);
      swingArc(g, s * (w / 2 - f), lw, d, s);
    }
    g.children.forEach(m => { if (!m.userData.swing) m.userData.tall = true; });
  },
  // Pocket door: the leaf slides into the wall.
  pocketDoor(g, w, d, h, c) {
    const f = 0.06;
    doorFrame(g, w, d, h, f);
    const lw = w - 2 * f;
    const leaf = hinged(g, 0, 0, 0, { slide: -(lw - 0.06) });
    box(leaf, lw, h - f - 0.01, 0.04, c, 0, 0.01, 0);
    for (const z of [-1, 1]) box(leaf, 0.03, 0.12, 0.004, '#9a9a9a', lw / 2 - 0.06, 0.95, z * 0.022, METAL);
    g.children.forEach(m => { m.userData.tall = true; });
  },
  // Armoured front door: thick panelled leaf, long handle, spy hole.
  frontDoor(g, w, d, h, c) {
    const f = 0.08;
    doorFrame(g, w, d, h, f, '#3b3f45');
    const lw = w - 2 * f;
    const leaf = hinged(g, -lw / 2, 0, 0, { axis: 'y', to: -Math.PI / 2 });
    box(leaf, lw, h - f - 0.01, 0.07, c, lw / 2, 0.01, 0, { roughness: 0.5 });
    for (const z of [-1, 1]) for (const [y0, y1] of [[0.15, 0.95], [1.1, h - f - 0.15]]) box(leaf, lw - 0.2, y1 - y0, 0.01, shade(c, 0.06), lw / 2, y0, z * 0.038, { roughness: 0.5 });
    for (const z of [-1, 1]) box(leaf, 0.03, 0.4, 0.04, '#c0c4c6', lw - 0.1, 0.85, z * 0.05, METAL);
    for (const z of [-1, 1]) cyl(leaf, 0.008, 0.008, 0.01, '#c9a24a', lw / 2, 1.5, z * 0.04, METAL, 10).rotation.x = Math.PI / 2;
    box(g, w, 0.02, d + 0.06, '#7d776e', 0, 0, 0);
    g.children.forEach(m => { if (!m.userData.swing) m.userData.tall = true; });
    swingArc(g, -lw / 2, lw, d, -1);
  },
  // Up-and-over garage door: the panel tips up into the garage.
  garageDoor(g, w, d, h, c) {
    const f = 0.08;
    doorFrame(g, w, d, h, f, '#5b5f63');
    const leaf = hinged(g, 0, h - f, 0, { axis: 'x', to: -Math.PI / 2 });
    const ph = h - f - 0.01;
    box(leaf, w - 2 * f, ph, 0.04, c, 0, -ph, 0, { roughness: 0.4, metalness: 0.3 });
    for (let y = 0.15; y < ph; y += 0.15) for (const z of [-1, 1]) box(leaf, w - 2 * f - 0.04, 0.012, 0.004, shade(c, -0.12), 0, -y, z * 0.022);
    for (const z of [-1, 1]) box(leaf, 0.2, 0.03, 0.03, '#2b2b2b', 0, -ph + 0.25, z * 0.03);
    g.children.forEach(m => { m.userData.tall = true; });
  },
  arch(g, w, d, h, c) {
    const f = 0.05;
    for (const s of [-1, 1]) box(g, f, h, d + 0.02, c, s * (w / 2 - f / 2), 0, 0);
    box(g, w, f, d + 0.02, c, 0, h - f, 0);
    g.children.forEach(m => { m.userData.tall = true; });
  },
  // Casement window or French window: one sash, or two meeting in the middle when wide.
  // The sashes swing towards +z (main.js mirrors them so they open into the room).
  window(g, w, d, h, c) {
    const f = 0.05;
    frame(g, w, d, h, c, f);
    if (h < 1.8) box(g, w + 0.06, 0.03, d + 0.08, WHITE, 0, -0.03, 0.02);
    const iw = w - 2 * f, ih = h - 2 * f;
    if (w > 0.8) {
      for (const s of [-1, 1]) {
        const sash = hinged(g, s * iw / 2, f, 0, { axis: 'y', to: s * Math.PI / 2 });
        glassPane(sash, iw / 2, ih, c, (-s * iw) / 4, -s);
      }
    } else {
      const sash = hinged(g, -iw / 2, f, 0, { axis: 'y', to: -Math.PI / 2 });
      glassPane(sash, iw, ih, c, iw / 2, 1);
    }
    g.children.forEach(m => { m.userData.tall = true; });
  },
  // Lift-and-slide glass wall: the right panel slides behind the left one.
  slider(g, w, d, h, c) {
    const f = 0.05;
    frame(g, w, d, h, c, f);
    const iw = w - 2 * f, ih = h - 2 * f, pw = iw / 2 + 0.03;
    const fixed = new THREE.Group();
    fixed.position.set(-iw / 2 + pw / 2, f, -0.027);
    g.add(fixed);
    glassPane(fixed, pw, ih, c, 0, 0);
    const moving = hinged(g, iw / 2 - pw / 2, f, 0.027, { slide: -(pw - 0.1) });
    glassPane(moving, pw, ih, c, 0, -1);
    g.children.forEach(m => { m.userData.tall = true; });
  },
  // Small high window for bathrooms: bottom-hinged sash that tilts in, frosted glass, handle on top.
  vasistas(g, w, d, h, c) {
    const f = 0.04;
    frame(g, w, d, h, c, f);
    box(g, w - 2 * f, 0.012, 0.03, shade(c, -0.12), 0, f, 0);
    const sh = h - 2 * f;
    const sash = hinged(g, 0, f, 0, { axis: 'x', to: 0.38 });
    box(sash, w - 2 * f, sh, 0.012, '#d3e3ea', 0, 0, 0, { transparent: true, opacity: 0.75, roughness: 0.55 });
    for (const s of [-1, 1]) box(sash, 0.1, 0.018, 0.025, '#9a9a9a', 0, sh - 0.04, s * 0.02, METAL);
    g.children.forEach(m => { m.userData.tall = true; });
  },
};

// A part that opens: a group placed on its hinge (or slide start) carrying userData.move,
// which main.js animates: { axis, to } turns it by `to` radians, { slide } moves it along x.
function doorFrame(g, w, d, h, f, color = WHITE) {
  for (const s of [-1, 1]) box(g, f, h, d + 0.03, color, s * (w / 2 - f / 2), 0, 0);
  box(g, w, f, d + 0.03, color, 0, h - f, 0);
}

// Quarter circle on the floor showing where a leaf hinged at x swings (s = -1 left hinge, 1 right).
function swingArc(g, x, r, d, s) {
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(r - 0.012, r, 32, 1, s < 0 ? 0 : Math.PI / 2, Math.PI / 2),
    mat('#7a8794', { side: THREE.DoubleSide }),
  );
  arc.rotation.x = Math.PI / 2;
  arc.position.set(x, 0.004, d / 2);
  arc.userData.swing = true;
  g.add(arc);
}

function hinged(g, x, y, z, move) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.userData.move = { ...move, x0: x };
  g.add(p);
  return p;
}

function frame(g, w, d, h, c, f) {
  for (const s of [-1, 1]) box(g, f, h, d + 0.02, c, s * (w / 2 - f / 2), 0, 0);
  box(g, w, f, d + 0.02, c, 0, h - f, 0);
  box(g, w, f, d + 0.02, c, 0, 0, 0);
}

// Glass with a thin sash profile, centred at x = cx; `handle` puts the handle on that side (0: none).
function glassPane(g, w, h, c, cx, handle) {
  const p = 0.04;
  for (const s of [-1, 1]) box(g, p, h, 0.05, c, cx + s * (w / 2 - p / 2), 0, 0);
  for (const y of [0, h - p]) box(g, w - 2 * p, p, 0.05, c, cx, y, 0);
  box(g, w - 2 * p, h - 2 * p, 0.01, '#bfe0f0', cx, p, 0, GLASS);
  if (handle) box(g, 0.025, 0.13, 0.03, '#9a9a9a', cx + handle * (w / 2 - 0.06), Math.min(1.05, h / 2), 0.035, METAL);
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

Object.assign(B, decorBuilders({ box, cyl, mat, shade, mulberry, def: it => TYPES[it.type], DARK, WHITE, METAL, GLASS }));

// Defaults in cm. `elev` = height from the floor; `opening` = cut into a wall.
// `wallMount` = hangs on a wall (turns its back to it); `ceiling` = hangs from the ceiling;
// `surface` = has a top to put things on (true: at its height, or a number in cm);
// `onTop` = small piece that lands on the furniture under it;
// `outdoor` = may stand outside the rooms; `hit` = share of the footprint that blocks
// walking (trunks, poles) or 'posts' (only the four corners).
export const CATALOG = [
  { cat: 'Soggiorno', items: [
    { type: 'sofa3', name: 'Divano 3 posti', build: 'sofa', w: 220, d: 95, h: 85, color: '#7d8a96' },
    { type: 'sofa2', name: 'Divano 2 posti', build: 'sofa', w: 165, d: 90, h: 85, color: '#a39382' },
    { type: 'armchair', name: 'Poltrona', build: 'armchair', w: 85, d: 85, h: 85, color: '#b8735a' },
    { type: 'coffeeTable', name: 'Tavolino', build: 'coffeeTable', w: 100, d: 55, h: 42, color: '#c9a57a', surface: true },
    { type: 'tvStand', name: 'Mobile TV', build: 'tvStand', w: 160, d: 40, h: 45, color: '#f2f0eb', surface: true },
    { type: 'bookshelf', name: 'Libreria', build: 'bookshelf', w: 80, d: 30, h: 200, color: '#e8dcc6', surface: true },
    { type: 'cornerSofa', name: 'Divano angolare', build: 'cornerSofa', w: 280, d: 170, h: 85, color: '#7d8a96' },
    { type: 'sideboard', name: 'Madia', build: 'sideboard', w: 180, d: 45, h: 80, color: 'wood:oak', surface: true },
    { type: 'tvUnit', name: 'Parete attrezzata TV', build: 'tvUnit', w: 300, d: 45, h: 200, color: '#f2f0eb', surface: 45 },
    { type: 'displayCabinet', name: 'Vetrina', build: 'displayCabinet', w: 90, d: 40, h: 190, color: 'wood:walnut', surface: true },
    { type: 'cubeShelf', name: 'Libreria a cubi', build: 'cubeShelf', w: 147, d: 39, h: 147, color: '#f2f0eb', surface: true },
    { type: 'floatingShelves', name: 'Mensole sfalsate', build: 'floatingShelves', w: 120, d: 20, h: 80, elev: 120, color: 'wood:oak', wallMount: true },
    { type: 'wallCupboard', name: 'Pensile soggiorno', build: 'wallCupboard', w: 120, d: 35, h: 40, elev: 150, color: '#f2f0eb', wallMount: true },
    { type: 'sideTable', name: 'Tavolino laterale', build: 'sideTable', w: 45, d: 45, h: 55, color: 'wood:walnut', surface: true },
    { type: 'pouf', name: 'Pouf', build: 'pouf', w: 50, d: 50, h: 42, color: '#d9b44a' },
    { type: 'beanBag', name: 'Poltrona sacco', build: 'beanBag', w: 85, d: 85, h: 75, color: '#56704f' },
    { type: 'fireplace', name: 'Camino', build: 'fireplace', w: 140, d: 40, h: 110, color: '#efebe4', surface: true },
    { type: 'curtains', name: 'Tende', build: 'curtains', w: 180, d: 15, h: 250, elev: 10, color: '#e9e1d3', wallMount: true, noCollide: true },
    { type: 'radiator', name: 'Termosifone', build: 'radiator', w: 80, d: 10, h: 60, elev: 12, color: '#ffffff', wallMount: true },
    { type: 'blind', name: 'Veneziana', build: 'blind', w: 120, d: 6, h: 140, elev: 85, color: '#f4f3ef', wallMount: true, noCollide: true },
  ] },
  { cat: 'Bambini', items: [
    { type: 'bunkBed', name: 'Letto a castello', build: 'bunkBed', w: 100, d: 205, h: 165, color: 'wood:ash' },
    { type: 'crib', name: 'Lettino neonato', build: 'crib', w: 70, d: 130, h: 90, color: '#ffffff' },
    { type: 'changingTable', name: 'Fasciatoio', build: 'changingTable', w: 80, d: 55, h: 95, color: '#ffffff' },
    { type: 'toyBox', name: 'Cesta dei giochi', build: 'toyBox', w: 60, d: 40, h: 40, color: '#e8b7a8' },
    { type: 'teepee', name: 'Tenda indiana', build: 'teepee', w: 120, d: 120, h: 165, color: '#f2ead8' },
    { type: 'rockingHorse', name: 'Cavallo a dondolo', build: 'rockingHorse', w: 32, d: 80, h: 70, color: '#d94a3a' },
  ] },
  { cat: 'Lavanderia e clima', items: [
    { type: 'dryer', name: 'Asciugatrice', build: 'washer', w: 60, d: 62, h: 85, color: '#e6e8ea', surface: true },
    { type: 'dryingRack', name: 'Stendino', build: 'dryingRack', w: 140, d: 55, h: 95, color: '#c0c4c6' },
    { type: 'ironingBoard', name: 'Asse da stiro', build: 'ironingBoard', w: 120, d: 38, h: 90, color: '#9fb8c8' },
    { type: 'vacuum', name: 'Aspirapolvere', build: 'vacuum', w: 26, d: 25, h: 110, color: '#8c6bb1' },
    { type: 'boiler', name: 'Caldaia murale', build: 'boiler', w: 42, d: 30, h: 70, elev: 140, color: '#f4f3ef', wallMount: true },
    { type: 'airConditioner', name: 'Condizionatore', build: 'airConditioner', w: 90, d: 25, h: 30, elev: 215, color: '#ffffff', wallMount: true },
    { type: 'ceilingFan', name: 'Ventilatore a soffitto', build: 'ceilingFan', w: 120, d: 120, h: 45, color: '#c9a24a', ceiling: true },
    { type: 'standFan', name: 'Ventilatore a piantana', build: 'standFan', w: 45, d: 45, h: 130, color: '#f4f3ef' },
  ] },
  { cat: 'Sport e giochi', items: [
    { type: 'treadmill', name: 'Tapis roulant', build: 'treadmill', w: 80, d: 180, h: 140, color: '#5b5f63' },
    { type: 'exerciseBike', name: 'Cyclette', build: 'exerciseBike', w: 55, d: 110, h: 130, color: '#c0392b' },
    { type: 'yogaMat', name: 'Tappetino yoga', build: 'rug', w: 61, d: 183, h: 1, color: '#8c6bb1', noCollide: true },
    { type: 'dumbbells', name: 'Rastrelliera manubri', build: 'dumbbells', w: 60, d: 35, h: 70, color: '#2b2b2b' },
    { type: 'poolTable', name: 'Biliardo', build: 'poolTable', w: 140, d: 250, h: 80, color: '#2f6b4f' },
    { type: 'pingPong', name: 'Ping pong', build: 'pingPong', w: 152, d: 274, h: 76, color: '#2f4a6b', openBelow: true },
    { type: 'dartboard', name: 'Freccette', build: 'dartboard', w: 45, d: 5, h: 45, elev: 150, color: '#1d1d1f', wallMount: true, noCollide: true },
    { type: 'bike', name: 'Bicicletta', build: 'bike', w: 60, d: 175, h: 100, color: '#3f6fb0' },
  ] },
  { cat: 'Scale', items: [
    { type: 'stairs', name: 'Scala dritta', build: 'stairs', w: 90, d: 300, h: 270, color: 'wood:oak' },
    { type: 'spiralStairs', name: 'Scala a chiocciola', build: 'spiralStairs', w: 160, d: 160, h: 270, color: 'wood:oak' },
  ] },
  { cat: 'Ingresso', items: [
    { type: 'shoeCabinet', name: 'Scarpiera', build: 'shoeCabinet', w: 80, d: 26, h: 110, color: '#f2f0eb', surface: true },
    { type: 'entryBench', name: 'Panca portascarpe', build: 'entryBench', w: 100, d: 35, h: 48, color: 'wood:oak', surface: true },
    { type: 'consoleTable', name: 'Consolle', build: 'consoleTable', w: 110, d: 35, h: 80, color: 'wood:walnut', surface: true },
    { type: 'coatRack', name: 'Appendiabiti a muro', build: 'coatRack', w: 80, d: 30, h: 30, elev: 160, color: 'wood:oak', wallMount: true, noCollide: true },
    { type: 'coatStand', name: 'Appendiabiti a stelo', build: 'coatStand', w: 45, d: 45, h: 180, color: '#2b2b2b' },
    { type: 'umbrellaStand', name: 'Portaombrelli', build: 'umbrellaStand', w: 25, d: 25, h: 50, color: '#5b5f63' },
  ] },
  { cat: 'Da appoggiare', items: [
    { type: 'booksStack', name: 'Pila di libri', build: 'booksStack', w: 25, d: 18, h: 12, color: '#2f4a6b', onTop: true, prefers: ['coffeeTable', 'nightstand', 'sideboard', 'sideTable', 'desk'] },
    { type: 'candles', name: 'Candele', build: 'candles', w: 30, d: 15, h: 22, color: '#f8f4ea', onTop: true, prefers: ['coffeeTable', 'table', 'sideboard', 'fireplace'] },
    { type: 'photoFrame', name: 'Cornice foto', build: 'photoFrame', w: 18, d: 10, h: 23, color: '#2b2b2b', onTop: true, prefers: ['sideboard', 'consoleTable', 'nightstand', 'fireplace', 'dresser'] },
    { type: 'vase', name: 'Vaso decorativo', build: 'vase', w: 18, d: 18, h: 35, color: '#c56b45', onTop: true, prefers: ['sideboard', 'consoleTable', 'fireplace', 'shoeCabinet', 'displayCabinet'] },
    { type: 'fruitBowl', name: 'Fruttiera', build: 'fruitBowl', w: 30, d: 30, h: 12, color: '#f2f0eb', onTop: true, prefers: ['table', 'roundTable', 'kitchenBase'] },
    { type: 'speaker', name: 'Cassa audio', build: 'speaker', w: 18, d: 18, h: 30, color: '#3b3f45', onTop: true, prefers: ['tvStand', 'tvUnit', 'sideboard', 'bookshelf'] },
    { type: 'recordPlayer', name: 'Giradischi', build: 'recordPlayer', w: 45, d: 35, h: 13, color: 'wood:walnut', onTop: true, prefers: ['sideboard', 'tvStand', 'cubeShelf'] },
    { type: 'microwave', name: 'Microonde', build: 'microwave', w: 50, d: 38, h: 30, color: '#2b2b2b', onTop: true, prefers: ['kitchenBase'] },
    { type: 'coffeeMachine', name: 'Macchina del caffè', build: 'coffeeMachine', w: 25, d: 35, h: 35, color: '#c0c4c6', onTop: true, prefers: ['kitchenBase'] },
  ] },
  { cat: 'Pranzo', items: [
    { type: 'table', name: 'Tavolo', build: 'table', w: 140, d: 80, h: 75, color: '#c9a57a', openBelow: true, surface: true },
    { type: 'roundTable', name: 'Tavolo rotondo', build: 'roundTable', w: 100, d: 100, h: 75, color: '#f2f0eb', openBelow: true, surface: true },
    { type: 'chair', name: 'Sedia', build: 'chair', w: 45, d: 50, h: 85, color: '#c9a57a', tucks: true },
  ] },
  { cat: 'Camera', items: [
    { type: 'bed2', name: 'Letto matrimoniale', build: 'bed', w: 160, d: 205, h: 100, color: '#d8cdbd' },
    { type: 'bed1', name: 'Letto singolo', build: 'bed', w: 90, d: 205, h: 90, color: '#d8cdbd' },
    { type: 'wardrobe', name: 'Armadio', build: 'wardrobe', w: 200, d: 60, h: 236, color: '#f2f0eb' },
    { type: 'nightstand', name: 'Comodino', build: 'nightstand', w: 45, d: 40, h: 50, color: '#c9a57a', surface: true },
    { type: 'dresser', name: 'Cassettiera', build: 'dresser', w: 80, d: 48, h: 80, color: '#f2f0eb', surface: true },
    { type: 'slidingWardrobe', name: 'Armadio scorrevole a specchio', build: 'slidingWardrobe', w: 240, d: 65, h: 240, color: '#f2f0eb' },
    { type: 'vanity', name: 'Toeletta con specchio', build: 'vanity', w: 100, d: 45, h: 145, color: '#f2f0eb', surface: 76 },
    { type: 'trunk', name: 'Baule', build: 'trunk', w: 90, d: 45, h: 50, color: 'wood:walnut', surface: true },
  ] },
  { cat: 'Cucina', items: [
    { type: 'kitchenBase', name: 'Base cucina', build: 'kitchenBase', w: 60, d: 62, h: 90, color: '#e9e6df', surface: true },
    { type: 'sinkUnit', name: 'Lavello', build: 'sinkUnit', w: 80, d: 62, h: 90, color: '#e9e6df', surface: true },
    { type: 'hobUnit', name: 'Piano cottura + forno', build: 'hobUnit', w: 60, d: 62, h: 90, color: '#e9e6df', surface: true },
    { type: 'wallCabinet', name: 'Pensile', build: 'wallCabinet', w: 60, d: 35, h: 70, elev: 145, color: '#e9e6df' },
    { type: 'hoodCabinet', name: 'Pensile con cappa', build: 'hoodCabinet', w: 60, d: 35, h: 70, elev: 145, color: '#e9e6df' },
    { type: 'chimneyHood', name: 'Cappa a camino', build: 'chimneyHood', w: 90, d: 50, h: 100, elev: 150, color: '#c0c4c6' },
    { type: 'fridge', name: 'Frigorifero', build: 'fridge', w: 60, d: 65, h: 185, color: '#e6e8ea' },
    { type: 'backsplash', name: 'Paraschizzi piastrelle', build: 'tilePanel', art: 'subway', w: 180, d: 1, h: 60, elev: 90, color: '#ffffff', wallMount: true, noCollide: true },
    { type: 'kitchenIsland', name: 'Isola cucina', build: 'kitchenIsland', w: 200, d: 100, h: 92, color: '#e9e6df', surface: true, openBelow: true },
    { type: 'barStool', name: 'Sgabello', build: 'barStool', w: 40, d: 40, h: 75, color: 'wood:oak', tucks: true },
    { type: 'dishwasher', name: 'Lavastoviglie', build: 'dishwasher', w: 60, d: 62, h: 90, color: '#e6e8ea', surface: true },
    { type: 'ovenColumn', name: 'Colonna forno', build: 'ovenColumn', w: 60, d: 62, h: 215, color: '#e9e6df' },
    { type: 'trashBin', name: 'Pattumiera', build: 'trashBin', w: 30, d: 30, h: 50, color: '#c0c4c6' },
    { type: 'spiceRack', name: 'Portaspezie a muro', build: 'spiceRack', w: 50, d: 10, h: 25, elev: 115, color: 'wood:oak', wallMount: true, noCollide: true },
    { type: 'utensilRail', name: 'Barra portautensili', build: 'utensilRail', w: 80, d: 8, h: 40, elev: 110, color: '#c0c4c6', wallMount: true, noCollide: true },
    { type: 'kettle', name: 'Bollitore', build: 'kettle', w: 22, d: 16, h: 25, color: '#f2f0eb', onTop: true, prefers: ['kitchenBase', 'kitchenIsland'] },
    { type: 'toaster', name: 'Tostapane', build: 'toaster', w: 28, d: 18, h: 20, color: '#d94a3a', onTop: true, prefers: ['kitchenBase', 'kitchenIsland'] },
    { type: 'knifeBlock', name: 'Ceppo coltelli', build: 'knifeBlock', w: 12, d: 20, h: 30, color: 'wood:oak', onTop: true, prefers: ['kitchenBase', 'kitchenIsland'] },
    { type: 'utensilHolder', name: 'Portamestoli', build: 'utensilHolder', w: 12, d: 12, h: 32, color: '#f2f0eb', onTop: true, prefers: ['kitchenBase', 'kitchenIsland'] },
    { type: 'dishRack', name: 'Scolapiatti', build: 'dishRack', w: 45, d: 32, h: 25, color: '#c0c4c6', onTop: true, prefers: ['sinkUnit', 'kitchenBase'] },
    { type: 'pots', name: 'Pentole', build: 'pots', w: 55, d: 45, h: 18, color: '#c0c4c6', onTop: true, prefers: ['hobUnit'] },
    { type: 'jars', name: 'Barattoli', build: 'jars', w: 35, d: 12, h: 22, color: '#e6f0f2', onTop: true, prefers: ['kitchenBase', 'kitchenIsland'] },
    { type: 'cuttingBoard', name: 'Tagliere', build: 'cuttingBoard', w: 40, d: 28, h: 2, color: 'wood:oak', onTop: true, prefers: ['kitchenIsland', 'kitchenBase', 'table'] },
  ] },
  { cat: 'Bagno', items: [
    { type: 'toilet', name: 'WC', build: 'toilet', w: 38, d: 60, h: 80, color: '#ffffff' },
    { type: 'bidet', name: 'Bidet', build: 'bidet', w: 38, d: 55, h: 40, color: '#ffffff' },
    { type: 'washbasin', name: 'Lavabo con mobile', build: 'washbasin', w: 60, d: 46, h: 85, color: '#8a7560', surface: true },
    { type: 'shower', name: 'Doccia', build: 'shower', w: 90, d: 90, h: 200, color: '#dfefff' },
    { type: 'bathtub', name: 'Vasca', build: 'bathtub', w: 170, d: 75, h: 55, color: '#ffffff' },
    { type: 'washer', name: 'Lavatrice', build: 'washer', w: 60, d: 60, h: 85, color: '#f2f3f4', surface: true },
    { type: 'tilesSubway', name: 'Rivestimento piastrelle', build: 'tilePanel', art: 'subway', w: 120, d: 1, h: 200, color: '#ffffff', wallMount: true, noCollide: true },
    { type: 'tilesMosaic', name: 'Rivestimento mosaico', build: 'tilePanel', art: 'wallMosaic', w: 120, d: 1, h: 200, color: '#ffffff', wallMount: true, noCollide: true },
    { type: 'tilesHex', name: 'Rivestimento esagonale', build: 'tilePanel', art: 'wallHex', w: 120, d: 1, h: 120, color: '#ffffff', wallMount: true, noCollide: true },
    { type: 'mirrorCabinet', name: 'Pensile a specchio', build: 'mirrorCabinet', w: 70, d: 15, h: 65, elev: 125, color: '#ffffff', wallMount: true },
    { type: 'towelRail', name: 'Portasciugamani', build: 'towelRail', w: 60, d: 10, h: 35, elev: 95, color: '#9fb8c8', wallMount: true, noCollide: true },
    { type: 'towelRadiator', name: 'Scaldasalviette', build: 'towelRadiator', w: 50, d: 10, h: 120, elev: 20, color: '#f4f3ef', wallMount: true },
    { type: 'toiletPaper', name: 'Portarotolo', build: 'toiletPaper', w: 16, d: 13, h: 12, elev: 65, color: '#c0c4c6', wallMount: true, noCollide: true },
    { type: 'bathMat', name: 'Tappetino bagno', build: 'rug', w: 70, d: 45, h: 2, color: '#9fb8c8', noCollide: true },
    { type: 'laundryBasket', name: 'Cesto biancheria', build: 'laundryBasket', w: 40, d: 40, h: 55, color: '#d9c4a0' },
    { type: 'ladderShelf', name: 'Scaletta portasciugamani', build: 'ladderShelf', w: 50, d: 35, h: 170, color: 'wood:ash', wallMount: true },
    { type: 'bathSet', name: 'Set lavabo (sapone e spazzolini)', build: 'bathSet', w: 25, d: 10, h: 18, color: '#e9e1d3', onTop: true, prefers: ['washbasin'] },
    { type: 'bathScale', name: 'Bilancia', build: 'scale', w: 30, d: 30, h: 3, color: '#f4f3ef', noCollide: true },
  ] },
  { cat: 'Ufficio', items: [
    { type: 'desk', name: 'Scrivania', build: 'desk', w: 140, d: 70, h: 75, color: '#f2f0eb', openBelow: true, surface: true },
    { type: 'officeChair', name: 'Sedia da ufficio', build: 'officeChair', w: 60, d: 60, h: 105, color: '#3b3f45', tucks: true },
    { type: 'lDesk', name: 'Scrivania angolare', build: 'lDesk', w: 160, d: 140, h: 75, color: '#f2f0eb', surface: true, openBelow: true },
    { type: 'filingCabinet', name: 'Cassettiera con ruote', build: 'filingCabinet', w: 42, d: 55, h: 62, color: '#f2f0eb', surface: true },
    { type: 'pinBoard', name: 'Bacheca', build: 'pinBoard', w: 90, d: 3, h: 60, elev: 110, color: 'wood:oak', wallMount: true, noCollide: true },
  ] },
  { cat: 'Tecnologia', items: [
    { type: 'pc', name: 'PC (monitor e tastiera)', build: 'pc', w: 60, d: 35, h: 45, elev: 75, color: '#2b2b2b', onTop: true, prefers: ['desk'] },
    { type: 'pcTower', name: 'Case PC', build: 'pcTower', w: 21, d: 45, h: 46, color: '#2b2b2b', onTop: true, prefers: ['desk'] },
    { type: 'laptop', name: 'Portatile', build: 'laptop', w: 34, d: 24, h: 22, elev: 75, color: '#b9c0c4', onTop: true, prefers: ['desk', 'table', 'coffeeTable'] },
    { type: 'printer', name: 'Stampante', build: 'printer', w: 45, d: 35, h: 22, color: '#2b2b2b', onTop: true, prefers: ['desk', 'lDesk', 'filingCabinet', 'sideboard'] },
    { type: 'gameConsole', name: 'Console videogiochi', build: 'gameConsole', w: 30, d: 20, h: 8, color: '#f4f3ef', onTop: true, prefers: ['tvStand', 'tvUnit', 'sideboard'] },
    { type: 'tvWall', name: 'TV a parete', build: 'tvWall', w: 125, d: 5, h: 72, elev: 95, color: '#1d1d1f', wallMount: true },
  ] },
  { cat: 'Luci', items: [
    { type: 'chandelier', name: 'Lampadario', build: 'chandelier', w: 75, d: 75, h: 80, color: '#c9a24a', ceiling: true },
    { type: 'pendant', name: 'Lampada a sospensione', build: 'pendant', w: 40, d: 40, h: 90, color: '#2b2b2b', ceiling: true },
    { type: 'pendantGlobe', name: 'Sospensione a sfera', build: 'pendant', shape: 'globe', w: 35, d: 35, h: 80, color: '#f3ead6', ceiling: true },
    { type: 'pendantRow', name: 'Sospensione tripla (tavolo)', build: 'pendantRow', w: 130, d: 30, h: 90, color: '#2f4a6b', ceiling: true },
    { type: 'flushLight', name: 'Plafoniera', build: 'flushLight', w: 45, d: 45, h: 10, color: '#ffffff', ceiling: true },
    { type: 'lamp', name: 'Lampada da terra', build: 'lamp', w: 40, d: 40, h: 160, color: '#f3ead6' },
    { type: 'arcLamp', name: 'Lampada ad arco', build: 'arcLamp', w: 150, d: 40, h: 200, color: '#2b2b2b', hit: 0.25 },
    { type: 'tripodLamp', name: 'Lampada treppiede', build: 'tripodLamp', w: 55, d: 55, h: 155, color: '#e9e1d3' },
    { type: 'tableLamp', name: 'Lampada da tavolo', build: 'tableLamp', w: 30, d: 30, h: 45, elev: 50, color: '#d9b44a', onTop: true, prefers: ['nightstand', 'desk', 'sideTable', 'consoleTable', 'sideboard'] },
    { type: 'bankerLamp', name: 'Lampada da scrivania verde', build: 'bankerLamp', w: 34, d: 20, h: 40, color: '#2f6b4f', onTop: true, prefers: ['desk', 'sideboard', 'consoleTable'] },
    { type: 'deskLamp', name: 'Lampada da scrivania snodata', build: 'deskLamp', w: 22, d: 40, h: 50, color: '#2b2b2b', onTop: true, prefers: ['desk'] },
    { type: 'mushroomLamp', name: 'Lampada a fungo', build: 'mushroomLamp', w: 28, d: 28, h: 34, color: '#e8b7a8', onTop: true, prefers: ['nightstand', 'desk', 'sideTable', 'consoleTable', 'sideboard', 'dresser'] },
    { type: 'globeTableLamp', name: 'Lampada a sfera da tavolo', build: 'globeTableLamp', w: 22, d: 22, h: 30, color: '#c9a24a', onTop: true, prefers: ['nightstand', 'desk', 'sideTable', 'consoleTable', 'sideboard', 'dresser'] },
    { type: 'pleatedLamp', name: 'Lampada con paralume plissé', build: 'pleatedLamp', w: 36, d: 36, h: 55, color: '#4f8a8b', onTop: true, prefers: ['nightstand', 'desk', 'sideTable', 'consoleTable', 'sideboard', 'dresser'] },
    { type: 'lantern', name: 'Lanterna', build: 'lantern', w: 20, d: 20, h: 36, color: '#2b2b2b', onTop: true, prefers: ['coffeeTable', 'consoleTable', 'fireplace', 'sideboard'] },
    { type: 'moroccanLamp', name: 'Lanterna marocchina', build: 'moroccanLamp', w: 26, d: 26, h: 48, color: '#b08a3c', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'saltLamp', name: 'Lampada di sale', build: 'saltLamp', w: 18, d: 16, h: 25, color: '#f2a07b', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'lavaLamp', name: 'Lampada lava', build: 'lavaLamp', w: 14, d: 14, h: 40, color: '#ff5fa2', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'geodeLamp', name: 'Geode di ametista', build: 'geodeLamp', w: 22, d: 16, h: 26, color: '#9b6bd6', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'gourdLamp', name: 'Zucca intagliata', build: 'gourdLamp', w: 24, d: 24, h: 40, color: '#ffffff', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'rattanLamp', name: 'Lampada in rattan', build: 'rattanLamp', w: 30, d: 30, h: 42, color: 'wood:walnut', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'mandalaLamp', name: 'Lampada mandala', build: 'mandalaLamp', w: 30, d: 30, h: 48, color: 'wood:walnut', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'tiffanyLamp', name: 'Lampada Tiffany', build: 'tiffanyLamp', w: 36, d: 36, h: 52, color: '#5a4630', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'crystalBall', name: 'Sfera di cristallo', build: 'crystalBall', w: 16, d: 16, h: 22, color: 'wood:wenge', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'totemLamp', name: 'Totem tribale', build: 'totemLamp', w: 14, d: 14, h: 45, color: '#ffffff', onTop: true, prefers: ['nightstand', 'sideTable', 'consoleTable', 'sideboard', 'dresser', 'desk'] },
    { type: 'torchiere', name: 'Lampada da terra a luce indiretta', build: 'torchiere', w: 38, d: 38, h: 180, color: '#c9a24a' },
    { type: 'globeFloor', name: 'Lampada da terra a sfera', build: 'globeFloor', w: 35, d: 35, h: 165, color: '#2b2b2b' },
    { type: 'paperLantern', name: 'Lampada di carta', build: 'paperLantern', w: 45, d: 45, h: 150, color: '#f6efe0' },
    { type: 'spotTripod', name: 'Faro su treppiede', build: 'spotTripod', w: 70, d: 70, h: 165, color: '#2b2b2b', hit: 0.4 },
    { type: 'readingLamp', name: 'Lampada da lettura', build: 'readingLamp', w: 45, d: 30, h: 140, color: '#56704f' },
    { type: 'tubeLamp', name: 'Lampada a colonna', build: 'tubeLamp', w: 25, d: 25, h: 160, color: '#3b3f45' },
    { type: 'fairy', name: 'Luci fairy', build: 'fairyLights', w: 200, d: 4, h: 45, elev: 165, color: '#ffd27a', wallMount: true, noCollide: true },
    { type: 'fairyCurtain', name: 'Tenda luminosa', build: 'fairyLights', mode: 'curtain', w: 150, d: 4, h: 180, elev: 40, color: '#ffe6a8', wallMount: true, noCollide: true },
  ] },
  { cat: 'Decorazioni', items: [
    { type: 'painting', name: 'Quadro astratto', build: 'painting', art: 'abstract', w: 80, d: 3, h: 60, elev: 140, color: '#2b2b2b', wallMount: true, noCollide: true },
    { type: 'paintingLand', name: 'Quadro paesaggio', build: 'painting', art: 'landscape', w: 100, d: 3, h: 70, elev: 135, color: 'wood:oak', wallMount: true, noCollide: true },
    { type: 'poster', name: 'Poster', build: 'poster', art: 'poster', w: 50, d: 1, h: 70, elev: 130, color: '#ffffff', wallMount: true, noCollide: true },
    { type: 'mandala', name: 'Arazzo mandala', build: 'tapestry', art: 'mandala', w: 130, d: 3, h: 150, elev: 70, color: 'wood:oak', wallMount: true, noCollide: true },
    { type: 'mirror', name: 'Specchio', build: 'mirror', w: 60, d: 3, h: 90, elev: 110, color: 'wood:oak', wallMount: true, noCollide: true },
    { type: 'mirrorRound', name: 'Specchio rotondo', build: 'mirror', round: true, w: 60, d: 3, h: 60, elev: 130, color: '#c9a24a', wallMount: true, noCollide: true },
    { type: 'clock', name: 'Orologio da parete', build: 'clock', w: 35, d: 5, h: 35, elev: 180, color: '#2b2b2b', wallMount: true, noCollide: true },
    { type: 'dreamcatcher', name: 'Acchiappasogni', build: 'dreamcatcher', w: 35, d: 3, h: 80, elev: 120, color: '#c9a57a', wallMount: true, noCollide: true },
    { type: 'wallShelf', name: 'Mensola con libri', build: 'wallShelf', w: 80, d: 22, h: 30, elev: 150, color: 'wood:oak', wallMount: true, surface: 2.5 },
    { type: 'flowers', name: 'Vaso con fiori', build: 'flowers', w: 25, d: 25, h: 50, elev: 75, color: '#dfe7ea', onTop: true, prefers: ['table', 'roundTable', 'coffeeTable', 'sideboard', 'consoleTable', 'sideTable'] },
  ] },
  { cat: 'Tappeti', items: [
    { type: 'rug', name: 'Tappeto', build: 'rug', w: 200, d: 140, h: 1, color: '#9c8f7c', noCollide: true },
    { type: 'rugPersian', name: 'Tappeto persiano', build: 'patternRug', art: 'persian', w: 200, d: 300, h: 1, color: '#8b2f2f', noCollide: true },
    { type: 'rugBerber', name: 'Tappeto berbero', build: 'patternRug', art: 'berber', w: 160, d: 230, h: 2, color: '#efe7d8', noCollide: true },
    { type: 'rugKilim', name: 'Tappeto kilim', build: 'patternRug', art: 'kilim', w: 140, d: 200, h: 1, color: '#c56b45', noCollide: true },
    { type: 'runner', name: 'Passatoia', build: 'patternRug', art: 'kilim', w: 70, d: 250, h: 1, color: '#2f4a6b', noCollide: true },
    { type: 'rugRound', name: 'Tappeto rotondo', build: 'roundRug', w: 150, d: 150, h: 1, color: '#d9d6cf', noCollide: true },
    { type: 'rugMandala', name: 'Tappeto mandala', build: 'roundRug', art: 'mandala', w: 160, d: 160, h: 1, color: '#24304f', noCollide: true },
  ] },
  { cat: 'Piante', items: [
    { type: 'plant', name: 'Pianta', build: 'plant', w: 45, d: 45, h: 110, color: '#c56b45' },
    { type: 'monstera', name: 'Monstera', build: 'monstera', w: 80, d: 80, h: 120, color: '#f2f0eb' },
    { type: 'snakePlant', name: 'Sansevieria', build: 'snakePlant', w: 35, d: 35, h: 90, color: '#3b3f45' },
    { type: 'palm', name: 'Palma areca', build: 'palm', w: 90, d: 90, h: 170, color: '#e9e1d3' },
    { type: 'ficus', name: 'Ficus lyrata', build: 'indoorTree', w: 60, d: 60, h: 180, color: '#b8735a' },
    { type: 'oliveIndoor', name: 'Ulivo in vaso', build: 'indoorTree', leaf: 'olive', w: 70, d: 70, h: 170, color: '#e9e1d3' },
    { type: 'fern', name: 'Felce', build: 'fern', w: 60, d: 60, h: 65, color: '#5b5f63' },
    { type: 'cactus', name: 'Cactus', build: 'cactus', w: 35, d: 35, h: 90, color: '#c56b45' },
    { type: 'succulents', name: 'Piante grasse', build: 'succulents', w: 30, d: 30, h: 15, elev: 75, color: '#e9e1d3', onTop: true, prefers: ['desk', 'bookshelf', 'sideboard', 'coffeeTable'] },
    { type: 'bonsai', name: 'Bonsai', build: 'bonsai', w: 35, d: 25, h: 35, elev: 75, color: '#3b3f45', onTop: true, prefers: ['desk', 'sideboard', 'consoleTable'] },
    { type: 'hangingPlant', name: 'Pianta pendente', build: 'hangingPlant', w: 45, d: 45, h: 110, color: '#f2f0eb', ceiling: true },
  ] },
  { cat: 'Musica', items: [
    { type: 'guitarWall', name: 'Chitarra a parete', build: 'guitarWall', w: 40, d: 14, h: 100, elev: 95, color: '#c9a57a', wallMount: true },
    { type: 'guitarStand', name: 'Chitarra su supporto', build: 'guitarStand', w: 42, d: 45, h: 105, color: '#c9a57a' },
    { type: 'eGuitarWall', name: 'Chitarra elettrica a parete', build: 'guitarWall', electric: true, w: 35, d: 10, h: 100, elev: 95, color: '#8b2f2f', wallMount: true },
    { type: 'eGuitarStand', name: 'Chitarra elettrica su supporto', build: 'guitarStand', electric: true, w: 38, d: 45, h: 102, color: '#2f4a6b' },
    { type: 'pianoDigital', name: 'Pianoforte digitale', build: 'pianoDigital', w: 135, d: 35, h: 90, color: '#2b2b2b' },
    { type: 'piano', name: 'Pianoforte verticale', build: 'pianoUpright', w: 150, d: 60, h: 125, color: '#1d1d1f', surface: true },
    { type: 'drums', name: 'Batteria', build: 'drums', w: 160, d: 130, h: 120, color: '#8b2f2f' },
    { type: 'amp', name: 'Amplificatore', build: 'amp', w: 50, d: 26, h: 45, color: '#2b2b2b', onTop: true, prefers: ['tvStand', 'sideboard'] },
  ] },
  { cat: 'Animali', items: [
    { type: 'dogBed', name: 'Cuccia cane', build: 'petBed', w: 90, d: 70, h: 22, color: '#7d8a96' },
    { type: 'catBed', name: 'Cuccia gatto', build: 'petBed', w: 50, d: 50, h: 18, color: '#e8b7a8' },
    { type: 'catTree', name: 'Tiragraffi', build: 'catTree', w: 55, d: 55, h: 150, color: '#e9e1d3' },
    { type: 'bowls', name: 'Ciotole', build: 'bowls', w: 40, d: 22, h: 8, color: '#c0c4c6', noCollide: true },
    { type: 'litterBox', name: 'Lettiera gatto', build: 'litterBox', w: 50, d: 40, h: 40, color: '#b9c0c4' },
    { type: 'aquarium', name: 'Acquario', build: 'aquarium', w: 100, d: 40, h: 130, color: 'wood:walnut' },
    { type: 'dogHouse', name: 'Casetta cane (fuori)', build: 'dogHouse', w: 80, d: 100, h: 85, color: 'wood:oak', outdoor: true },
  ] },
  { cat: 'Giardino', items: [
    { type: 'tree', name: 'Albero', build: 'tree', w: 350, d: 350, h: 500, color: '#6e5a46', outdoor: true, hit: 0.1 },
    { type: 'olive', name: 'Ulivo', build: 'tree', leaf: 'olive', w: 300, d: 300, h: 350, color: '#7d6e5e', outdoor: true, hit: 0.1 },
    { type: 'cypress', name: 'Cipresso', build: 'cypress', w: 90, d: 90, h: 450, color: '#6e5a46', outdoor: true, hit: 0.3 },
    { type: 'bush', name: 'Cespuglio', build: 'bush', w: 90, d: 90, h: 80, color: '#4f7f3f', outdoor: true },
    { type: 'lavender', name: 'Lavanda in fioriera', build: 'lavender', w: 100, d: 40, h: 60, color: '#b5674a', outdoor: true },
    { type: 'flowerBed', name: 'Aiuola fiorita', build: 'flowerBed', w: 200, d: 70, h: 30, color: '#b5674a', outdoor: true },
    { type: 'raisedBed', name: 'Orto rialzato', build: 'raisedBed', w: 120, d: 80, h: 45, color: 'wood:oak', outdoor: true },
    { type: 'gardenTable', name: 'Tavolo da giardino', build: 'table', w: 160, d: 90, h: 75, color: '#5b5f63', outdoor: true, openBelow: true, surface: true },
    { type: 'gardenChair', name: 'Sedia da giardino', build: 'chair', w: 50, d: 52, h: 85, color: '#56704f', outdoor: true, tucks: true },
    { type: 'sunLounger', name: 'Lettino prendisole', build: 'sunLounger', w: 70, d: 195, h: 40, color: '#f2f0eb', outdoor: true },
    { type: 'parasol', name: 'Ombrellone', build: 'parasol', w: 260, d: 260, h: 245, color: '#e9e1d3', outdoor: true, hit: 0.15 },
    { type: 'bench', name: 'Panchina', build: 'bench', w: 150, d: 60, h: 80, color: 'wood:oak', outdoor: true },
    { type: 'bbq', name: 'Barbecue', build: 'bbq', w: 100, d: 60, h: 105, color: '#2b2b2b', outdoor: true },
    { type: 'pool', name: 'Piscina', build: 'pool', w: 600, d: 300, h: 30, color: '#3fa7c9', outdoor: true },
    { type: 'lampPost', name: 'Lampione da giardino', build: 'lampPost', w: 30, d: 30, h: 190, color: '#2b2b2b', outdoor: true },
    { type: 'shed', name: 'Casetta attrezzi', build: 'shed', w: 200, d: 160, h: 230, color: '#8a9a7b', outdoor: true },
    { type: 'pergola', name: 'Pergola', build: 'pergola', w: 350, d: 300, h: 250, color: 'wood:oak', outdoor: true, hit: 'posts' },
    { type: 'hammock', name: 'Amaca con supporto', build: 'hammock', w: 320, d: 100, h: 120, color: '#e9d27a', outdoor: true },
    { type: 'swing', name: 'Altalena', build: 'swing', w: 220, d: 160, h: 210, color: '#d94a3a', outdoor: true, hit: 'posts' },
    { type: 'trampoline', name: 'Tappeto elastico', build: 'trampoline', w: 300, d: 300, h: 220, color: '#3f6fb0', outdoor: true },
    { type: 'firePit', name: 'Braciere', build: 'firePit', w: 100, d: 100, h: 35, color: '#8a8378', outdoor: true },
    { type: 'fountain', name: 'Fontana', build: 'fountain', w: 150, d: 150, h: 140, color: '#d9d2c4', outdoor: true },
    { type: 'car', name: 'Automobile', build: 'car', w: 180, d: 440, h: 150, color: '#2f4a6b', outdoor: true },
  ] },
  { cat: 'Porte e finestre', items: [
    { type: 'door', name: 'Porta', build: 'door', w: 80, d: 10, h: 210, color: '#f2f0eb', opening: true },
    { type: 'door90', name: 'Porta 90', build: 'door', w: 90, d: 10, h: 210, color: '#8a6a4a', opening: true },
    { type: 'pocketDoor', name: 'Porta scorrevole a scomparsa', build: 'pocketDoor', w: 80, d: 10, h: 210, color: '#f2f0eb', opening: true },
    { type: 'doubleDoor', name: 'Porta doppia a vetri', build: 'doubleDoor', w: 140, d: 10, h: 220, color: '#f2f0eb', opening: true },
    { type: 'frontDoor', name: "Porta d'ingresso blindata", build: 'frontDoor', w: 90, d: 10, h: 215, color: '#5b4636', opening: true },
    { type: 'garageDoor', name: 'Porta garage basculante', build: 'garageDoor', w: 250, d: 10, h: 220, color: '#b9c0c4', opening: true },
    { type: 'arch', name: 'Passaggio', build: 'arch', w: 100, d: 10, h: 220, color: '#f4f3ef', opening: true },
    { type: 'window', name: 'Finestra', build: 'window', w: 120, d: 10, h: 130, elev: 90, color: '#f4f3ef', opening: true },
    { type: 'vasistas', name: 'Vasistas (bagno)', build: 'vasistas', w: 80, d: 10, h: 45, elev: 175, color: '#f4f3ef', opening: true },
    { type: 'vasistasWide', name: 'Vasistas largo', build: 'vasistas', w: 120, d: 10, h: 45, elev: 175, color: '#f4f3ef', opening: true },
    { type: 'windowSmall', name: 'Finestra piccola', build: 'window', w: 60, d: 10, h: 80, elev: 120, color: '#f4f3ef', opening: true },
    { type: 'balcony', name: 'Portafinestra 2 ante', build: 'window', w: 140, d: 10, h: 230, elev: 0, color: '#f4f3ef', opening: true },
    { type: 'balcony1', name: 'Portafinestra 1 anta', build: 'window', w: 80, d: 10, h: 230, elev: 0, color: '#f4f3ef', opening: true },
    { type: 'slider', name: 'Vetrata scorrevole', build: 'slider', w: 240, d: 10, h: 230, elev: 0, color: '#3b3f45', opening: true },
  ] },
];

export const TYPES = {};
for (const c of CATALOG) for (const it of c.items) TYPES[it.type] = { ...it, cat: c.cat, elev: it.elev ?? 0 };

export function buildModel(item) {
  const def = TYPES[item.type];
  const g = new THREE.Group();
  B[def.build](g, item.w / 100, item.d / 100, item.h / 100, item.color, item);
  return g;
}

export const WOOD_SWATCHES = Object.keys(WOODS).map(k => 'wood:' + k);
export const SWATCHES = [
  '#ffffff', '#f2f0eb', '#e9e1d3', '#d9d6cf', '#b9c0c4', '#7d8a96', '#5b5f63', '#2b2b2b',
  '#2f4a6b', '#3f5e7a', '#4f8a8b', '#8a9a7b', '#56704f', '#d9b44a', '#c56b45', '#b8735a', '#e8b7a8', '#9b5c7a',
];

// Furnishing styles: each piece takes the color of its group.
const STYLE_GROUP = {
  table: 'wood', roundTable: 'wood', coffeeTable: 'wood', chair: 'wood', desk: 'wood', bookshelf: 'wood',
  nightstand: 'wood', tvStand: 'wood', washbasin: 'wood',
  dresser: 'cabinet', wardrobe: 'cabinet',
  kitchenBase: 'kitchen', sinkUnit: 'kitchen', hobUnit: 'kitchen', wallCabinet: 'kitchen', hoodCabinet: 'kitchen',
  sofa3: 'soft', sofa2: 'soft', officeChair: 'soft', armchair: 'accent', bed2: 'bed', bed1: 'bed',
  rug: 'rug', door: 'door', door90: 'door',
  sideboard: 'wood', sideTable: 'wood', consoleTable: 'wood', entryBench: 'wood', displayCabinet: 'wood',
  tvUnit: 'cabinet', cubeShelf: 'cabinet', shoeCabinet: 'cabinet', wallCupboard: 'cabinet', cornerSofa: 'soft', pouf: 'accent',
};
export const STYLES = {
  legno: { label: 'Legno naturale', wood: 'wood:oak', cabinet: 'wood:oak', kitchen: 'wood:oak', soft: '#a39382', accent: '#b8735a', bed: 'wood:oak', rug: '#9c8f7c', door: 'wood:oak' },
  minimal: { label: 'Minimal', wood: '#f2f0eb', cabinet: '#ffffff', kitchen: '#ffffff', soft: '#d9d6cf', accent: '#b9c0c4', bed: '#f2f0eb', rug: '#d9d6cf', door: '#ffffff' },
  scandi: { label: 'Scandinavo', wood: 'wood:ash', cabinet: '#f2f0eb', kitchen: '#f2f0eb', soft: '#b9c0c4', accent: '#e9e1d3', bed: 'wood:ash', rug: '#e9e1d3', door: '#f2f0eb' },
  classico: { label: 'Classico', wood: 'wood:walnut', cabinet: '#e9e1d3', kitchen: '#e9e1d3', soft: '#7d5a44', accent: '#8b3a3a', bed: 'wood:walnut', rug: '#8b5a4a', door: 'wood:walnut' },
  industriale: { label: 'Industriale', wood: 'wood:wenge', cabinet: '#3b3f45', kitchen: '#5b5f63', soft: '#5b5f63', accent: '#8a5a3c', bed: '#3b3f45', rug: '#7a7069', door: '#3b3f45' },
  colori: { label: 'Colorato', wood: 'wood:oak', cabinet: '#f2f0eb', kitchen: '#56704f', soft: '#2f4a6b', accent: '#d9b44a', bed: '#e8b7a8', rug: '#c56b45', door: '#f2f0eb' },
};
export const styleColor = (style, type) => STYLES[style]?.[STYLE_GROUP[type]] ?? null;
