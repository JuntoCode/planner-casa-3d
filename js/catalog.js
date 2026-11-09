import * as THREE from 'three';

// Furniture catalog. Every model is built from primitives so it scales to any
// size the user types. Builders get sizes in meters; local axes:
// x = width (centered), z = depth (centered, front faces +z), y = up from 0.

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}

const GLASS = { transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false };
const METAL = { metalness: 0.6, roughness: 0.35 };
const DARK = '#2b2b2b';
const WHITE = '#f4f3ef';

const shade = (c, l) => '#' + new THREE.Color(c).offsetHSL(0, 0, l).getHexString();

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
    const n = seats ?? Math.max(1, Math.round(inner / 0.65));
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
    cyl(g, w * 0.3, w * 0.5, 0.3, c, 0, h - 0.3, 0, { emissive: c, emissiveIntensity: 0.25, side: THREE.DoubleSide }, 32);
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
    box(g, lw, h - f - 0.01, 0.04, c, 0, 0.01, 0);
    box(g, 0.12, 0.02, 0.06, '#9a9a9a', lw / 2 - 0.1, 1.0, 0, METAL);
    g.children.forEach(m => { m.userData.tall = true; });
    // Swing arc on the floor (stays visible with low walls). Hinge on the left.
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(lw - 0.012, lw, 32, 1, 0, Math.PI / 2),
      mat('#7a8794', { side: THREE.DoubleSide }),
    );
    arc.rotation.x = Math.PI / 2;
    arc.position.set(-lw / 2, 0.004, d / 2);
    g.add(arc);
    const line = box(g, 0.012, 0.002, lw, '#7a8794', -lw / 2 + 0.006, 0.003, d / 2 + lw / 2);
    line.castShadow = false;
  },
  arch(g, w, d, h, c) {
    const f = 0.05;
    for (const s of [-1, 1]) box(g, f, h, d + 0.02, c, s * (w / 2 - f / 2), 0, 0);
    box(g, w, f, d + 0.02, c, 0, h - f, 0);
    g.children.forEach(m => { m.userData.tall = true; });
  },
  window(g, w, d, h, c) {
    const f = 0.05;
    for (const s of [-1, 1]) box(g, f, h, d + 0.02, c, s * (w / 2 - f / 2), 0, 0);
    box(g, w, f, d + 0.02, c, 0, h - f, 0);
    box(g, w + 0.06, 0.03, d + 0.08, WHITE, 0, -0.03, 0.02);
    box(g, w, f, d + 0.02, c, 0, 0, 0);
    if (w > 0.8) box(g, f, h - 2 * f, 0.05, c, 0, f, 0);
    box(g, w - 2 * f, h - 2 * f, 0.01, '#bfe0f0', 0, f, 0, GLASS);
    g.children.forEach(m => { m.userData.tall = true; });
  },
  // Small high window for bathrooms: bottom-hinged sash, frosted glass, handle on top.
  vasistas(g, w, d, h, c) {
    const f = 0.04;
    for (const s of [-1, 1]) box(g, f, h, d + 0.02, c, s * (w / 2 - f / 2), 0, 0);
    box(g, w, f, d + 0.02, c, 0, h - f, 0);
    box(g, w, f, d + 0.02, c, 0, 0, 0);
    box(g, w - 2 * f, 0.012, 0.03, shade(c, -0.12), 0, f, 0);
    box(g, w - 2 * f, h - 2 * f, 0.012, '#d3e3ea', 0, f, 0, { transparent: true, opacity: 0.75, roughness: 0.55 });
    for (const s of [-1, 1]) box(g, 0.1, 0.018, 0.025, '#9a9a9a', 0, h - f - 0.04, s * 0.02, METAL);
    g.children.forEach(m => { m.userData.tall = true; });
  },
};

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Defaults in cm. `elev` = height from the floor; `opening` = cut into a wall.
export const CATALOG = [
  { cat: 'Soggiorno', items: [
    { type: 'sofa3', name: 'Divano 3 posti', build: 'sofa', w: 220, d: 95, h: 85, color: '#7d8a96' },
    { type: 'sofa2', name: 'Divano 2 posti', build: 'sofa', w: 165, d: 90, h: 85, color: '#a39382' },
    { type: 'armchair', name: 'Poltrona', build: 'armchair', w: 85, d: 85, h: 85, color: '#b8735a' },
    { type: 'coffeeTable', name: 'Tavolino', build: 'coffeeTable', w: 100, d: 55, h: 42, color: '#c9a57a' },
    { type: 'tvStand', name: 'Mobile TV', build: 'tvStand', w: 160, d: 40, h: 45, color: '#f2f0eb' },
    { type: 'bookshelf', name: 'Libreria', build: 'bookshelf', w: 80, d: 30, h: 200, color: '#e8dcc6' },
    { type: 'rug', name: 'Tappeto', build: 'rug', w: 200, d: 140, h: 1, color: '#9c8f7c', noCollide: true },
  ] },
  { cat: 'Pranzo', items: [
    { type: 'table', name: 'Tavolo', build: 'table', w: 140, d: 80, h: 75, color: '#c9a57a' },
    { type: 'roundTable', name: 'Tavolo rotondo', build: 'roundTable', w: 100, d: 100, h: 75, color: '#f2f0eb' },
    { type: 'chair', name: 'Sedia', build: 'chair', w: 45, d: 50, h: 85, color: '#c9a57a' },
  ] },
  { cat: 'Camera', items: [
    { type: 'bed2', name: 'Letto matrimoniale', build: 'bed', w: 160, d: 205, h: 100, color: '#d8cdbd' },
    { type: 'bed1', name: 'Letto singolo', build: 'bed', w: 90, d: 205, h: 90, color: '#d8cdbd' },
    { type: 'wardrobe', name: 'Armadio', build: 'wardrobe', w: 200, d: 60, h: 236, color: '#f2f0eb' },
    { type: 'nightstand', name: 'Comodino', build: 'nightstand', w: 45, d: 40, h: 50, color: '#c9a57a' },
    { type: 'dresser', name: 'Cassettiera', build: 'dresser', w: 80, d: 48, h: 80, color: '#f2f0eb' },
  ] },
  { cat: 'Cucina', items: [
    { type: 'kitchenBase', name: 'Base cucina', build: 'kitchenBase', w: 60, d: 62, h: 90, color: '#e9e6df' },
    { type: 'sinkUnit', name: 'Lavello', build: 'sinkUnit', w: 80, d: 62, h: 90, color: '#e9e6df' },
    { type: 'hobUnit', name: 'Piano cottura + forno', build: 'hobUnit', w: 60, d: 62, h: 90, color: '#e9e6df' },
    { type: 'wallCabinet', name: 'Pensile', build: 'wallCabinet', w: 60, d: 35, h: 70, elev: 145, color: '#e9e6df', noCollideLow: true },
    { type: 'fridge', name: 'Frigorifero', build: 'fridge', w: 60, d: 65, h: 185, color: '#e6e8ea' },
  ] },
  { cat: 'Bagno', items: [
    { type: 'toilet', name: 'WC', build: 'toilet', w: 38, d: 60, h: 80, color: '#ffffff' },
    { type: 'bidet', name: 'Bidet', build: 'bidet', w: 38, d: 55, h: 40, color: '#ffffff' },
    { type: 'washbasin', name: 'Lavabo con mobile', build: 'washbasin', w: 60, d: 46, h: 85, color: '#8a7560' },
    { type: 'shower', name: 'Doccia', build: 'shower', w: 90, d: 90, h: 200, color: '#dfefff' },
    { type: 'bathtub', name: 'Vasca', build: 'bathtub', w: 170, d: 75, h: 55, color: '#ffffff' },
    { type: 'washer', name: 'Lavatrice', build: 'washer', w: 60, d: 60, h: 85, color: '#f2f3f4' },
  ] },
  { cat: 'Ufficio', items: [
    { type: 'desk', name: 'Scrivania', build: 'desk', w: 140, d: 70, h: 75, color: '#f2f0eb' },
    { type: 'officeChair', name: 'Sedia da ufficio', build: 'officeChair', w: 60, d: 60, h: 105, color: '#3b3f45' },
  ] },
  { cat: 'Decorazioni', items: [
    { type: 'lamp', name: 'Lampada da terra', build: 'lamp', w: 40, d: 40, h: 160, color: '#f3ead6' },
    { type: 'plant', name: 'Pianta', build: 'plant', w: 45, d: 45, h: 110, color: '#c56b45' },
  ] },
  { cat: 'Porte e finestre', items: [
    { type: 'door', name: 'Porta', build: 'door', w: 80, d: 10, h: 210, color: '#f2f0eb', opening: true },
    { type: 'door90', name: 'Porta 90', build: 'door', w: 90, d: 10, h: 210, color: '#8a6a4a', opening: true },
    { type: 'arch', name: 'Passaggio', build: 'arch', w: 100, d: 10, h: 220, color: '#f4f3ef', opening: true },
    { type: 'window', name: 'Finestra', build: 'window', w: 120, d: 10, h: 130, elev: 90, color: '#f4f3ef', opening: true },
    { type: 'vasistas', name: 'Vasistas (bagno)', build: 'vasistas', w: 80, d: 10, h: 45, elev: 175, color: '#f4f3ef', opening: true },
    { type: 'vasistasWide', name: 'Vasistas largo', build: 'vasistas', w: 120, d: 10, h: 45, elev: 175, color: '#f4f3ef', opening: true },
    { type: 'windowSmall', name: 'Finestra piccola', build: 'window', w: 60, d: 10, h: 80, elev: 120, color: '#f4f3ef', opening: true },
    { type: 'balcony', name: 'Portafinestra 2 ante', build: 'window', w: 140, d: 10, h: 230, elev: 0, color: '#f4f3ef', opening: true },
    { type: 'balcony1', name: 'Portafinestra 1 anta', build: 'window', w: 80, d: 10, h: 230, elev: 0, color: '#f4f3ef', opening: true },
    { type: 'slider', name: 'Vetrata scorrevole', build: 'window', w: 240, d: 10, h: 230, elev: 0, color: '#3b3f45', opening: true },
  ] },
];

export const TYPES = {};
for (const c of CATALOG) for (const it of c.items) TYPES[it.type] = { ...it, cat: c.cat, elev: it.elev ?? 0 };

export function buildModel(item) {
  const def = TYPES[item.type];
  const g = new THREE.Group();
  B[def.build](g, item.w / 100, item.d / 100, item.h / 100, item.color);
  return g;
}

export const SWATCHES = ['#ffffff', '#f2f0eb', '#e8dcc6', '#c9a57a', '#8a6a4a', '#4a3a2c', '#2b2b2b', '#7d8a96', '#3f5e7a', '#8a9a7b', '#b8735a', '#d9b44a'];
