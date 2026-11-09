import * as THREE from 'three';
import { artTexture } from './art.js';

// Decorations, lights, plants, tech, music, pets and garden pieces.
// Same rules as catalog.js: sizes in meters, x = width, z = depth (front +z),
// y up from 0. Wall pieces have their back on z = -d/2. Each builder also gets
// the item (or the catalog entry, for thumbnails) to read `seed` and options.

export function decorBuilders({ box, cyl, mat, shade, mulberry, def, DARK, WHITE, METAL, GLASS }) {
  const texMats = new Map();
  // Cached textured material; the key avoids JSON-encoding the texture.
  function texMat(tex, opts = {}, color = '#ffffff') {
    const key = tex.uuid + color + JSON.stringify(opts);
    if (!texMats.has(key)) {
      const m = new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.8, ...opts });
      m.userData.shared = true;
      texMats.set(key, m);
    }
    return texMats.get(key);
  }
  // A lamp shade drawn on a canvas that also glows where the picture is bright.
  function glowTexMat(tex, k = 1, opts = {}) {
    const key = 'glow' + tex.uuid + k + JSON.stringify(opts);
    if (!texMats.has(key)) {
      const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: k, roughness: 0.6, side: THREE.DoubleSide, ...opts });
      m.userData.shared = true;
      texMats.set(key, m);
    }
    return texMats.get(key);
  }
  // Points of a lathe outline from a radius profile r(t), t = 0 (bottom) .. 1 (top).
  const profile = (n, height, r) => Array.from({ length: n + 1 }, (_, k) => new THREE.Vector2(Math.max(0.001, r(k / n)), (k / n) * height));
  const glow = (color, k = 1.6) => mat(color, { emissive: color, emissiveIntensity: k, roughness: 0.4 });
  const seedOf = it => it.seed ?? [...String(it.id || it.type)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
  const add = (g, geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  // A flat picture facing +z, bottom edge at y.
  const plane = (g, w, h, m, x, y, z) => { const o = add(g, new THREE.PlaneGeometry(w, h), m, x, y + h / 2, z); o.castShadow = false; return o; };
  // A disc facing +z (clock faces, drum heads seen from the front).
  const disc = (g, r, depth, color, x, y, z, opts, seg = 32) => {
    const o = add(g, new THREE.CylinderGeometry(r, r, depth, seg), mat(color, opts), x, y, z);
    o.rotation.x = Math.PI / 2;
    return o;
  };
  const ball = (g, r, color, x, y, z, opts) => add(g, new THREE.SphereGeometry(r, 16, 12), mat(color, opts), x, y, z);
  const blob = (g, r, color, x, y, z) => add(g, new THREE.IcosahedronGeometry(r, 1), mat(color, { flatShading: true }), x, y, z);
  const tube = (g, pts, r, color, opts) =>
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), Math.max(8, pts.length * 6), r, 6), mat(color, opts));
  // A leaf hinged at its base: yaw around y, then leaning out by `tilt` (0 = straight up).
  const leafGeo = new THREE.CircleGeometry(0.5, 14);
  function leaf(g, x, y, z, len, wid, yaw, tilt, color) {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    p.rotation.set(0, yaw, 0);
    const q = new THREE.Group();
    q.rotation.x = tilt;
    p.add(q);
    const m = add(q, leafGeo, mat(color, { side: THREE.DoubleSide }), 0, len / 2, 0);
    m.scale.set(wid, len, 1);
    m.rotation.x = -0.25; // cupped towards the light
    g.add(p);
    return p;
  }
  const pot = (g, w, h, c) => {
    cyl(g, w * 0.5, w * 0.4, h, c, 0, 0, 0);
    cyl(g, w * 0.46, w * 0.46, 0.01, '#4a3a2c', 0, h - 0.012, 0);
  };
  const GREEN = ['#3d6b34', '#4f7f3f', '#5f8f4a', '#2f5a2c'];
  // Basil standing at (x, y, z), `s` tall: soft stems with pairs of glossy cupped leaves, a tuft on top.
  function basilPlant(g, r, x, y, z, s) {
    const cols = ['#4f9a36', '#5fae3f', '#56a33a'];
    const stems = 4 + Math.floor(r() * 3);
    for (let k = 0; k < stems; k++) {
      const a = (k / stems) * Math.PI * 2 + r() * 0.6, len = s * (0.75 + r() * 0.25), lean = 0.15 + r() * 0.2;
      const tip = [x + Math.cos(a) * lean * len, y + len, z + Math.sin(a) * lean * len];
      tube(g, [[x, y, z], [x + (tip[0] - x) * 0.4, y + len * 0.5, z + (tip[2] - z) * 0.4], tip], 0.0025, '#6f9a4a');
      for (let n = 1; n <= 3; n++) {
        const t = n / 3.6, size = s * (0.32 - t * 0.12);
        const px = x + (tip[0] - x) * t, py = y + len * t, pz = z + (tip[2] - z) * t;
        for (const side of [0, Math.PI]) leaf(g, px, py, pz, size, size * 0.62, a + side + n * 1.57, 1.05 + r() * 0.25, cols[(k + n) % 3]);
      }
      for (let n = 0; n < 4; n++) leaf(g, tip[0], tip[1], tip[2], s * 0.13, s * 0.08, a + n * 1.57, 0.5, cols[n % 3]);
    }
  }
  // Rosemary standing at (x, y, z), `s` tall: upright woody stems thick with short needles,
  // a few pale blue flowers. The needles are one instanced mesh.
  const needleGeo = new THREE.CylinderGeometry(0.0022, 0.0032, 1, 4);
  function rosemaryPlant(g, r, x, y, z, s) {
    const stems = 9 + Math.floor(r() * 4), per = 42;
    const needles = new THREE.InstancedMesh(needleGeo, mat('#47684c', { roughness: 1 }), stems * per);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let i = 0;
    for (let k = 0; k < stems; k++) {
      const a = (k / stems) * Math.PI * 2 + r() * 0.5, lean = 0.1 + r() * 0.3, len = s * (0.55 + r() * 0.45);
      const dx = Math.cos(a) * lean, dz = Math.sin(a) * lean;
      tube(g, [[x, y, z], [x + dx * len * 0.5, y + len * 0.5, z + dz * len * 0.5], [x + dx * len, y + len, z + dz * len]], 0.0028, '#6b5a45');
      for (let n = 0; n < per; n++) {
        const t = 0.12 + (n / per) * 0.88;
        p.set(x + dx * len * t, y + len * t, z + dz * len * t);
        // tilted away from the stem (more upright near the tip), turned all around it
        q.setFromEuler(e.set(0.5 + r() * 0.7 - t * 0.3, r() * Math.PI * 2, 0, 'YXZ'));
        m4.compose(p, q, sc.set(1, s * (0.1 + r() * 0.05), 1));
        needles.setMatrixAt(i++, m4);
      }
      if (r() < 0.45) ball(g, 0.005, '#8fa0e0', x + dx * len * 0.85, y + len * 0.85, z + dz * len * 0.85, { roughness: 0.9 });
    }
    needles.castShadow = needles.receiveShadow = true;
    g.add(needles);
  }
  // Geraniums and petunias in a trough whose soil is at height y: a flowering mound,
  // and stems falling over the front edge by up to `drop`.
  function troughFlowers(g, r, w, d, y, zc, drop) {
    const cols = ['#d6304a', '#e8789a', '#f4f3ef', '#c2185b', '#f2a65a'];
    const pick = () => cols[Math.floor(r() * cols.length)];
    const n = Math.max(4, Math.round(w * 14));
    for (let k = 0; k < n; k++) {
      const x = (r() - 0.5) * (w - 0.06), z = zc + (r() - 0.5) * (d - 0.06);
      blob(g, 0.045 + r() * 0.02, GREEN[k % 4], x, y + 0.03, z);
      ball(g, 0.018 + r() * 0.01, pick(), x + (r() - 0.5) * 0.04, y + 0.07 + r() * 0.04, z, { roughness: 0.9 });
    }
    const zf = zc + d / 2;
    for (let k = 0; k < Math.round(n * 0.7); k++) {
      const x = (r() - 0.5) * (w - 0.04), len = drop * (0.5 + r() * 0.5);
      const pts = [[x, y + 0.02, zf - 0.01], [x + (r() - 0.5) * 0.03, y - len * 0.4, zf + 0.025], [x + (r() - 0.5) * 0.05, y - len, zf + 0.015]];
      tube(g, pts, 0.003, '#4f7f3f');
      blob(g, 0.022, GREEN[k % 4], ...pts[1]);
      ball(g, 0.016, pick(), ...pts[2], { roughness: 0.9 });
    }
  }

  return {
    // ---------- wall art ----------
    painting(g, w, d, h, c, it) {
      const f = Math.min(0.04, w * 0.08);
      for (const s of [-1, 1]) box(g, f, h, d, c, s * (w / 2 - f / 2), 0, 0);
      for (const y of [0, h - f]) box(g, w - 2 * f, f, d, c, 0, y, 0);
      box(g, w - 2 * f, h - 2 * f, 0.01, WHITE, 0, f, -d / 2 + 0.005);
      plane(g, w - 2 * f - 0.002, h - 2 * f - 0.002, texMat(artTexture(def(it).art, seedOf(it)), { roughness: 0.7 }), 0, f + 0.001, -d / 2 + 0.012);
    },
    poster(g, w, d, h, c, it) {
      box(g, w, h, 0.003, c, 0, 0, -d / 2 + 0.0015);
      plane(g, w - 0.01, h - 0.01, texMat(artTexture('poster', seedOf(it)), { roughness: 0.9 }), 0, 0.005, -d / 2 + 0.004);
    },
    // Fabric hanging from a wooden rod, slightly wavy, with tassels.
    tapestry(g, w, d, h, c, it) {
      const rod = cyl(g, 0.012, 0.012, w + 0.08, c, 0, 0, 0);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, h - 0.02, -d / 2 + 0.03);
      const geo = new THREE.PlaneGeometry(w, h - 0.06, 24, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 14) * 0.008);
      geo.computeVertexNormals();
      const cloth = add(g, geo, texMat(artTexture(def(it).art || 'mandala', seedOf(it)), { roughness: 1, side: THREE.DoubleSide }), 0, (h - 0.06) / 2, -d / 2 + 0.02);
      cloth.castShadow = false;
      for (let x = -w / 2 + 0.03; x < w / 2; x += 0.06) cyl(g, 0.004, 0.004, 0.07, '#e9e1d3', x, -0.07, -d / 2 + 0.02, { roughness: 1 }, 5);
    },
    mirror(g, w, d, h, c, it) {
      const glass = { metalness: 0.35, roughness: 0.06 };
      if (def(it).round) {
        const r = Math.min(w, h) / 2;
        disc(g, r, d * 0.6, c, 0, h / 2, -d / 2 + d * 0.3, {}, 40);
        disc(g, r - 0.025, 0.004, '#cfdde3', 0, h / 2, -d / 2 + d * 0.62, glass, 40);
        return;
      }
      const f = 0.03;
      for (const s of [-1, 1]) box(g, f, h, d, c, s * (w / 2 - f / 2), 0, 0);
      for (const y of [0, h - f]) box(g, w - 2 * f, f, d, c, 0, y, 0);
      box(g, w - 2 * f, h - 2 * f, 0.006, '#cfdde3', 0, f, 0, glass);
    },
    clock(g, w, d, h, c) {
      const r = Math.min(w, h) / 2, y = h / 2, z = -d / 2;
      disc(g, r, d * 0.8, c, 0, y, z + d * 0.4);
      disc(g, r - 0.015, 0.004, '#fbfaf7', 0, y, z + d * 0.81);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        box(g, 0.006, k % 3 ? 0.012 : 0.025, 0.003, DARK, Math.sin(a) * (r - 0.035), y + Math.cos(a) * (r - 0.035) - 0.006, z + d * 0.83);
      }
      const hand = (len, wid, ang) => {
        const p = new THREE.Group();
        p.position.set(0, y, z + d * 0.86);
        p.rotation.z = -ang;
        g.add(p);
        box(p, wid, len, 0.003, DARK, 0, 0, 0);
      };
      hand(r * 0.55, 0.01, 2.1);
      hand(r * 0.8, 0.006, 0.4);
    },
    // A shelf with books standing on it and a small plant.
    wallShelf(g, w, d, h, c, it) {
      box(g, w, 0.025, d, c, 0, 0, 0);
      const r = mulberry(seedOf(it));
      let x = -w / 2 + 0.03;
      const end = w / 2 - (w > 0.6 ? 0.16 : 0.03);
      const cols = ['#2f4a6b', '#8b2f2f', '#d9b44a', '#56704f', '#e9e1d3', '#3b3f45', '#c56b45'];
      while (x < end - 0.02) {
        const bw = 0.02 + r() * 0.025, bh = Math.min(h - 0.03, 0.17 + r() * 0.08);
        box(g, bw, bh, d * 0.8, cols[Math.floor(r() * cols.length)], x + bw / 2, 0.025, 0);
        x += bw + 0.002;
      }
      if (w > 0.6) {
        cyl(g, 0.045, 0.035, 0.08, '#f2f0eb', w / 2 - 0.08, 0.025, 0);
        for (let k = 0; k < 4; k++) blob(g, 0.04, GREEN[k], w / 2 - 0.08 + (r() - 0.5) * 0.06, 0.13 + r() * 0.05, (r() - 0.5) * 0.05);
      }
    },
    // String lights: swags across the wall, or a curtain of strands.
    fairyLights(g, w, d, h, c, it) {
      const z = -d / 2 + 0.01;
      const bulb = new THREE.SphereGeometry(0.011, 8, 6), bm = glow(c, 2.2);
      const strand = pts => {
        tube(g, pts, 0.0015, '#3b3f45');
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
        const n = Math.max(2, Math.round(curve.getLength() / 0.09));
        for (let i = 0; i <= n; i++) {
          const p = curve.getPoint(i / n);
          const b = new THREE.Mesh(bulb, bm);
          b.position.copy(p);
          g.add(b);
        }
      };
      if (def(it).mode === 'curtain') {
        const r = mulberry(seedOf(it));
        strand([[-w / 2, h, z], [0, h - 0.02, z], [w / 2, h, z]]);
        for (let x = -w / 2 + 0.06; x < w / 2; x += 0.12) {
          const len = h * (0.7 + r() * 0.3);
          strand([[x, h, z], [x + 0.005, h - len / 2, z + 0.004], [x, h - len, z]]);
        }
        return;
      }
      const swags = Math.max(1, Math.round(w / 0.8));
      for (let s = 0; s < swags; s++) {
        const x0 = -w / 2 + (s * w) / swags, x1 = x0 + w / swags;
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          pts.push([x0 + (x1 - x0) * t, h - Math.sin(Math.PI * t) * h * 0.8, z]);
        }
        strand(pts);
      }
    },

    // ---------- lights ----------
    // Ceiling pieces reach the ceiling at y = h.
    chandelier(g, w, d, h, c) {
      cyl(g, 0.06, 0.06, 0.03, c, 0, h - 0.03, 0, METAL);
      cyl(g, 0.006, 0.006, h * 0.45, c, 0, h * 0.55, 0, METAL);
      ball(g, 0.05, c, 0, h * 0.5, 0, METAL);
      const R = Math.min(w, d) / 2 - 0.05, n = 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
        tube(g, [[0, h * 0.48, 0], [cx * R * 0.5, h * 0.3, cz * R * 0.5], [cx * R, h * 0.3, cz * R]], 0.007, c, METAL);
        cyl(g, 0.025, 0.02, 0.02, c, cx * R, h * 0.3, cz * R, METAL);
        cyl(g, 0.01, 0.01, 0.07, '#f8f4ea', cx * R, h * 0.32, cz * R);
        ball(g, 0.014, '#ffd27a', cx * R, h * 0.32 + 0.085, cz * R, { emissive: '#ffd27a', emissiveIntensity: 2 });
      }
    },
    pendant(g, w, d, h, c, it) {
      cyl(g, 0.05, 0.05, 0.02, c, 0, h - 0.02, 0);
      cyl(g, 0.003, 0.003, h - 0.2, DARK, 0, 0.2, 0, {}, 6);
      if (def(it).shape === 'globe') {
        ball(g, Math.min(w, d) / 2, c, 0, Math.min(w, d) / 2, 0, { emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
        return;
      }
      const r = Math.min(w, d) / 2;
      add(g, new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, { side: THREE.DoubleSide, roughness: 0.5 }), 0, 0.02, 0).scale.y = 0.6;
      ball(g, 0.035, '#fff3d6', 0, 0.06, 0, { emissive: '#ffe6b0', emissiveIntensity: 2 });
    },
    // Three pendants in a row, for a dining table or kitchen island.
    pendantRow(g, w, d, h, c) {
      box(g, w, 0.025, 0.06, c, 0, h - 0.025, 0);
      for (const s of [-1, 0, 1]) {
        const x = s * (w / 2 - 0.15);
        cyl(g, 0.003, 0.003, h - 0.2, DARK, x, 0.2, 0, {}, 6);
        cyl(g, 0.02, 0.12, 0.18, c, x, 0.02, 0, { side: THREE.DoubleSide }, 24);
        ball(g, 0.03, '#fff3d6', x, 0.04, 0, { emissive: '#ffe6b0', emissiveIntensity: 2 });
      }
    },
    flushLight(g, w, d, h, c) {
      cyl(g, w / 2, w / 2 - 0.02, h * 0.6, c, 0, h * 0.4, 0);
      cyl(g, w / 2 - 0.03, w / 2 - 0.03, h * 0.4, '#fff8e6', 0, 0, 0, { emissive: '#fff1d0', emissiveIntensity: 1.6 });
    },
    arcLamp(g, w, d, h, c) {
      const bx = -w / 2 + 0.17;
      box(g, 0.3, 0.06, 0.3, '#e9e6df', bx, 0, 0, { roughness: 0.3 });
      const ex = w / 2 - 0.2;
      tube(g, [[bx, 0.06, 0], [bx, h * 0.7, 0], [bx + (ex - bx) * 0.35, h, 0], [ex, h * 0.92, 0], [ex, h * 0.82, 0]], 0.012, c, METAL);
      add(g, new THREE.SphereGeometry(0.19, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, { side: THREE.DoubleSide, ...METAL }), ex, h * 0.7, 0).scale.y = 0.7;
      ball(g, 0.04, '#fff3d6', ex, h * 0.72, 0, { emissive: '#ffe6b0', emissiveIntensity: 2 });
    },
    tripodLamp(g, w, d, h, c) {
      const top = h - 0.35, R = Math.min(w, d) / 2 - 0.03;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        tube(g, [[Math.cos(a) * R, 0, Math.sin(a) * R], [0, top, 0]], 0.012, 'wood:walnut');
      }
      cyl(g, 0.2, 0.22, 0.34, c, 0, top, 0, { side: THREE.DoubleSide, emissive: '#fff1d0', emissiveIntensity: 0.35 }, 32);
    },
    tableLamp(g, w, d, h, c) {
      ball(g, w * 0.3, c, 0, w * 0.3, 0, { roughness: 0.3 });
      cyl(g, 0.006, 0.006, h * 0.3, '#c9a24a', 0, w * 0.55, 0, METAL);
      cyl(g, w * 0.32, w * 0.5, h * 0.38, '#f3ead6', 0, h * 0.62, 0, { side: THREE.DoubleSide, emissive: '#fff1d0', emissiveIntensity: 0.5 });
    },
    lampPost(g, w, d, h, c) {
      cyl(g, 0.12, 0.14, 0.06, c, 0, 0, 0);
      cyl(g, 0.03, 0.035, h - 0.35, c, 0, 0.06, 0, METAL);
      cyl(g, 0.11, 0.08, 0.26, '#fff3d6', 0, h - 0.32, 0, { emissive: '#ffe6b0', emissiveIntensity: 1.5 });
      cyl(g, 0.02, 0.15, 0.08, c, 0, h - 0.08, 0, METAL);
    },

    // ---------- more table lamps ----------
    // Banker's lamp: brass base and a green glass shade lying across.
    bankerLamp(g, w, d, h, c) {
      box(g, w * 0.8, 0.025, d * 0.7, '#c9a24a', 0, 0, 0, METAL);
      cyl(g, 0.008, 0.008, h * 0.7, '#c9a24a', 0, 0.025, -d * 0.15, METAL, 8);
      const sh = add(g, new THREE.CylinderGeometry(d * 0.32, d * 0.32, w, 24, 1, true, 0, Math.PI), mat(c, { side: THREE.DoubleSide, roughness: 0.2, emissive: c, emissiveIntensity: 0.25 }), 0, h * 0.78, 0);
      sh.rotation.z = Math.PI / 2;
      ball(g, 0.025, '#fff3d6', 0, h * 0.74, 0, { emissive: '#ffe6b0', emissiveIntensity: 2 });
    },
    // Mushroom lamp: a glowing dome on a short stem.
    mushroomLamp(g, w, d, h, c) {
      cyl(g, w * 0.32, w * 0.35, 0.02, c, 0, 0, 0, { roughness: 0.3 });
      cyl(g, w * 0.08, w * 0.12, h * 0.55, c, 0, 0.02, 0, { roughness: 0.3 });
      add(g, new THREE.SphereGeometry(w / 2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, { side: THREE.DoubleSide, roughness: 0.3, emissive: c, emissiveIntensity: 0.35 }), 0, h * 0.55, 0).scale.y = (h * 0.45) / (w / 2);
      cyl(g, w * 0.45, w * 0.45, 0.004, '#fff3d6', 0, h * 0.55, 0, { emissive: '#ffe6b0', emissiveIntensity: 1.8 });
    },
    // Architect desk lamp: two arms and a cone head pointing at the desk.
    deskLamp(g, w, d, h, c) {
      const bz = -d / 2 + 0.08;
      cyl(g, 0.075, 0.08, 0.025, c, 0, 0, bz, METAL);
      const elbow = [0, h * 0.62, bz + d * 0.15], head = [0, h * 0.82, bz + d * 0.62];
      tube(g, [[0, 0.025, bz], elbow], 0.007, c, METAL);
      tube(g, [elbow, head], 0.007, c, METAL);
      ball(g, 0.012, c, ...elbow, METAL);
      const cone = add(g, new THREE.CylinderGeometry(0.025, 0.07, 0.12, 24, 1, true), mat(c, { side: THREE.DoubleSide, ...METAL }), head[0], head[1] - 0.04, head[2]);
      cone.rotation.x = 0.5;
      ball(g, 0.025, '#fff3d6', head[0], head[1] - 0.08, head[2] + 0.03, { emissive: '#ffe6b0', emissiveIntensity: 2 });
    },
    globeTableLamp(g, w, d, h, c) {
      cyl(g, w * 0.3, w * 0.34, h * 0.18, c, 0, 0, 0, METAL);
      ball(g, Math.min(w, h * 0.82) / 2, '#fbf3e4', 0, h * 0.18 + Math.min(w, h * 0.82) / 2 - 0.01, 0, { emissive: '#ffe9c4', emissiveIntensity: 1.1, roughness: 0.3 });
    },
    // Lantern with a glowing candle inside.
    lantern(g, w, d, h, c) {
      const f = 0.012, bh = h * 0.75;
      box(g, w, 0.02, d, c, 0, 0, 0, METAL);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, f, bh, f, c, sx * (w / 2 - f / 2), 0.02, sz * (d / 2 - f / 2), METAL);
      box(g, w, 0.02, d, c, 0, bh, 0, METAL);
      box(g, w - 0.01, bh - 0.02, d - 0.01, '#f4efe4', 0, 0.02, 0, { transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
      add(g, new THREE.ConeGeometry(w * 0.45, h - bh - 0.02, 4), mat(c, METAL), 0, bh + 0.02 + (h - bh - 0.02) / 2, 0).rotation.y = Math.PI / 4;
      cyl(g, 0.03, 0.03, bh * 0.4, '#f8f4ea', 0, 0.02, 0, {}, 14);
      add(g, new THREE.ConeGeometry(0.01, 0.035, 6), glow('#ffcf6b', 2.6), 0, 0.02 + bh * 0.4 + 0.02, 0).castShadow = false;
    },
    // Ceramic base with a pleated fabric shade.
    pleatedLamp(g, w, d, h, c) {
      const bh = h * 0.5, pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(w * (0.12 + 0.2 * Math.sin(Math.PI * t)), t * bh)); }
      add(g, new THREE.LatheGeometry(pts, 28), mat(c, { roughness: 0.2 }));
      cyl(g, 0.006, 0.006, h * 0.12, '#c9a24a', 0, bh, 0, METAL, 6);
      const geo = new THREE.CylinderGeometry(w * 0.28, w * 0.48, h * 0.42, 48, 1, true);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 + 0.035 * (Math.round((a / (Math.PI * 2)) * 48) % 2 ? 1 : -1);
        pos.setX(i, x * k); pos.setZ(i, z * k);
      }
      geo.computeVertexNormals();
      add(g, geo, mat('#f3ead6', { side: THREE.DoubleSide, roughness: 1, emissive: '#fff1d0', emissiveIntensity: 0.45 }), 0, h * 0.58 + h * 0.21, 0);
    },

    // ---------- mystic and tribal table lamps ----------
    // Moroccan lantern: an onion-shaped pierced brass body full of coloured stars.
    moroccanLamp(g, w, d, h, c, it) {
      cyl(g, w * 0.28, w * 0.34, 0.03, c, 0, 0, 0, METAL);
      cyl(g, w * 0.08, w * 0.12, h * 0.12, c, 0, 0.03, 0, METAL);
      const bh = h * 0.72, y0 = h * 0.15;
      const pts = profile(20, bh, t => (w / 2) * (t < 0.6 ? 0.45 + 0.55 * Math.sin((t / 0.6) * Math.PI * 0.5 + 0.3) : Math.max(0.05, 1 - (t - 0.6) / 0.4) ** 1.4));
      const body = add(g, new THREE.LatheGeometry(pts, 36), glowTexMat(artTexture('moroccan', seedOf(it)), 1.2, METAL), 0, y0, 0);
      body.castShadow = false;
      cyl(g, 0.004, 0.012, h - y0 - bh + 0.01, c, 0, y0 + bh - 0.01, 0, METAL, 8);
      ball(g, 0.04, '#ffcf8a', 0, y0 + bh * 0.4, 0, { emissive: '#ffb347', emissiveIntensity: 2 });
    },
    // Himalayan salt lamp: a rough glowing rock on a wooden block.
    saltLamp(g, w, d, h, c, it) {
      box(g, w * 0.85, 0.04, d * 0.85, 'wood:walnut', 0, 0, 0);
      const geo = new THREE.IcosahedronGeometry(0.5, 2);
      const pos = geo.attributes.position, s = seedOf(it) % 97;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const n = 1 + 0.16 * Math.sin(x * 9 + s) * Math.cos(y * 7 - s) + 0.1 * Math.sin(z * 11 + y * 5);
        pos.setXYZ(i, x * n, y * n, z * n);
      }
      geo.computeVertexNormals();
      const rock = add(g, geo, mat(c, { flatShading: true, roughness: 0.55, emissive: '#ff8a4c', emissiveIntensity: 0.75 }), 0, 0.04 + (h - 0.04) / 2, 0);
      rock.scale.set(w * 0.8, h - 0.04, d * 0.8);
    },
    // Lava lamp: tapered glass full of slow glowing blobs.
    lavaLamp(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      add(g, new THREE.LatheGeometry(profile(8, h * 0.3, t => (w / 2) * (1 - 0.45 * t)), 28), mat('#c0c4c6', { side: THREE.DoubleSide, ...METAL }));
      const gh = h * 0.55;
      add(g, new THREE.LatheGeometry(profile(12, gh, t => (w / 2) * (0.55 + 0.35 * Math.sin(Math.PI * (0.15 + 0.6 * t)) - 0.25 * t)), 28), mat('#ffb3d0', { transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }), 0, h * 0.3, 0).castShadow = false;
      for (let k = 0; k < 5; k++) {
        const b = ball(g, w * (0.07 + r() * 0.07), c, (r() - 0.5) * w * 0.15, h * 0.33 + r() * gh * 0.85, (r() - 0.5) * w * 0.15, { emissive: c, emissiveIntensity: 1.2, roughness: 0.3 });
        b.scale.y = 1.3 + r() * 0.6;
      }
      add(g, new THREE.LatheGeometry(profile(6, h * 0.15, t => (w / 2) * (0.5 - 0.25 * t)), 28), mat('#c0c4c6', { side: THREE.DoubleSide, ...METAL }), 0, h * 0.85, 0);
    },
    // Amethyst geode: a dark stone shell lined with glowing crystals.
    geodeLamp(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      cyl(g, w * 0.3, w * 0.35, 0.03, '#2b2b2b', 0, 0, 0);
      const shell = add(g, new THREE.SphereGeometry(0.5, 18, 12, Math.PI * 0.15, Math.PI * 1.7), mat('#6e665c', { flatShading: true, side: THREE.DoubleSide, roughness: 1 }), 0, 0.03 + (h - 0.03) / 2, 0);
      shell.scale.set(w, h - 0.03, d * 0.7);
      shell.rotation.y = Math.PI / 2;
      const cy = 0.03 + (h - 0.03) / 2;
      // Crystals grow from the inside of the rim towards the middle and the viewer.
      const up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < 30; k++) {
        const a = r() * Math.PI * 2, rr = 0.3 + r() * 0.12;
        const x = Math.cos(a) * w * rr, y = cy + Math.sin(a) * (h - 0.03) * rr, z = -d * 0.15 + r() * d * 0.1;
        const cr = add(g, new THREE.ConeGeometry(0.01 + r() * 0.01, 0.04 + r() * 0.04, 6), mat(c, { flatShading: true, emissive: c, emissiveIntensity: 0.9, roughness: 0.2 }), x, y, z);
        cr.quaternion.setFromUnitVectors(up, new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0.7).normalize());
      }
      ball(g, w * 0.12, '#f0d6ff', 0, cy, -d * 0.1, { emissive: c, emissiveIntensity: 1.5 });
    },
    // Carved gourd: dotted light pours out of a dried gourd.
    gourdLamp(g, w, d, h, c, it) {
      cyl(g, w * 0.25, w * 0.3, 0.03, 'wood:walnut', 0, 0, 0);
      const pts = profile(24, h - 0.03, t => (w / 2) * (t < 0.62 ? Math.sin(Math.PI * (0.1 + (t / 0.62) * 0.9)) * 0.98 + 0.02 : 0.32 * Math.sin(Math.PI * ((t - 0.62) / 0.38) * 0.9 + 0.3) + 0.06));
      const body = add(g, new THREE.LatheGeometry(pts, 36), glowTexMat(artTexture('gourd', seedOf(it)), 1.1, { roughness: 0.8, color: c }), 0, 0.03, 0);
      body.castShadow = false;
      ball(g, w * 0.15, '#ffcf8a', 0, h * 0.3, 0, { emissive: '#ffb347', emissiveIntensity: 2 });
    },
    // Woven rattan globe on a tribal wooden stand.
    rattanLamp(g, w, d, h, c, it) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        tube(g, [[Math.cos(a) * w * 0.32, 0, Math.sin(a) * w * 0.32], [Math.cos(a) * w * 0.1, h * 0.35, Math.sin(a) * w * 0.1]], 0.012, c);
      }
      const r = Math.min(w, h * 0.75) / 2;
      const shade = add(g, new THREE.SphereGeometry(r, 32, 18), glowTexMat(artTexture('weave', seedOf(it)), 0.9, { roughness: 1 }), 0, h - r, 0);
      shade.castShadow = false;
    },
    // Drum shade printed with a mandala, on a carved wooden base.
    mandalaLamp(g, w, d, h, c, it) {
      const bh = h * 0.45;
      add(g, new THREE.LatheGeometry(profile(14, bh, t => w * (0.14 + 0.08 * Math.sin(t * Math.PI * 4)) * (1 - 0.3 * t)), 24), mat(c, { roughness: 0.6 }));
      const shade = add(g, new THREE.CylinderGeometry(w / 2, w / 2, h * 0.5, 40, 1, true), glowTexMat(artTexture('mandala', seedOf(it)), 0.8, { roughness: 1 }), 0, bh + h * 0.27, 0);
      shade.castShadow = false;
    },
    // Tiffany lamp: bronze base and a dome of coloured glass.
    tiffanyLamp(g, w, d, h, c, it) {
      cyl(g, w * 0.22, w * 0.26, 0.04, c, 0, 0, 0, METAL);
      add(g, new THREE.LatheGeometry(profile(10, h * 0.62, t => w * (0.05 + 0.06 * (1 - t) ** 3)), 20), mat(c, METAL), 0, 0.04, 0);
      const dome = add(g, new THREE.SphereGeometry(w / 2, 36, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), glowTexMat(artTexture('tiffany', seedOf(it)), 1, { roughness: 0.25 }), 0, h * 0.58, 0);
      dome.scale.y = (h * 0.42) / (w / 2);
      dome.castShadow = false;
      ball(g, 0.015, c, 0, h - 0.005, 0, METAL);
    },
    // Crystal ball held by three wooden claws, a swirl of light inside.
    crystalBall(g, w, d, h, c, it) {
      const r = Math.min(w, h) * 0.38;
      cyl(g, w * 0.36, w * 0.42, h * 0.16, c, 0, 0, 0, { roughness: 0.6 });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        tube(g, [[Math.cos(a) * w * 0.3, h * 0.15, Math.sin(a) * w * 0.3], [Math.cos(a) * r * 0.95, h * 0.16 + r * 0.6, Math.sin(a) * r * 0.95], [Math.cos(a) * r * 0.7, h * 0.16 + r * 1.2, Math.sin(a) * r * 0.7]], 0.008, c);
      }
      const cy = h * 0.16 + r;
      add(g, new THREE.SphereGeometry(r, 28, 18), mat('#e6f0ff', { transparent: true, opacity: 0.28, roughness: 0.02, depthWrite: false })).position.set(0, cy, 0);
      const swirl = mulberry(seedOf(it));
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9;
        ball(g, r * (0.18 + swirl() * 0.12), k % 2 ? '#b38cff' : '#7fd4ff', Math.cos(a) * r * 0.35, cy + (k - 3) * r * 0.1, Math.sin(a) * r * 0.35, { emissive: k % 2 ? '#9b6bff' : '#5fc8ff', emissiveIntensity: 1.4, transparent: true, opacity: 0.8 });
      }
    },
    // Tribal totem: a carved wooden column with glowing cut-outs.
    totemLamp(g, w, d, h, c, it) {
      box(g, w, 0.03, d, '#2b2b2b', 0, 0, 0);
      const col = add(g, new THREE.BoxGeometry(w * 0.7, h - 0.06, d * 0.7), glowTexMat(artTexture('tribal', seedOf(it)), 1, { roughness: 0.8, color: c }), 0, 0.03 + (h - 0.06) / 2, 0);
      col.castShadow = true;
      box(g, w * 0.85, 0.03, d * 0.85, '#2b2b2b', 0, h - 0.03, 0);
    },
    // Dreamcatcher for the wall: a hoop with a web, beads and feathers hanging.
    dreamcatcher(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const R = w / 2 - 0.01, cy = h - R - 0.03, z = -d / 2 + 0.02;
      add(g, new THREE.TorusGeometry(R, 0.008, 8, 40), mat(c, { roughness: 1 }), 0, cy, z);
      const n = 8, web = [];
      for (let ring = 0; ring < 3; ring++) {
        const rr = R * (0.85 - ring * 0.25), pts = [];
        for (let k = 0; k <= n; k++) { const a = ((k + ring * 0.5) / n) * Math.PI * 2; pts.push([Math.cos(a) * rr, cy + Math.sin(a) * rr, z]); }
        web.push(pts);
      }
      for (const pts of web) for (let k = 0; k < n; k++) tube(g, [pts[k], pts[k + 1]], 0.0015, '#f2ead8');
      for (let k = 0; k < n; k++) tube(g, [web[0][k], web[1][k], web[2][k]], 0.0015, '#f2ead8');
      ball(g, 0.012, '#3fb8a9', 0, cy, z);
      tube(g, [[0, cy + R, z], [0, h, z]], 0.002, c);
      for (const x of [-R * 0.6, 0, R * 0.6]) {
        const len = h * 0.25 + r() * h * 0.1, top = cy - R * (x ? 0.8 : 1);
        tube(g, [[x, top, z], [x, top - len, z]], 0.0015, c);
        ball(g, 0.01, ['#e0475b', '#ffd56b', '#3fb8a9'][Math.floor(r() * 3)], x, top - len * 0.4, z);
        leaf(g, x, top - len - 0.11, z, 0.12, 0.035, 0, Math.PI, ['#f2ead8', '#c9a57a', '#8c6bb1'][Math.floor(r() * 3)]);
      }
    },

    // ---------- more floor lamps ----------
    // Uplighter: a bowl on a slim pole throwing light at the ceiling.
    torchiere(g, w, d, h, c) {
      cyl(g, w * 0.4, w * 0.45, 0.03, c, 0, 0, 0, METAL);
      cyl(g, 0.012, 0.012, h - 0.15, c, 0, 0.03, 0, METAL, 8);
      cyl(g, w / 2, 0.05, 0.13, c, 0, h - 0.13, 0, { side: THREE.DoubleSide, ...METAL }, 28);
      cyl(g, w / 2 - 0.01, w / 2 - 0.01, 0.004, '#fff3d6', 0, h - 0.006, 0, { emissive: '#ffe6b0', emissiveIntensity: 2 });
    },
    globeFloor(g, w, d, h, c) {
      cyl(g, w * 0.4, w * 0.45, 0.03, c, 0, 0, 0, METAL);
      const r = Math.min(w, d) / 2;
      cyl(g, 0.012, 0.012, h - 2 * r, c, 0, 0.03, 0, METAL, 8);
      ball(g, r, '#fbf3e4', 0, h - r, 0, { emissive: '#ffe9c4', emissiveIntensity: 1.1, roughness: 0.3 });
    },
    // Paper lantern on thin legs, glowing all over.
    paperLantern(g, w, d, h, c) {
      const legH = h * 0.22;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        tube(g, [[Math.cos(a) * w * 0.35, 0, Math.sin(a) * w * 0.35], [Math.cos(a) * w * 0.12, legH + 0.05, Math.sin(a) * w * 0.12]], 0.006, DARK, METAL);
      }
      const pts = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector2((w / 2) * (0.35 + 0.65 * Math.sin(Math.PI * t)), t * (h - legH))); }
      const shade = add(g, new THREE.LatheGeometry(pts, 32), mat(c, { side: THREE.DoubleSide, roughness: 1, emissive: c, emissiveIntensity: 0.6 }), 0, legH, 0);
      shade.castShadow = false;
      for (let k = 1; k < 8; k++) {
        const t = k / 8, rr = (w / 2) * (0.35 + 0.65 * Math.sin(Math.PI * t));
        const ring = add(g, new THREE.TorusGeometry(rr + 0.002, 0.002, 4, 32), mat('#d9cdb5'), 0, legH + t * (h - legH), 0);
        ring.rotation.x = Math.PI / 2;
      }
    },
    // Studio spotlight on a tripod.
    spotTripod(g, w, d, h, c) {
      const top = h - 0.25;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
        tube(g, [[Math.cos(a) * w * 0.45, 0, Math.sin(a) * d * 0.45], [0, top * 0.55, 0]], 0.01, 'wood:walnut');
      }
      cyl(g, 0.012, 0.012, top * 0.45, '#c0c4c6', 0, top * 0.55, 0, METAL, 8);
      const head = new THREE.Group();
      head.position.set(0, top + 0.1, 0);
      head.rotation.x = 0.35;
      g.add(head);
      const can = add(head, new THREE.CylinderGeometry(0.13, 0.11, 0.3, 28, 1, true), mat(c, { side: THREE.DoubleSide, ...METAL }));
      can.rotation.x = Math.PI / 2;
      const lens = add(head, new THREE.CircleGeometry(0.12, 28), mat('#fff3d6', { emissive: '#ffe6b0', emissiveIntensity: 1.6 }), 0, 0, 0.14);
      lens.castShadow = false;
      for (const s of [-1, 1]) box(head, 0.015, 0.16, 0.03, '#c0c4c6', s * 0.14, -0.16, 0, METAL);
    },
    // Reading lamp: small head on a short arm, to put by an armchair.
    readingLamp(g, w, d, h, c) {
      cyl(g, w * 0.4, w * 0.45, 0.025, c, -w * 0.15, 0, 0, METAL);
      cyl(g, 0.01, 0.01, h - 0.1, c, -w * 0.15, 0.025, 0, METAL, 8);
      tube(g, [[-w * 0.15, h - 0.08, 0], [w * 0.05, h, 0], [w * 0.3, h - 0.03, 0]], 0.007, c, METAL);
      const cone = add(g, new THREE.CylinderGeometry(0.03, 0.07, 0.13, 24, 1, true), mat(c, { side: THREE.DoubleSide, ...METAL }), w * 0.32, h - 0.1, 0);
      cone.rotation.z = -0.3;
      ball(g, 0.025, '#fff3d6', w * 0.33, h - 0.14, 0, { emissive: '#ffe6b0', emissiveIntensity: 2 });
    },
    // Slim glowing column.
    tubeLamp(g, w, d, h, c) {
      cyl(g, w * 0.45, w * 0.5, 0.03, c, 0, 0, 0, METAL);
      cyl(g, w * 0.22, w * 0.22, h - 0.06, '#fff8ea', 0, 0.03, 0, { emissive: '#ffefd0', emissiveIntensity: 1.3, roughness: 0.3 }, 20);
      cyl(g, w * 0.26, w * 0.26, 0.03, c, 0, h - 0.03, 0, METAL);
    },

    // ---------- bathroom ----------
    towelRail(g, w, d, h, c) {
      const z = -d / 2;
      for (const s of [-1, 1]) box(g, 0.02, 0.04, d * 0.8, '#c0c4c6', s * (w / 2 - 0.01), h - 0.06, z + d * 0.4, METAL);
      const bar = cyl(g, 0.01, 0.01, w, '#c0c4c6', 0, 0, 0, METAL, 10);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, h - 0.04, z + d * 0.7);
      box(g, w * 0.7, h * 0.9, 0.025, c, 0, h * 0.06, z + d * 0.62, { roughness: 1 });
      box(g, w * 0.7, h * 0.5, 0.025, shade(c, -0.06), 0, h * 0.46, z + d * 0.78, { roughness: 1 });
    },
    towelRadiator(g, w, d, h, c) {
      const z = -d / 2 + d * 0.5;
      for (const s of [-1, 1]) cyl(g, 0.014, 0.014, h, c, s * (w / 2 - 0.015), 0, z, { roughness: 0.3 }, 10);
      for (let y = 0.05; y < h - 0.02; y += 0.07) { const t = cyl(g, 0.009, 0.009, w - 0.03, c, 0, 0, 0, { roughness: 0.3 }, 8); t.rotation.z = Math.PI / 2; t.position.set(0, y, z); }
      box(g, w * 0.75, h * 0.35, 0.03, '#9fb8c8', 0, h * 0.5, z + 0.025, { roughness: 1 });
    },
    toiletPaper(g, w, d, h, c) {
      box(g, 0.05, 0.05, 0.015, c, -w / 2 + 0.025, h - 0.06, -d / 2 + 0.0075, METAL);
      const arm = cyl(g, 0.005, 0.005, w - 0.02, c, 0, 0, 0, METAL, 8);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(0, h - 0.035, -d / 2 + d * 0.55);
      const roll = cyl(g, 0.055, 0.055, w * 0.7, '#fbfaf7', 0, 0, 0, { roughness: 1 }, 20);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0.01, h - 0.035, -d / 2 + d * 0.55);
    },
    // Bathroom cabinet with mirror doors and a light on top.
    mirrorCabinet(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0);
      const n = w > 0.6 ? 2 : 1;
      for (let k = 0; k < n; k++) box(g, w / n - 0.01, h - 0.02, 0.006, '#cfdde3', -w / 2 + (k + 0.5) * (w / n), 0.01, d / 2 + 0.003, { metalness: 0.35, roughness: 0.06 });
      box(g, w * 0.8, 0.03, 0.04, '#fff8ea', 0, h + 0.01, d / 2 - 0.01, { emissive: '#fff1d0', emissiveIntensity: 1.4 });
    },
    laundryBasket(g, w, d, h, c, it) {
      const m = texMat(artTexture('weave', seedOf(it)), { roughness: 1, side: THREE.DoubleSide }, c);
      const b = add(g, new THREE.CylinderGeometry(w / 2, w * 0.42, h * 0.92, 28, 1, true), m, 0, h * 0.46, 0);
      b.castShadow = true;
      cyl(g, w * 0.42, w * 0.42, 0.01, shade(c, -0.2), 0, 0, 0);
      cyl(g, w / 2 + 0.01, w / 2 + 0.01, h * 0.08, c, 0, h * 0.92, 0, { roughness: 1 }, 28);
    },
    // Soap dispenser, toothbrush cup and a little tray, for the washbasin.
    bathSet(g, w, d, h, c) {
      box(g, w, 0.01, d, '#e9e6df', 0, 0, 0, { roughness: 0.3 });
      cyl(g, 0.03, 0.03, h * 0.6, c, -w * 0.25, 0.01, 0, { roughness: 0.2 }, 16);
      cyl(g, 0.006, 0.006, h * 0.3, '#c0c4c6', -w * 0.25, 0.01 + h * 0.6, 0, METAL, 6);
      box(g, 0.035, 0.008, 0.01, '#c0c4c6', -w * 0.25 + 0.015, h * 0.88, 0, METAL);
      cyl(g, 0.03, 0.025, h * 0.5, c, w * 0.22, 0.01, 0, { roughness: 0.2 }, 16);
      for (const [x, col] of [[-0.008, '#3fb8a9'], [0.01, '#e0475b']]) { const b = cyl(g, 0.004, 0.004, h * 0.6, col, w * 0.22 + x, 0.03, 0, {}, 6); b.rotation.z = x * 10; }
    },
    scale(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.2 });
      box(g, w * 0.4, 0.002, d * 0.15, '#1d1d1f', 0, h, -d * 0.3, { emissive: '#7fc7c0', emissiveIntensity: 0.4 });
    },
    // Ladder shelf leaning on the wall, with rolled towels.
    ladderShelf(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const lean = Math.atan2(d - 0.05, h);
      for (const s of [-1, 1]) {
        const rail = box(g, 0.03, h / Math.cos(lean), 0.03, c, 0, 0, 0);
        rail.position.set(s * (w / 2 - 0.015), h / 2, 0);
        rail.rotation.x = -lean;
      }
      const n = 4;
      for (let k = 0; k < n; k++) {
        const y = 0.25 + (k * (h - 0.4)) / (n - 1), z = d / 2 - 0.03 - (y / h) * (d - 0.05) - 0.06;
        box(g, w - 0.04, 0.02, 0.18 - k * 0.025, c, 0, y, z + 0.03);
        for (let t = 0; t < 2; t++) {
          const roll = cyl(g, 0.045, 0.045, 0.14 - k * 0.02, ['#f2ead8', '#9fb8c8', '#e8b7a8', '#8a9a7b'][Math.floor(r() * 4)], 0, 0, 0, { roughness: 1 }, 14);
          roll.rotation.x = Math.PI / 2;
          roll.position.set(-w * 0.18 + t * w * 0.36, y + 0.065, z + 0.03);
        }
      }
    },

    // ---------- kitchen ----------
    kettle(g, w, d, h, c) {
      cyl(g, w * 0.42, w * 0.44, 0.02, '#2b2b2b', 0, 0, 0);
      add(g, new THREE.LatheGeometry(profile(12, h * 0.8, t => (w / 2) * 0.8 * (1 - 0.35 * t)), 24), mat(c, { roughness: 0.25, side: THREE.DoubleSide }), 0, 0.02, 0);
      cyl(g, w * 0.22, w * 0.22, 0.02, '#2b2b2b', 0, h * 0.82, 0);
      tube(g, [[-w * 0.25, h * 0.75, 0], [-w * 0.45, h * 0.6, 0], [-w * 0.38, h * 0.25, 0]], 0.012, '#2b2b2b');
      tube(g, [[w * 0.32, h * 0.35, 0], [w * 0.48, h * 0.55, 0]], 0.012, c);
    },
    toaster(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.25, metalness: 0.3 });
      for (const s of [-1, 1]) box(g, w * 0.7, 0.004, 0.025, '#1d1d1f', 0, h, s * d * 0.18);
      box(g, 0.02, 0.03, 0.015, '#2b2b2b', w / 2, h * 0.7, 0);
    },
    knifeBlock(g, w, d, h, c) {
      const b = box(g, w, h * 0.7, d, c, 0, 0, 0);
      b.rotation.x = -0.25;
      for (let k = 0; k < 5; k++) {
        const hd = box(g, 0.018, 0.1, 0.022, '#1d1d1f', -w * 0.3 + (k % 3) * w * 0.3, h * 0.72, -d * 0.25 + Math.floor(k / 3) * 0.04);
        hd.rotation.x = -0.25;
      }
    },
    utensilHolder(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      cyl(g, w / 2, w * 0.45, h * 0.45, c, 0, 0, 0, { roughness: 0.3 }, 18);
      for (let k = 0; k < 5; k++) {
        const a = r() * Math.PI * 2, x = Math.cos(a) * w * 0.18, z = Math.sin(a) * w * 0.18;
        tube(g, [[x * 0.5, h * 0.1, z * 0.5], [x, h * 0.95, z]], 0.006, ['wood:oak', '#2b2b2b', '#c0c4c6'][k % 3]);
        box(g, 0.04, 0.05, 0.008, k % 2 ? 'wood:oak' : '#2b2b2b', x, h * 0.9, z);
      }
    },
    dishRack(g, w, d, h, c) {
      box(g, w, 0.015, d, '#c0c4c6', 0, 0, 0, METAL);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.004, 0.004, h * 0.5, '#c0c4c6', sx * (w / 2 - 0.01), 0.015, sz * (d / 2 - 0.01), METAL, 6);
      for (let k = 0; k < 6; k++) {
        const p = cyl(g, 0.11, 0.11, 0.012, k % 2 ? '#f4f3ef' : '#9fb8c8', -w / 2 + 0.06 + k * 0.045, 0.13, -d * 0.1, { roughness: 0.3 }, 24);
        p.rotation.z = Math.PI / 2 - 0.15;
      }
      for (const x of [w * 0.3, w * 0.38]) cyl(g, 0.035, 0.03, 0.09, '#f4f3ef', x, 0.015, d * 0.2, { roughness: 0.3 }, 14);
    },
    // A pot and a pan on the hob.
    pots(g, w, d, h, c) {
      cyl(g, 0.1, 0.1, h * 0.9, c, -w * 0.22, 0, -d * 0.18, METAL, 24);
      cyl(g, 0.105, 0.105, 0.01, c, -w * 0.22, h * 0.9, -d * 0.18, METAL, 24);
      ball(g, 0.012, '#2b2b2b', -w * 0.22, h * 0.95, -d * 0.18);
      cyl(g, 0.12, 0.11, 0.05, '#2b2b2b', w * 0.18, 0, d * 0.15, { roughness: 0.4 }, 24);
      const hd = box(g, 0.025, 0.02, 0.2, '#2b2b2b', w * 0.18, 0.03, d * 0.15 + 0.2);
      hd.rotation.x = 0.1;
    },
    jars(g, w, d, h, c) {
      [['#e9d27a', 0.75], ['#8a5a3c', 1], ['#f4efe4', 0.6]].forEach(([fill, k], i) => {
        const x = -w / 2 + w / 6 + (i * w) / 3, jh = h * k;
        cyl(g, w / 7, w / 7, jh, '#e6f0f2', x, 0, 0, { transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }, 18);
        cyl(g, w / 7 - 0.004, w / 7 - 0.004, jh * 0.7, fill, x, 0.003, 0, { roughness: 1 }, 18);
        cyl(g, w / 7 + 0.003, w / 7 + 0.003, 0.025, 'wood:oak', x, jh, 0, {}, 18);
      });
    },
    cuttingBoard(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0);
      ball(g, 0.05, '#c98a4a', w * 0.15, h + 0.03, 0, { roughness: 1 }).scale.set(1.6, 0.7, 1);
      ball(g, 0.035, '#d94a3a', -w * 0.22, h + 0.03, d * 0.1);
    },
    spiceRack(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      for (const y of [0, h * 0.52]) {
        box(g, w, 0.015, d, c, 0, y, 0);
        box(g, w, 0.035, 0.008, c, 0, y + 0.015, d / 2 - 0.004);
        for (let x = -w / 2 + 0.04; x < w / 2 - 0.03; x += 0.055) {
          cyl(g, 0.02, 0.02, 0.08, '#e6f0f2', x, y + 0.015, 0, { transparent: true, opacity: 0.5, depthWrite: false }, 12);
          cyl(g, 0.018, 0.018, 0.05, ['#c0392b', '#e8a33c', '#56704f', '#8a5a3c', '#e9d27a'][Math.floor(r() * 5)], x, y + 0.017, 0, { roughness: 1 }, 12);
          cyl(g, 0.021, 0.021, 0.015, '#2b2b2b', x, y + 0.095, 0, {}, 12);
        }
      }
    },
    // Wall rail with hanging ladles and spoons.
    utensilRail(g, w, d, h, c) {
      const z = -d / 2 + 0.04;
      const bar = cyl(g, 0.007, 0.007, w, c, 0, 0, 0, METAL, 8);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, h - 0.02, z);
      for (const s of [-1, 1]) box(g, 0.015, 0.03, 0.05, c, s * (w / 2 - 0.02), h - 0.035, -d / 2 + 0.025, METAL);
      const n = Math.max(3, Math.round(w / 0.12));
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + 0.08 + (k * (w - 0.16)) / (n - 1), len = h * (0.6 + (k % 3) * 0.12);
        tube(g, [[x, h - 0.02, z], [x, h - 0.02 - len, z]], 0.004, k % 2 ? '#2b2b2b' : '#c0c4c6', METAL);
        if (k % 3 === 0) { const s = ball(g, 0.035, '#c0c4c6', x, h - len - 0.05, z + 0.01, METAL); s.scale.z = 0.4; }
        else box(g, k % 3 === 1 ? 0.06 : 0.035, 0.07, 0.006, k % 2 ? '#2b2b2b' : '#c0c4c6', x, h - len - 0.09, z, METAL);
      }
    },
    // Kitchen island: cabinets with a worktop that overhangs at the back for stools.
    kitchenIsland(g, w, d, h, c) {
      const over = Math.min(0.3, d * 0.3), body = d - over, zc = d / 2 - body / 2; // cabinets at the front
      box(g, w, 0.1, body - 0.06, '#2b2b2b', 0, 0, zc - 0.03);
      box(g, w, h - 0.14, body, c, 0, 0.1, zc);
      fronts(g, w, h - 0.14, body, Math.max(2, Math.round(w / 0.6)), 0.1, zc);
      box(g, w + 0.04, 0.04, d, '#e9e6df', 0, h - 0.04, 0, { roughness: 0.25 });
    },
    barStool(g, w, d, h, c) {
      const seat = cyl(g, w / 2, w / 2 - 0.02, 0.05, c, 0, h - 0.05, 0, { roughness: 0.8 }, 24);
      seat.castShadow = true;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        tube(g, [[Math.cos(a) * w * 0.45, 0, Math.sin(a) * w * 0.45], [Math.cos(a) * w * 0.3, h - 0.05, Math.sin(a) * w * 0.3]], 0.01, '#2b2b2b', METAL);
      }
      const ring = add(g, new THREE.TorusGeometry(w * 0.38, 0.007, 6, 24), mat('#2b2b2b', METAL), 0, h * 0.32, 0);
      ring.rotation.x = Math.PI / 2;
    },
    dishwasher(g, w, d, h, c) {
      box(g, w, 0.1, d - 0.06, DARK, 0, 0, -0.03);
      box(g, w, h - 0.14, d - 0.03, c, 0, 0.1, -0.015, { roughness: 0.3, metalness: 0.3 });
      box(g, w - 0.02, 0.08, 0.005, '#3b3f45', 0, h - 0.24, d / 2 - 0.012);
      box(g, w * 0.6, 0.015, 0.025, '#c0c4c6', 0, h - 0.29, d / 2, METAL);
      box(g, w, 0.04, d, '#4a4743', 0, h - 0.04, 0);
    },
    ovenColumn(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0);
      box(g, w - 0.06, 0.5, 0.01, '#1c1c1c', 0, 0.75, d / 2 + 0.003, { roughness: 0.15 });
      box(g, w * 0.7, 0.012, 0.025, '#c0c4c6', 0, 1.2, d / 2 + 0.015, METAL);
      box(g, w - 0.06, 0.36, 0.01, '#1c1c1c', 0, 1.32, d / 2 + 0.003, { roughness: 0.15 });
      fronts(g, w, 0.65, d, 1, 0.08);
      fronts(g, w, h - 1.72, d, 1, 1.7);
    },
    trashBin(g, w, d, h, c) {
      cyl(g, w / 2, w * 0.46, h - 0.03, c, 0, 0, 0, METAL, 24);
      add(g, new THREE.SphereGeometry(w / 2, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, METAL), 0, h - 0.03, 0).scale.y = 0.2;
      box(g, 0.08, 0.015, 0.06, '#2b2b2b', 0, 0, w / 2);
    },

    // ---------- bedroom and kids ----------
    bunkBed(g, w, d, h, c) {
      const p = 0.06;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, p, h, p, c, sx * (w / 2 - p / 2), 0, sz * (d / 2 - p / 2));
      for (const y of [0.2, h * 0.58]) {
        box(g, w, 0.06, d, c, 0, y, 0);
        box(g, w - 0.08, 0.16, d - 0.1, '#ffffff', 0, y + 0.06, 0);
        box(g, w - 0.16, 0.1, 0.35, '#ffffff', 0, y + 0.22, -d / 2 + 0.25);
        box(g, w - 0.1, 0.03, d * 0.6, '#9fb8c8', 0, y + 0.22, d * 0.12, { roughness: 1 });
      }
      for (const y of [h * 0.58 + 0.25, h - 0.05]) for (const s of [-1, 1]) box(g, p * 0.5, 0.04, d * (s > 0 ? 0.6 : 1), c, s * (w / 2 - p / 2), y, s > 0 ? -d * 0.2 : 0);
      for (let k = 0; k < 4; k++) box(g, w * 0.25, 0.03, 0.04, c, w / 2 - w * 0.18, 0.4 + k * (h * 0.58 - 0.3) / 3, d / 2 - 0.08);
      for (const s of [-1, 1]) box(g, 0.04, h * 0.85, 0.04, c, w / 2 - w * 0.18 + s * w * 0.12, 0.2, d / 2 - 0.08);
    },
    crib(g, w, d, h, c) {
      const p = 0.04, bed = 0.35;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, p, h, p, c, sx * (w / 2 - p / 2), 0, sz * (d / 2 - p / 2));
      box(g, w - 0.04, 0.04, d - 0.04, c, 0, bed, 0);
      box(g, w - 0.08, 0.1, d - 0.08, '#ffffff', 0, bed + 0.04, 0);
      box(g, w - 0.1, 0.03, d * 0.5, '#e8b7a8', 0, bed + 0.14, d * 0.15, { roughness: 1 });
      for (const sz of [-1, 1]) for (const y of [bed, h - 0.04]) box(g, w, 0.035, 0.03, c, 0, y, sz * (d / 2 - 0.015));
      for (const sx of [-1, 1]) for (const y of [bed, h - 0.04]) box(g, 0.03, 0.035, d, c, sx * (w / 2 - 0.015), y, 0);
      for (let x = -w / 2 + 0.08; x < w / 2 - 0.04; x += 0.07) for (const sz of [-1, 1]) box(g, 0.02, h - bed - 0.04, 0.02, c, x, bed, sz * (d / 2 - 0.015));
      for (let z = -d / 2 + 0.08; z < d / 2 - 0.04; z += 0.07) for (const sx of [-1, 1]) box(g, 0.02, h - bed - 0.04, 0.02, c, sx * (w / 2 - 0.015), bed, z);
    },
    changingTable(g, w, d, h, c) {
      box(g, w, h - 0.15, d, c, 0, 0, 0);
      fronts(g, w, h - 0.17, d, 2, 0.02);
      for (const s of [-1, 1]) box(g, 0.02, 0.12, d, c, s * (w / 2 - 0.01), h - 0.15, 0);
      box(g, w, 0.12, 0.02, c, 0, h - 0.15, -d / 2 + 0.01);
      box(g, w - 0.06, 0.06, d - 0.06, '#9fb8c8', 0, h - 0.15, 0.01, { roughness: 1 });
    },
    toyBox(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      box(g, w, h, d, c, 0, 0, 0, { roughness: 1 });
      box(g, w - 0.04, 0.01, d - 0.04, shade(c, -0.25), 0, h - 0.06, 0);
      const cols = ['#d94a3a', '#f2c14e', '#3f6fb0', '#56a05a', '#9b5c7a'];
      for (let k = 0; k < 5; k++) ball(g, 0.05 + r() * 0.03, cols[k], (r() - 0.5) * w * 0.6, h - 0.02, (r() - 0.5) * d * 0.5, { roughness: 0.4 });
      for (let k = 0; k < 4; k++) box(g, 0.06, 0.06, 0.06, cols[(k + 2) % 5], -w / 2 - 0.08 + k * 0.07, 0, d / 2 + 0.06 + (k % 2) * 0.05).rotation.y = r();
      const bear = ball(g, 0.07, '#a77a4a', w / 2 + 0.1, 0.07, 0, { roughness: 1 });
      ball(g, 0.05, '#a77a4a', w / 2 + 0.1, 0.18, 0, { roughness: 1 });
      bear.scale.y = 1.1;
    },
    // Kids' play tent: four poles crossing at the top and a fabric pyramid, open at the front.
    teepee(g, w, d, h, c, it) {
      const r = w / 2, top = h;
      const corners = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([x, z]) => [x * 0.95, z * 0.95]);
      for (const [x, z] of corners) tube(g, [[x, 0, z], [-x * 0.25, top + 0.15, -z * 0.25]], 0.012, 'wood:oak');
      const tip = new THREE.Vector3(0, top * 0.92, 0);
      const sides = [[3, 0], [0, 1], [1, 2]]; // back and sides; the front (2 -> 3) stays open
      for (const [a, b] of sides) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(corners[a][0], 0, corners[a][1]), new THREE.Vector3(corners[b][0], 0, corners[b][1]), tip]);
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
        geo.computeVertexNormals();
        add(g, geo, texMat(artTexture('kilim', seedOf(it)), { side: THREE.DoubleSide, roughness: 1 }, c));
      }
      for (const s of [-1, 1]) {
        const flap = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s * r * 0.95, 0, r * 0.95), new THREE.Vector3(s * r * 0.35, 0, r * 0.75), tip]);
        flap.computeVertexNormals();
        add(g, flap, mat(c, { side: THREE.DoubleSide, roughness: 1 }));
      }
      box(g, w * 0.8, 0.04, d * 0.8, '#d9b44a', 0, 0, 0, { roughness: 1 }).castShadow = false;
    },
    rockingHorse(g, w, d, h, c) {
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 12; k++) { const a = -0.7 + (k / 12) * 1.4; pts.push([s * w * 0.4, 0.5 - Math.cos(a) * 0.48, Math.sin(a) * d * 0.62]); }
        tube(g, pts, 0.015, 'wood:walnut');
      }
      const body = ball(g, 0.5, c, 0, h * 0.55, 0, { roughness: 0.5 });
      body.scale.set(w * 0.8, h * 0.28, d * 0.6);
      const head = box(g, w * 0.55, h * 0.35, d * 0.2, c, 0, h * 0.6, d * 0.32, { roughness: 0.5 });
      head.rotation.x = -0.4;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) tube(g, [[sx * w * 0.2, h * 0.5, sz * d * 0.18], [sx * w * 0.4, 0.08, sz * d * 0.3]], 0.015, c);
      box(g, w * 0.15, h * 0.25, d * 0.3, '#f2ead8', 0, h * 0.62, d * 0.12, { roughness: 1 });
    },
    vanity(g, w, d, h, c) {
      const top = 0.76;
      box(g, w, 0.04, d, c, 0, top - 0.04, 0);
      for (const s of [-1, 1]) { box(g, 0.32, top - 0.04, d, c, s * (w / 2 - 0.16), 0, 0); fronts(g, 0.32, top - 0.06, d, 1, 0.02, 0, s * (w / 2 - 0.16)); }
      box(g, w - 0.64, 0.14, d, c, 0, top - 0.18, 0);
      const r = Math.min(w * 0.3, (h - top) / 2 - 0.02);
      disc(g, r + 0.02, 0.03, c, 0, top + r + 0.02, -d / 2 + 0.03);
      disc(g, r, 0.006, '#cfdde3', 0, top + r + 0.02, -d / 2 + 0.05, { metalness: 0.35, roughness: 0.06 });
      for (let k = 0; k < 3; k++) cyl(g, 0.02, 0.02, 0.06 + k * 0.03, ['#e8b7a8', '#f2f0eb', '#c9a24a'][k], -w * 0.3 + k * 0.06, top, 0.05, { roughness: 0.2 }, 12);
    },
    slidingWardrobe(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0);
      const n = w > 1.8 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const dw = w / n, x = -w / 2 + dw * (k + 0.5), z = d / 2 + (k % 2 ? 0.02 : 0.005);
        box(g, dw - 0.01, h - 0.06, 0.012, '#cfdde3', x, 0.03, z, { metalness: 0.35, roughness: 0.06 });
        box(g, 0.02, h - 0.06, 0.02, '#9a9a9a', x - dw / 2 + 0.01, 0.03, z + 0.008, METAL);
      }
      box(g, w, 0.03, 0.03, '#9a9a9a', 0, h - 0.03, d / 2 + 0.015, METAL);
    },
    trunk(g, w, d, h, c) {
      box(g, w, h * 0.75, d, c, 0, 0, 0, { roughness: 0.7 });
      const lid = cyl(g, d / 2, d / 2, w, c, 0, 0, 0, { roughness: 0.7 }, 20);
      lid.rotation.z = Math.PI / 2;
      lid.scale.set((h * 0.25) / (d / 2), 1, 1); // a low rounded lid
      lid.position.set(0, h * 0.75, 0);
      for (const x of [-w * 0.3, w * 0.3]) box(g, 0.04, h * 0.95, d + 0.01, '#5b4636', x, 0, 0, { roughness: 0.5 });
      box(g, 0.06, 0.08, 0.02, '#c9a24a', 0, h * 0.62, d / 2 + 0.01, METAL);
    },

    // ---------- laundry, climate, utility ----------
    dryingRack(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      for (const s of [-1, 1]) for (const z of [-1, 1]) tube(g, [[s * w * 0.35, 0, z * d * 0.45], [s * w * 0.25, h - 0.05, 0]], 0.008, c, METAL);
      for (let k = -4; k <= 4; k++) { const b = cyl(g, 0.004, 0.004, w, c, 0, 0, 0, METAL, 6); b.rotation.z = Math.PI / 2; b.position.set(0, h - 0.05, k * d * 0.1); }
      const cols = ['#9fb8c8', '#e8b7a8', '#f2ead8', '#56704f', '#2f4a6b'];
      for (let k = 0; k < 6; k++) box(g, 0.25 + r() * 0.2, 0.3 + r() * 0.2, 0.01, cols[k % 5], -w / 2 + 0.25 + k * (w - 0.4) / 5, h - 0.5 - r() * 0.1, (k % 2 ? 1 : -1) * d * 0.2, { roughness: 1, side: THREE.DoubleSide });
    },
    ironingBoard(g, w, d, h, c) {
      const top = new THREE.Shape();
      top.moveTo(-w / 2, -d / 2); top.lineTo(w / 2 - d / 2, -d / 2); top.quadraticCurveTo(w / 2 + d * 0.2, 0, w / 2 - d / 2, d / 2); top.lineTo(-w / 2, d / 2); top.closePath();
      const geo = new THREE.ExtrudeGeometry(top, { depth: 0.03, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      add(g, geo, mat(c, { roughness: 1 }), 0, h, 0);
      for (const s of [-1, 1]) tube(g, [[-w * 0.3, 0, s * d * 0.45], [w * 0.15, h - 0.03, -s * d * 0.3]], 0.01, '#c0c4c6', METAL);
      box(g, 0.24, 0.07, 0.11, '#3f6fb0', -w * 0.25, h, 0, { roughness: 0.3 });
      box(g, 0.12, 0.05, 0.03, '#2b2b2b', -w * 0.25, h + 0.07, 0);
    },
    vacuum(g, w, d, h, c) {
      box(g, w, 0.05, 0.08, '#2b2b2b', 0, 0, d * 0.2);
      tube(g, [[0, 0.05, d * 0.15], [0, h * 0.6, 0], [0, h - 0.05, -d * 0.1]], 0.012, '#c0c4c6', METAL);
      cyl(g, 0.06, 0.06, 0.28, c, 0, h * 0.5, 0.02, { roughness: 0.3 });
      box(g, 0.04, 0.12, 0.03, '#2b2b2b', 0, h - 0.12, -d * 0.12);
    },
    boiler(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.4 });
      box(g, w * 0.7, 0.1, 0.01, '#3b3f45', 0, h * 0.08, d / 2 + 0.003);
      box(g, 0.08, 0.03, 0.005, '#7fc7c0', -w * 0.15, h * 0.12, d / 2 + 0.01, { emissive: '#7fc7c0', emissiveIntensity: 0.8 });
      for (let k = 0; k < 4; k++) cyl(g, 0.012, 0.012, 0.25, '#b08a3c', -w * 0.3 + k * w * 0.2, -0.25, 0, METAL, 8);
    },
    airConditioner(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.4 });
      box(g, w - 0.04, 0.04, 0.01, '#d9d6cf', 0, 0.03, d / 2 + 0.003);
      box(g, 0.05, 0.012, 0.005, '#7fc7c0', w * 0.35, h * 0.55, d / 2 + 0.005, { emissive: '#7fc7c0', emissiveIntensity: 1 });
    },
    ceilingFan(g, w, d, h, c) {
      cyl(g, 0.07, 0.07, 0.03, c, 0, h - 0.03, 0, METAL);
      cyl(g, 0.012, 0.012, h - 0.2, c, 0, 0.17, 0, METAL, 8);
      cyl(g, 0.09, 0.07, 0.1, c, 0, 0.08, 0, METAL);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const blade = box(g, w / 2 - 0.06, 0.01, 0.12, 'wood:walnut', 0, 0, 0);
        blade.position.set(Math.cos(a) * (w / 4 + 0.03), 0.12, Math.sin(a) * (w / 4 + 0.03));
        blade.rotation.y = -a;
      }
      ball(g, 0.07, '#fff3d6', 0, 0.05, 0, { emissive: '#ffe6b0', emissiveIntensity: 1.4 }).scale.y = 0.7;
    },
    standFan(g, w, d, h, c) {
      cyl(g, w * 0.4, w * 0.45, 0.03, c, 0, 0, 0);
      cyl(g, 0.015, 0.015, h - 0.25, c, 0, 0.03, 0, METAL, 8);
      const head = new THREE.Group();
      head.position.set(0, h - 0.2, 0);
      g.add(head);
      const cage = add(head, new THREE.TorusGeometry(0.19, 0.006, 6, 32), mat(c, METAL));
      cage.castShadow = false;
      for (let k = 0; k < 3; k++) { const b = box(head, 0.06, 0.16, 0.01, '#cfe8f2', 0, 0, 0.01, { transparent: true, opacity: 0.6 }); b.geometry.translate(0, 0.08, 0); b.rotation.z = (k / 3) * Math.PI * 2; b.position.y = 0; }
      cyl(head, 0.06, 0.06, 0.12, c, 0, -0.06, -0.08).rotation.x = Math.PI / 2;
    },

    // ---------- office ----------
    lDesk(g, w, d, h, c) {
      const depth = 0.7;
      box(g, w, 0.03, depth, c, 0, h - 0.03, -d / 2 + depth / 2);
      box(g, depth, 0.03, d - depth, c, w / 2 - depth / 2, h - 0.03, depth / 2);
      for (const [x, z] of [[-w / 2 + 0.03, -d / 2 + 0.03], [-w / 2 + 0.03, -d / 2 + depth - 0.03], [w / 2 - 0.03, d / 2 - 0.03], [w / 2 - depth + 0.03, d / 2 - 0.03], [w / 2 - 0.03, -d / 2 + 0.03]]) box(g, 0.04, h - 0.03, 0.04, '#2b2b2b', x, 0, z, METAL);
    },
    filingCabinet(g, w, d, h, c) {
      box(g, w, h - 0.05, d, c, 0, 0.05, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.02, 0.02, 0.05, '#2b2b2b', sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.05), {}, 10);
      const n = 3, fh = (h - 0.05) / n;
      for (let k = 0; k < n; k++) { box(g, w - 0.01, 0.004, 0.004, DARK, 0, 0.05 + k * fh, d / 2 + 0.002); box(g, 0.1, 0.015, 0.02, '#9a9a9a', 0, 0.05 + k * fh + fh - 0.05, d / 2 + 0.01, METAL); }
    },
    printer(g, w, d, h, c) {
      box(g, w, h * 0.8, d, c, 0, 0, 0, { roughness: 0.4 });
      box(g, w * 0.7, 0.01, d * 0.4, '#ffffff', 0, h * 0.8, -d * 0.1).rotation.x = -0.15;
      box(g, w * 0.6, 0.005, d * 0.3, '#ffffff', 0, h * 0.35, d / 2 + 0.05);
      box(g, 0.06, 0.02, 0.005, '#7fc7c0', w * 0.3, h * 0.6, d / 2 + 0.003, { emissive: '#7fc7c0', emissiveIntensity: 0.8 });
    },
    // Cork board with notes and photos.
    pinBoard(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      box(g, w, h, d * 0.6, c, 0, 0, -d / 2 + d * 0.3);
      box(g, w - 0.04, h - 0.04, 0.004, '#b98c5e', 0, 0.02, -d / 2 + d * 0.6 + 0.002, { roughness: 1 });
      for (let k = 0; k < 7; k++) {
        const n = box(g, 0.08 + r() * 0.06, 0.08 + r() * 0.05, 0.002, ['#f2e3b3', '#ffffff', '#e8b7a8', '#9fb8c8'][k % 4], (r() - 0.5) * (w - 0.2), 0.06 + r() * (h - 0.2), -d / 2 + d * 0.6 + 0.006);
        n.rotation.z = (r() - 0.5) * 0.3;
        ball(g, 0.007, '#d94a3a', n.position.x, n.position.y + 0.04, n.position.z + 0.004);
      }
    },

    // ---------- sport and games ----------
    treadmill(g, w, d, h, c) {
      box(g, w * 0.8, 0.12, d, '#2b2b2b', 0, 0, 0);
      box(g, w * 0.62, 0.01, d - 0.3, '#3b3f45', 0, 0.12, 0.05, { roughness: 1 });
      for (const s of [-1, 1]) tube(g, [[s * w * 0.4, 0.12, -d / 2 + 0.2], [s * w * 0.42, h - 0.15, -d / 2 + 0.1]], 0.02, c, METAL);
      box(g, w, 0.18, 0.12, c, 0, h - 0.18, -d / 2 + 0.08, { roughness: 0.4 });
      box(g, w * 0.4, 0.1, 0.005, '#1d1d1f', 0, h - 0.14, -d / 2 + 0.141, { emissive: '#3fb8a9', emissiveIntensity: 0.4 });
    },
    exerciseBike(g, w, d, h, c) {
      box(g, w * 0.9, 0.05, 0.08, '#2b2b2b', 0, 0, -d * 0.4);
      box(g, w * 0.9, 0.05, 0.08, '#2b2b2b', 0, 0, d * 0.4);
      tube(g, [[0, 0.05, d * 0.35], [0, 0.55, 0.05], [0, 0.85, -0.05]], 0.03, c, METAL);
      tube(g, [[0, 0.05, -d * 0.35], [0, 0.45, -0.1], [0, h - 0.15, -d * 0.3]], 0.03, c, METAL);
      disc(g, 0.22, 0.05, '#3b3f45', 0, 0.3, -d * 0.2, METAL).rotation.set(0, 0, Math.PI / 2);
      box(g, 0.2, 0.05, 0.28, '#2b2b2b', 0, 0.88, 0);
      box(g, w * 0.7, 0.03, 0.03, '#2b2b2b', 0, h - 0.12, -d * 0.32);
    },
    dumbbells(g, w, d, h, c) {
      for (const s of [-1, 1]) box(g, 0.04, h, d * 0.6, '#2b2b2b', s * (w / 2 - 0.02), 0, 0, METAL);
      for (const [y, z] of [[h * 0.45, d * 0.12], [h - 0.05, -d * 0.1]]) {
        box(g, w, 0.025, d * 0.35, '#2b2b2b', 0, y - 0.025, z, METAL);
        for (let k = 0; k < 3; k++) {
          const x = -w / 2 + 0.12 + k * (w - 0.24) / 2;
          const bar = cyl(g, 0.012, 0.012, 0.16, '#c0c4c6', 0, 0, 0, METAL, 8);
          bar.rotation.z = Math.PI / 2; bar.position.set(x, y + 0.04, z);
          for (const e of [-1, 1]) { const p = cyl(g, 0.035 - k * 0.004, 0.035 - k * 0.004, 0.04, c, 0, 0, 0, { roughness: 0.5 }, 6); p.rotation.z = Math.PI / 2; p.position.set(x + e * 0.07, y + 0.04, z); }
        }
      }
    },
    poolTable(g, w, d, h, c) {
      box(g, w, 0.18, d, 'wood:walnut', 0, h - 0.18, 0);
      box(g, w - 0.16, 0.01, d - 0.16, c, 0, h, 0, { roughness: 1 });
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) disc(g, 0.04, 0.012, '#1d1d1f', sx * (w / 2 - 0.08), h + 0.002, sz * (d / 2 - 0.08)).rotation.x = 0;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.12, h - 0.18, 0.12, 'wood:walnut', sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.15));
      const cols = ['#f2c14e', '#3f6fb0', '#d94a3a', '#8c6bb1', '#e8873c', '#2f6b4f', '#7a2a2a', '#1d1d1f'];
      cols.forEach((col, k) => ball(g, 0.028, col, (k % 4 - 1.5) * 0.06, h + 0.028, d * 0.2 + Math.floor(k / 4) * 0.055, { roughness: 0.2 }));
      ball(g, 0.028, '#fbfaf7', 0, h + 0.028, -d * 0.25, { roughness: 0.2 });
      const cue = cyl(g, 0.008, 0.014, 1.45, 'wood:oak', 0, 0, 0, {}, 8);
      cue.rotation.x = Math.PI / 2; cue.position.set(w * 0.25, h + 0.03, 0);
    },
    pingPong(g, w, d, h, c) {
      box(g, w, 0.03, d, c, 0, h - 0.03, 0, { roughness: 0.6 });
      box(g, 0.01, 0.002, d, '#ffffff', 0, h, 0);
      box(g, w, 0.002, 0.02, '#ffffff', 0, h, d / 2 - 0.01);
      box(g, w, 0.002, 0.02, '#ffffff', 0, h, -d / 2 + 0.01);
      box(g, w + 0.1, 0.15, 0.01, '#f4f3ef', 0, h, 0, { transparent: true, opacity: 0.6 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.04, h - 0.03, 0.04, '#2b2b2b', sx * (w / 2 - 0.15), 0, sz * (d / 2 - 0.3), METAL);
    },
    dartboard(g, w, d, h, c) {
      const r = Math.min(w, h) / 2, y = h / 2, z = -d / 2;
      disc(g, r, d * 0.6, '#1d1d1f', 0, y, z + d * 0.3);
      [[0.95, '#e9d9b5'], [0.62, '#1d1d1f'], [0.58, '#e9d9b5'], [0.15, '#2f6b4f'], [0.07, '#c0392b']].forEach(([k, col], i) => disc(g, r * k * 0.85, 0.004, col, 0, y, z + d * 0.61 + i * 0.002));
      for (let k = 0; k < 3; k++) { const dart = cyl(g, 0.003, 0.006, 0.12, '#c0c4c6', 0, 0, 0, METAL, 6); dart.rotation.x = Math.PI / 2; dart.position.set((k - 1) * 0.04, y + 0.03 - k * 0.02, z + d + 0.05); }
    },
    gameConsole(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.3 });
      box(g, w * 0.5, 0.003, 0.004, '#3fb8a9', 0, h * 0.5, d / 2 + 0.002, { emissive: '#3fb8a9', emissiveIntensity: 1.2 });
      const pad = ball(g, 0.05, '#2b2b2b', w * 0.7, 0.02, d * 0.2);
      pad.scale.set(1.4, 0.4, 0.9);
    },
    bike(g, w, d, h, c) {
      const wr = 0.34, zf = d / 2 - wr - 0.02, zb = -d / 2 + wr + 0.02;
      for (const z of [zf, zb]) {
        const t = add(g, new THREE.TorusGeometry(wr, 0.02, 8, 32), mat('#1d1d1f'), 0, wr + 0.02, z);
        t.rotation.y = Math.PI / 2;
        for (let k = 0; k < 6; k++) box(g, 0.003, wr * 2, 0.003, '#c0c4c6', 0, 0.02, z, METAL).rotation.x = (k / 6) * Math.PI; // spokes
      }
      const bb = [0, wr * 0.9, -0.05], seat = [0, h - 0.12, zb + 0.25], head = [0, h - 0.08, zf - 0.15];
      tube(g, [[0, wr + 0.02, zb], bb], 0.014, c, METAL);
      tube(g, [bb, seat], 0.016, c, METAL);
      tube(g, [seat, head], 0.016, c, METAL);
      tube(g, [bb, head], 0.018, c, METAL);
      tube(g, [head, [0, wr + 0.02, zf]], 0.014, c, METAL);
      tube(g, [[0, wr + 0.02, zb], seat], 0.012, c, METAL);
      box(g, 0.1, 0.04, 0.25, '#2b2b2b', 0, h - 0.1, zb + 0.25);
      const bar = cyl(g, 0.012, 0.012, w * 0.9, '#2b2b2b', 0, 0, 0, METAL, 8);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, h, zf - 0.18);
    },

    // ---------- stairs ----------
    // Straight stairs climbing from the front (+z) to the back.
    stairs(g, w, d, h, c) {
      const n = Math.max(3, Math.round(h / 0.18)), rise = h / n, run = d / n;
      for (let k = 0; k < n; k++) {
        const z = d / 2 - run * (k + 0.5);
        box(g, w, 0.04, run + 0.02, c, 0, rise * (k + 1) - 0.04, z);
        box(g, w - 0.02, rise - 0.04, 0.015, shade(c, 0.12), 0, rise * k, z + run / 2 - 0.01);
      }
      for (const s of [-1, 1]) {
        const stringer = box(g, 0.05, Math.hypot(h, d), 0.25, shade(c, -0.15), 0, 0, 0);
        stringer.rotation.x = Math.atan2(d, h);
        stringer.position.set(s * (w / 2 + 0.025), h / 2 - 0.1, 0);
      }
      tube(g, [[w / 2 + 0.03, 0.95, d / 2 - 0.05], [w / 2 + 0.03, h + 0.9, -d / 2 + 0.05]], 0.022, '#2b2b2b', METAL);
      for (let k = 0; k < n; k += 2) cyl(g, 0.008, 0.008, 0.9, '#2b2b2b', w / 2 + 0.03, rise * (k + 1), d / 2 - run * (k + 0.5), METAL, 6);
    },
    spiralStairs(g, w, d, h, c) {
      const R = Math.min(w, d) / 2, n = Math.max(8, Math.round(h / 0.2)), rise = h / n, step = (Math.PI * 2 * 0.85) / n;
      cyl(g, 0.05, 0.05, h + 0.9, '#2b2b2b', 0, 0, 0, METAL, 12);
      const tread = new THREE.Shape();
      tread.moveTo(0, 0);
      tread.absarc(0, 0, R, -step / 2 - 0.02, step / 2 + 0.02, false);
      tread.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(tread, { depth: 0.04, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const rail = [];
      for (let k = 0; k < n; k++) {
        const a = k * step, y = rise * (k + 1) - 0.04;
        const t = add(g, geo, mat(c, { roughness: 0.6 }), 0, y, 0);
        t.rotation.y = a;
        const px = Math.cos(a) * (R - 0.04), pz = -Math.sin(a) * (R - 0.04);
        cyl(g, 0.008, 0.008, 0.9, '#2b2b2b', px, y + 0.04, pz, METAL, 6);
        rail.push([px, y + 0.94, pz]);
      }
      tube(g, rail, 0.018, '#2b2b2b', METAL);
    },

    // ---------- more garden ----------
    hammock(g, w, d, h, c) {
      const pts = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push([-w / 2 + t * w, 0.08 + Math.sin(Math.PI * t) * 0.02 + (1 - Math.sin(Math.PI * t)) * (h - 0.1), 0]); }
      for (const s of [-1, 1]) tube(g, pts.map(([x, y]) => [x, y, s * d * 0.45]), 0.03, 'wood:walnut');
      // The cloth: a few sagging bands side by side.
      const sag = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16; sag.push([-w * 0.38 + t * w * 0.76, h * 0.95 - Math.sin(Math.PI * t) * h * 0.55, 0]); }
      for (let k = -3; k <= 3; k++) tube(g, sag.map(([x, y, z]) => [x, y - (1 - Math.abs(k) / 4) * 0.04 * Math.sin(Math.PI * ((x + w * 0.38) / (w * 0.76))), z + k * d * 0.09]), 0.03, k % 2 ? c : shade(c, -0.1), { roughness: 1 });
    },
    swing(g, w, d, h, c) {
      for (const s of [-1, 1]) for (const z of [-1, 1]) tube(g, [[s * (w / 2 - 0.05), 0, z * d * 0.45], [s * (w / 2 - 0.1), h, 0]], 0.04, 'wood:oak');
      const beam = cyl(g, 0.05, 0.05, w, 'wood:oak', 0, 0, 0, {}, 10);
      beam.rotation.z = Math.PI / 2; beam.position.set(0, h, 0);
      for (const x of [-w * 0.22, w * 0.22]) {
        for (const s of [-1, 1]) tube(g, [[x + s * 0.2, h, 0], [x + s * 0.2, 0.45, 0]], 0.006, '#9a9a9a', METAL);
        box(g, 0.45, 0.04, 0.2, c, x, 0.43, 0);
      }
    },
    trampoline(g, w, d, h, c) {
      const R = Math.min(w, d) / 2, mh = h * 0.35;
      const ring = add(g, new THREE.TorusGeometry(R, 0.08, 8, 48), mat(c, { roughness: 0.8 }), 0, mh, 0);
      ring.rotation.x = Math.PI / 2;
      cyl(g, R - 0.08, R - 0.08, 0.01, '#1d1d1f', 0, mh - 0.01, 0, { roughness: 1 }, 48);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        tube(g, [[Math.cos(a) * R, 0, Math.sin(a) * R], [Math.cos(a) * R, mh, Math.sin(a) * R]], 0.025, '#5b5f63', METAL);
        tube(g, [[Math.cos(a) * R, mh, Math.sin(a) * R], [Math.cos(a) * R, h, Math.sin(a) * R]], 0.02, c);
      }
      const net = add(g, new THREE.CylinderGeometry(R, R, h - mh, 48, 1, true), mat('#2b2b2b', { transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }), 0, mh + (h - mh) / 2, 0);
      net.castShadow = false;
    },
    // Family car: body, cabin with windows, wheels.
    car(g, w, d, h, c) {
      const bodyH = h * 0.45, clear = 0.18;
      const body = new THREE.Shape();
      body.moveTo(-d / 2, clear); body.lineTo(d / 2 - 0.15, clear); body.quadraticCurveTo(d / 2, clear, d / 2, clear + 0.2);
      body.lineTo(d / 2 - 0.05, clear + bodyH); body.lineTo(-d / 2 + 0.1, clear + bodyH); body.quadraticCurveTo(-d / 2, clear + bodyH, -d / 2, clear + bodyH - 0.15); body.closePath();
      const bgeo = new THREE.ExtrudeGeometry(body, { depth: w - 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
      bgeo.translate(0, 0, -(w - 0.06) / 2);
      bgeo.rotateY(-Math.PI / 2);
      add(g, bgeo, mat(c, { roughness: 0.25, metalness: 0.4 }));
      const top = clear + bodyH, cabin = new THREE.Shape();
      cabin.moveTo(-d * 0.3, top); cabin.lineTo(d * 0.22, top); cabin.lineTo(d * 0.08, h); cabin.lineTo(-d * 0.22, h); cabin.closePath();
      const cgeo = new THREE.ExtrudeGeometry(cabin, { depth: w - 0.2, bevelEnabled: false });
      cgeo.translate(0, 0, -(w - 0.2) / 2);
      cgeo.rotateY(-Math.PI / 2);
      add(g, cgeo, [mat(c, { roughness: 0.25, metalness: 0.4 }), mat('#2a3440', { roughness: 0.1, metalness: 0.3 })]);
      for (const z of [d / 2 - 0.7, -d / 2 + 0.65]) for (const s of [-1, 1]) {
        const wh = cyl(g, 0.31, 0.31, 0.2, '#1d1d1f', 0, 0, 0, { roughness: 0.8 }, 24);
        wh.rotation.z = Math.PI / 2; wh.position.set(s * (w / 2 - 0.1), 0.31, z);
        const rim = cyl(g, 0.17, 0.17, 0.21, '#c0c4c6', 0, 0, 0, METAL, 16);
        rim.rotation.z = Math.PI / 2; rim.position.set(s * (w / 2 - 0.1), 0.31, z);
      }
      for (const s of [-1, 1]) {
        box(g, 0.22, 0.08, 0.02, '#fff3d6', s * (w / 2 - 0.25), clear + bodyH - 0.2, d / 2 - 0.01, { emissive: '#fff3d6', emissiveIntensity: 0.6 });
        box(g, 0.22, 0.07, 0.02, '#c0392b', s * (w / 2 - 0.25), clear + bodyH - 0.15, -d / 2 + 0.01, { emissive: '#c0392b', emissiveIntensity: 0.4 });
      }
    },
    fountain(g, w, d, h, c) {
      const R = Math.min(w, d) / 2;
      add(g, new THREE.CylinderGeometry(R, R, 0.4, 32, 1, true), mat(c, { side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.2, 0);
      const rim = add(g, new THREE.TorusGeometry(R, 0.05, 8, 32), mat(c, { roughness: 0.9 }), 0, 0.4, 0);
      rim.rotation.x = Math.PI / 2;
      cyl(g, R - 0.02, R - 0.02, 0.01, '#5aa7c4', 0, 0.32, 0, { roughness: 0.05, transparent: true, opacity: 0.85 }, 32);
      cyl(g, 0.08, 0.12, h - 0.35, c, 0, 0.32, 0, { roughness: 0.9 }, 16);
      add(g, new THREE.SphereGeometry(R * 0.45, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(c, { side: THREE.DoubleSide, roughness: 0.9 }), 0, h * 0.75, 0);
      cyl(g, R * 0.42, R * 0.42, 0.01, '#5aa7c4', 0, h * 0.74, 0, { roughness: 0.05 }, 24);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        tube(g, [[Math.cos(a) * R * 0.42, h * 0.75, Math.sin(a) * R * 0.42], [Math.cos(a) * R * 0.7, h * 0.55, Math.sin(a) * R * 0.7], [Math.cos(a) * R * 0.85, 0.34, Math.sin(a) * R * 0.85]], 0.008, '#bfe6f2', { transparent: true, opacity: 0.6 });
      }
      ball(g, 0.05, c, 0, h, 0);
    },
    firePit(g, w, d, h, c) {
      const R = Math.min(w, d) / 2;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const s = box(g, R * 0.5, h, 0.12, c, Math.cos(a) * (R - 0.06), 0, Math.sin(a) * (R - 0.06), { roughness: 1 });
        s.rotation.y = -a + Math.PI / 2;
      }
      cyl(g, R - 0.1, R - 0.1, 0.05, '#2b2b2b', 0, 0, 0, {}, 24);
      for (let k = 0; k < 3; k++) { const l = cyl(g, 0.04, 0.04, R, '#6e4b33', 0, 0, 0, {}, 8); l.rotation.z = Math.PI / 2; l.rotation.y = (k / 3) * Math.PI; l.position.y = 0.1; }
      for (let k = 0; k < 6; k++) add(g, new THREE.ConeGeometry(0.06, 0.25 + (k % 3) * 0.1, 8), glow(k % 2 ? '#ffb347' : '#ff7b2e', 2.4), Math.cos(k) * 0.08, 0.25, Math.sin(k) * 0.08).castShadow = false;
    },
    // Venetian blind over a window.
    blind(g, w, d, h, c) {
      box(g, w, 0.05, d, c, 0, h - 0.05, 0);
      for (let y = 0.02; y < h - 0.06; y += 0.025) { const s = box(g, w - 0.02, 0.002, d * 0.7, c, 0, y, 0.005); s.rotation.x = 0.5; s.castShadow = false; }
      for (const x of [-w * 0.3, w * 0.3]) box(g, 0.004, h - 0.05, 0.004, '#d9d6cf', x, 0, d * 0.2);
      box(g, w - 0.02, 0.02, d * 0.8, c, 0, 0, 0);
    },

    // ---------- plants ----------
    flowers(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      cyl(g, w * 0.3, w * 0.22, h * 0.4, c, 0, 0, 0, { roughness: 0.2 });
      const cols = ['#e8b7a8', '#f2c14e', '#ffffff', '#c56b45', '#9b5c7a'];
      for (let k = 0; k < 9; k++) {
        const x = (r() - 0.5) * w * 0.6, z = (r() - 0.5) * d * 0.6, top = h * (0.75 + r() * 0.25);
        tube(g, [[0, h * 0.3, 0], [x * 0.5, h * 0.6, z * 0.5], [x, top, z]], 0.003, '#4f7f3f');
        ball(g, 0.025 + r() * 0.015, cols[Math.floor(r() * cols.length)], x, top, z, { roughness: 0.9 });
      }
    },
    monstera(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      pot(g, w * 0.5, h * 0.25, c);
      for (let k = 0; k < 9; k++) {
        const yaw = (k / 9) * Math.PI * 2 + r() * 0.4;
        leaf(g, 0, h * 0.22, 0, h * (0.45 + r() * 0.3), w * 0.32, yaw, 0.5 + r() * 0.5, GREEN[k % 3]);
      }
    },
    snakePlant(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      box(g, w * 0.7, h * 0.22, d * 0.7, c, 0, 0, 0);
      for (let k = 0; k < 11; k++) {
        const x = (r() - 0.5) * w * 0.45, z = (r() - 0.5) * d * 0.45, len = h * (0.5 + r() * 0.3);
        const p = leaf(g, x, h * 0.2, z, len, 0.06, r() * Math.PI, (r() - 0.5) * 0.25, k % 2 ? '#2f5a2c' : '#4a6b2f');
        p.children[0].children[0].rotation.x = 0;
      }
    },
    cactus(g, w, d, h, c) {
      pot(g, w * 0.7, h * 0.22, c);
      const col = '#5f8f4a', top = h - 0.04;
      cyl(g, w * 0.16, w * 0.18, top - h * 0.2, col, 0, h * 0.2, 0, {}, 12);
      ball(g, w * 0.16, col, 0, top, 0);
      for (const s of [-1, 1]) {
        const y = h * (s > 0 ? 0.5 : 0.62), x = s * w * 0.28;
        tube(g, [[0, y, 0], [x * 0.8, y, 0], [x, y + 0.05, 0], [x, y + h * 0.18, 0]], w * 0.09, col);
        ball(g, w * 0.09, col, x, y + h * 0.18, 0);
      }
    },
    succulents(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      cyl(g, w * 0.5, w * 0.42, h * 0.45, c, 0, 0, 0);
      for (let k = 0; k < 6; k++) {
        const x = (r() - 0.5) * w * 0.6, z = (r() - 0.5) * d * 0.6;
        for (let p = 0; p < 7; p++) leaf(g, x, h * 0.45, z, 0.035 + r() * 0.02, 0.025, (p / 7) * Math.PI * 2, 1.0, k % 2 ? '#8fb08a' : '#a7b98a');
      }
    },
    palm(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      pot(g, w * 0.5, h * 0.2, c);
      for (let k = 0; k < 7; k++) {
        const yaw = (k / 7) * Math.PI * 2 + r(), lean = 0.25 + r() * 0.3, len = h * (0.55 + r() * 0.3);
        const x = Math.sin(yaw) * Math.sin(lean) * len, z = Math.cos(yaw) * Math.sin(lean) * len, y = h * 0.18 + Math.cos(lean) * len;
        tube(g, [[0, h * 0.18, 0], [x * 0.5, h * 0.18 + (y - h * 0.18) * 0.6, z * 0.5], [x, y, z]], 0.006, '#6b8f48');
        for (let f = 0; f < 6; f++) {
          const t = 0.35 + f * 0.11;
          leaf(g, x * t, h * 0.18 + (y - h * 0.18) * t, z * t, w * 0.28, 0.035, yaw + 1.4, 1.5, GREEN[f % 3]);
          leaf(g, x * t, h * 0.18 + (y - h * 0.18) * t, z * t, w * 0.28, 0.035, yaw - 1.4, 1.5, GREEN[(f + 1) % 3]);
        }
      }
    },
    fern(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      pot(g, w * 0.5, h * 0.4, c);
      for (let k = 0; k < 16; k++) leaf(g, 0, h * 0.38, 0, w * (0.45 + r() * 0.15), 0.08, (k / 16) * Math.PI * 2 + r() * 0.3, 1.0 + r() * 0.6, GREEN[k % 4]);
    },
    // Small indoor tree: ficus lyrata (big leaves) or olive (silvery crown).
    indoorTree(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      pot(g, w * 0.55, h * 0.18, c);
      const olive = def(it).leaf === 'olive';
      cyl(g, 0.018, 0.028, h * 0.55, '#6e5a46', 0, h * 0.16, 0, {}, 8);
      if (olive) {
        for (let k = 0; k < 9; k++) blob(g, w * (0.16 + r() * 0.08), k % 2 ? '#8a9a6b' : '#76875c', (r() - 0.5) * w * 0.55, h * (0.65 + r() * 0.28), (r() - 0.5) * d * 0.55);
        return;
      }
      for (let k = 0; k < 16; k++) {
        const y = h * (0.45 + r() * 0.5), yaw = r() * Math.PI * 2;
        leaf(g, Math.sin(yaw) * 0.03, y, Math.cos(yaw) * 0.03, 0.22 + r() * 0.08, 0.17, yaw, 0.9 + r() * 0.5, GREEN[k % 4]);
      }
    },
    bonsai(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      box(g, w * 0.8, h * 0.15, d * 0.6, c, 0, 0, 0);
      tube(g, [[0, h * 0.15, 0], [w * 0.1, h * 0.35, 0], [-w * 0.05, h * 0.55, 0.02], [w * 0.15, h * 0.7, 0]], 0.012, '#6e5a46');
      for (let k = 0; k < 5; k++) blob(g, w * (0.1 + r() * 0.06), GREEN[k % 4], (r() - 0.4) * w * 0.6, h * (0.65 + r() * 0.25), (r() - 0.5) * d * 0.4);
    },
    // Pot hanging from the ceiling with trailing stems.
    hangingPlant(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const py = h * 0.45;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        tube(g, [[0, h, 0], [Math.cos(a) * w * 0.25, py + 0.16, Math.sin(a) * w * 0.25]], 0.002, '#c9b48a');
      }
      cyl(g, w * 0.25, w * 0.2, 0.16, c, 0, py, 0);
      for (let k = 0; k < 7; k++) {
        const a = r() * Math.PI * 2, rr = w * 0.22, len = py * (0.5 + r() * 0.5);
        const pts = [[Math.cos(a) * rr, py + 0.15, Math.sin(a) * rr], [Math.cos(a) * rr * 1.5, py, Math.sin(a) * rr * 1.5], [Math.cos(a) * rr * 1.3, py + 0.15 - len, Math.sin(a) * rr * 1.3]];
        tube(g, pts, 0.003, '#4f7f3f');
        for (let f = 1; f < 6; f++) {
          const t = f / 6;
          leaf(g, pts[0][0] + (pts[2][0] - pts[0][0]) * t, pts[0][1] + (pts[2][1] - pts[0][1]) * t, pts[0][2] + (pts[2][2] - pts[0][2]) * t, 0.06, 0.05, a + f, 1.6, GREEN[f % 4]);
        }
      }
      for (let k = 0; k < 4; k++) blob(g, w * 0.12, GREEN[k], (r() - 0.5) * w * 0.25, py + 0.18, (r() - 0.5) * w * 0.25);
    },

    // ---------- tech ----------
    pc(g, w, d, h, c, it) {
      const zb = -d / 2 + 0.07, sw = w * 0.92, sh = h * 0.68;
      box(g, 0.22, 0.012, 0.16, c, 0, 0, zb);
      box(g, 0.04, h * 0.3, 0.025, c, 0, 0.012, zb - 0.03);
      box(g, sw, sh, 0.03, c, 0, h - sh, zb);
      plane(g, sw - 0.02, sh - 0.025, texMat(artTexture('screen', seedOf(it)), { emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.3 }), 0, h - sh + 0.018, zb + 0.016);
      box(g, Math.min(0.44, w * 0.75), 0.02, 0.14, '#e9e9e9', 0, 0, d / 2 - 0.09);
      box(g, 0.06, 0.02, 0.1, '#e9e9e9', Math.min(0.3, w * 0.45), 0, d / 2 - 0.08);
    },
    pcTower(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.4 });
      box(g, 0.004, h * 0.8, d * 0.7, '#7fc7c0', w / 2 + 0.002, h * 0.1, 0, { emissive: '#7fc7c0', emissiveIntensity: 0.8 });
      disc(g, 0.012, 0.006, '#dfe7ea', 0, h - 0.04, d / 2, { emissive: '#7fc7c0', emissiveIntensity: 1 });
    },
    laptop(g, w, d, h, c, it) {
      box(g, w, 0.016, d, c, 0, 0, 0, METAL);
      box(g, w * 0.8, 0.002, d * 0.4, '#3b3f45', 0, 0.016, -0.02);
      const lid = new THREE.Group();
      lid.position.set(0, 0.016, -d / 2);
      lid.rotation.x = -0.3;
      g.add(lid);
      box(lid, w, d, 0.008, c, 0, 0, 0, METAL);
      plane(lid, w - 0.025, d - 0.03, texMat(artTexture('screen', seedOf(it) + 3), { emissive: '#ffffff', emissiveIntensity: 0.55 }), 0, 0.015, 0.0045);
    },
    tvWall(g, w, d, h, c) {
      box(g, w, h, d * 0.6, c, 0, 0, -d / 2 + d * 0.3, { roughness: 0.3 });
      box(g, w - 0.02, h - 0.02, 0.002, '#0d0f12', 0, 0.01, -d / 2 + d * 0.6 + 0.001, { roughness: 0.15, metalness: 0.2 });
    },

    // ---------- music ----------
    guitarWall(g, w, d, h, c, it) {
      box(g, 0.05, 0.03, d * 0.8, DARK, 0, h * 0.86, -d / 2 + d * 0.4);
      const gt = guitar(c, h * 0.98, def(it).electric);
      gt.position.set(0, 0, -d / 2 + 0.07);
      g.add(gt);
    },
    guitarStand(g, w, d, h, c, it) {
      for (const s of [-1, 1]) tube(g, [[s * 0.15, 0, 0.12], [0, 0.6, -0.08]], 0.008, DARK, METAL);
      tube(g, [[0, 0, -0.18], [0, 0.6, -0.08]], 0.008, DARK, METAL);
      box(g, 0.32, 0.03, 0.06, DARK, 0, 0.12, 0.1);
      const gt = guitar(c, h * 0.97, def(it).electric);
      gt.position.set(0, 0.11, 0.08);
      gt.rotation.x = -0.18;
      g.add(gt);
    },
    pianoDigital(g, w, d, h, c) {
      const top = h - 0.12;
      for (const s of [-1, 1]) {
        const x = s * (w / 2 - 0.2);
        for (const k of [-1, 1]) {
          const leg = box(g, 0.03, Math.hypot(top, d * 0.8), 0.03, c, x, 0, 0, METAL);
          leg.position.y = top / 2;
          leg.rotation.x = k * Math.atan2(d * 0.8, top);
        }
      }
      box(g, w, 0.12, d, c, 0, top, 0, { roughness: 0.4 });
      const keys = plane(g, w - 0.08, d * 0.55, texMat(artTexture('keys'), { roughness: 0.4 }), 0, 0, 0);
      keys.rotation.x = -Math.PI / 2;
      keys.position.set(0, h + 0.001, d / 2 - d * 0.3);
    },
    pianoUpright(g, w, d, h, c) {
      const back = d * 0.62;
      box(g, w, h, back, c, 0, 0, -d / 2 + back / 2, { roughness: 0.25 });
      box(g, w, 0.05, d - back, c, 0, 0.68, d / 2 - (d - back) / 2, { roughness: 0.25 });
      for (const s of [-1, 1]) box(g, 0.06, 0.68, 0.06, c, s * (w / 2 - 0.05), 0, d / 2 - 0.05, { roughness: 0.25 });
      for (const s of [-1, 1]) box(g, 0.04, 0.12, d - back, c, s * (w / 2 - 0.02), 0.73, d / 2 - (d - back) / 2, { roughness: 0.25 });
      const k = plane(g, w - 0.1, d - back - 0.04, texMat(artTexture('keys'), { roughness: 0.4 }), 0, 0, 0);
      k.rotation.x = -Math.PI / 2;
      k.position.set(0, 0.731, d / 2 - (d - back) / 2 + 0.01);
      box(g, w - 0.1, 0.2, 0.02, c, 0, 0.78, -d / 2 + back + 0.01, { roughness: 0.25 });
      for (const s of [-1, 1]) box(g, 0.05, 0.03, 0.05, '#c9a24a', s * 0.07, 0.02, d / 2 - 0.12, METAL);
    },
    drums(g, w, d, h, c) {
      const shell = (r, depth, x, y, z, horizontal) => {
        const o = add(g, new THREE.CylinderGeometry(r, r, depth, 28), [mat(c, { roughness: 0.3 }), mat('#f4f3ef', { roughness: 0.8 }), mat('#f4f3ef', { roughness: 0.8 })], x, y, z);
        if (horizontal) o.rotation.x = Math.PI / 2;
        return o;
      };
      const stand = (x, z, top) => cyl(g, 0.008, 0.008, top, '#c0c4c6', x, 0, z, METAL, 8);
      const cymbal = (r, x, y, z, tilt = 0.15) => { const o = add(g, new THREE.CylinderGeometry(r * 0.15, r, 0.015, 32), mat('#c9a24a', METAL), x, y, z); o.rotation.z = tilt; };
      shell(0.27, 0.4, 0, 0.27, -d / 2 + 0.35, true);
      shell(0.13, 0.12, -0.15, 0.73, -d / 2 + 0.35);
      shell(0.14, 0.13, 0.15, 0.74, -d / 2 + 0.33);
      shell(0.2, 0.35, w / 2 - 0.3, 0.2, 0.05);
      stand(-0.32, 0.15, 0.5);
      shell(0.17, 0.12, -0.32, 0.5, 0.15);
      stand(-w / 2 + 0.2, 0, h - 0.25);
      cymbal(0.18, -w / 2 + 0.2, h - 0.25, 0, 0);
      cymbal(0.18, -w / 2 + 0.2, h - 0.27, 0, 0);
      stand(-0.45, -d / 2 + 0.15, h);
      cymbal(0.24, -0.45, h, -d / 2 + 0.15);
      stand(w / 2 - 0.2, -d / 2 + 0.2, h - 0.05);
      cymbal(0.28, w / 2 - 0.2, h - 0.05, -d / 2 + 0.2, -0.15);
      cyl(g, 0.17, 0.15, 0.05, DARK, 0, 0.5, d / 2 - 0.2);
      cyl(g, 0.02, 0.02, 0.5, '#c0c4c6', 0, 0, d / 2 - 0.2, METAL, 8);
    },
    amp(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.9 });
      box(g, w - 0.04, h * 0.6, 0.004, '#3a3a3a', 0, 0.03, d / 2 + 0.002, { roughness: 1 });
      box(g, w - 0.04, h * 0.22, 0.004, '#c0c4c6', 0, h * 0.72, d / 2 + 0.002, METAL);
      for (let k = 0; k < 5; k++) disc(g, 0.012, 0.02, DARK, -w / 2 + 0.07 + k * 0.06, h * 0.83, d / 2 + 0.01);
      box(g, w * 0.4, 0.02, 0.03, DARK, 0, h, 0);
    },

    // ---------- pets ----------
    petBed(g, w, d, h, c) {
      const base = add(g, new THREE.CylinderGeometry(0.5, 0.5, h * 0.4, 32), mat(shade(c, 0.12), { roughness: 1 }), 0, h * 0.2, 0);
      base.scale.set(w, 1, d);
      const rim = add(g, new THREE.TorusGeometry(0.42, 0.1, 12, 36), mat(c, { roughness: 1 }), 0, h * 0.45, 0);
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(w, d, h * 5);
    },
    catTree(g, w, d, h, c) {
      box(g, w, 0.03, d, c, 0, 0, 0);
      const sisal = '#c8b48a';
      cyl(g, 0.045, 0.045, h * 0.45, sisal, -w * 0.25, 0.03, -d * 0.2, { roughness: 1 }, 12);
      cyl(g, 0.045, 0.045, h - 0.06, sisal, w * 0.22, 0.03, d * 0.2, { roughness: 1 }, 12);
      box(g, w * 0.7, h * 0.22, d * 0.6, c, -w * 0.12, 0.03, -d * 0.15);
      disc(g, h * 0.06, 0.005, '#2b2b2b', -w * 0.12, 0.03 + h * 0.11, -d * 0.15 + d * 0.3 + 0.003);
      box(g, w * 0.6, 0.03, d * 0.55, c, -w * 0.15, h * 0.48, -d * 0.2);
      box(g, w * 0.55, 0.03, d * 0.55, c, w * 0.15, h * 0.75, d * 0.1);
      const bed = add(g, new THREE.CylinderGeometry(0.5, 0.45, 0.07, 24), mat(c), w * 0.18, h - 0.04, d * 0.18);
      bed.scale.set(w * 0.6, 1, d * 0.6);
      ball(g, 0.025, '#e8b7a8', w * 0.05, h * 0.75 - 0.08, d * 0.25);
    },
    bowls(g, w, d, h, c) {
      const m = box(g, w, 0.005, d, '#7d8a96', 0, 0, 0, { roughness: 1 });
      m.castShadow = false;
      for (const s of [-1, 1]) {
        cyl(g, 0.075, 0.055, h * 0.9, c, s * w * 0.25, 0.005, 0, METAL);
        cyl(g, 0.065, 0.065, 0.005, s > 0 ? '#9fc6e8' : '#8a5a3c', s * w * 0.25, h * 0.75, 0, s > 0 ? { roughness: 0.1 } : { roughness: 1 });
      }
    },
    litterBox(g, w, d, h, c) {
      box(g, w, h * 0.35, d, c, 0, 0, 0);
      box(g, w * 0.96, h * 0.62, d * 0.96, shade(c, 0.08), 0, h * 0.35, 0);
      disc(g, h * 0.22, 0.01, '#2b2b2b', 0, h * 0.55, d * 0.48 + 0.004);
    },
    dogHouse(g, w, d, h, c) {
      const wallH = h * 0.6;
      box(g, w, wallH, d, c, 0, 0, 0);
      const slope = Math.hypot(w / 2 + 0.06, h - wallH);
      for (const s of [-1, 1]) {
        const roof = box(g, slope, 0.03, d + 0.12, '#8b2f2f', 0, 0, 0);
        roof.position.set(s * (w / 4), wallH + (h - wallH) / 2, 0);
        roof.rotation.z = -s * Math.atan2(h - wallH, w / 2);
      }
      const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h - wallH)]);
      for (const z of [d / 2, -d / 2]) add(g, new THREE.ShapeGeometry(gable), mat(c, { side: THREE.DoubleSide }), 0, wallH, z);
      disc(g, w * 0.22, 0.01, '#1d1d1f', 0, wallH * 0.55, d / 2 + 0.003);
      box(g, w * 0.44, wallH * 0.55, 0.01, '#1d1d1f', 0, 0, d / 2 + 0.003);
    },
    aquarium(g, w, d, h, c) {
      const sh = h * 0.55, th = h - sh - 0.03;
      box(g, w, sh, d, c, 0, 0, 0);
      box(g, w, th, d, '#cfe8f2', 0, sh, 0, { transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
      box(g, w - 0.02, th * 0.85, d - 0.02, '#3fa7c9', 0, sh + 0.02, 0, { transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false });
      box(g, w - 0.02, 0.04, d - 0.02, '#c8b48a', 0, sh, 0);
      for (let k = 0; k < 6; k++) cyl(g, 0, 0.03, th * (0.4 + (k % 3) * 0.15), GREEN[k % 4], -w / 2 + 0.1 + k * (w - 0.2) / 5, sh + 0.04, (k % 2 ? -1 : 1) * d * 0.15, {}, 6);
      box(g, w, 0.03, d, DARK, 0, h - 0.03, 0);
      const fish = ['#f78154', '#f2c14e', '#7fc7c0'];
      fish.forEach((f, k) => ball(g, 0.02, f, -w * 0.2 + k * w * 0.2, sh + th * (0.4 + k * 0.15), 0, { emissive: f, emissiveIntensity: 0.3 }).scale.set(1.6, 1, 0.6));
    },

    // ---------- garden ----------
    tree(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const leafCol = def(it).leaf === 'olive' ? ['#8a9a6b', '#76875c'] : ['#4f7f3f', '#3d6b34', '#5f8f4a'];
      const trunkH = h * (def(it).leaf === 'olive' ? 0.35 : 0.45);
      cyl(g, w * 0.035, w * 0.055, trunkH + 0.2, c, 0, 0, 0, { roughness: 1 }, 10);
      for (let k = 0; k < 10; k++) {
        const a = r() * Math.PI * 2, rr = r() * w * 0.28;
        blob(g, w * (0.16 + r() * 0.1), leafCol[k % leafCol.length], Math.cos(a) * rr, trunkH + (h - trunkH) * (0.3 + r() * 0.5), Math.sin(a) * rr);
      }
    },
    cypress(g, w, d, h, c) {
      cyl(g, 0.05, 0.07, h * 0.12, c, 0, 0, 0, { roughness: 1 }, 8);
      add(g, new THREE.ConeGeometry(w / 2, h * 0.9, 10), mat('#2f5a2c', { flatShading: true, roughness: 1 }), 0, h * 0.55, 0);
    },
    bush(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      for (let k = 0; k < 6; k++) blob(g, Math.min(w, d) * (0.25 + r() * 0.1), k % 2 ? c : shade(c, -0.06), (r() - 0.5) * w * 0.45, h * (0.3 + r() * 0.35), (r() - 0.5) * d * 0.45);
    },
    // ---------- outside walls and railings ----------
    // Outdoor wall light: a lantern with glowing glass on a short bracket.
    outdoorWallLamp(g, w, d, h, c) {
      const back = -d / 2, s = Math.min(w, d * 0.55), zc = back + d * 0.62, y0 = h * 0.12, gh = h * 0.5;
      box(g, w * 0.45, h * 0.45, 0.012, c, 0, h * 0.2, back + 0.006, METAL);
      box(g, 0.016, 0.016, d * 0.45, c, 0, h * 0.62, back + d * 0.225, METAL);
      box(g, s, 0.015, s, c, 0, y0, zc, METAL);
      box(g, s * 0.82, gh, s * 0.82, '#fff3d6', 0, y0 + 0.015, zc, { emissive: '#ffe6b0', emissiveIntensity: 1.6 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.008, gh, 0.008, c, sx * s * 0.43, y0 + 0.015, zc + sz * s * 0.43, METAL);
      add(g, new THREE.ConeGeometry(s * 0.75, h * 0.2, 4), mat(c, METAL), 0, y0 + 0.015 + gh + h * 0.1, zc).rotation.y = Math.PI / 4;
    },
    // Wall planter: a trough on a plate, flowers on top and stems falling down the wall.
    wallPlanter(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const y0 = h * 0.4, th = h * 0.28, back = -d / 2, zc = back + 0.012 + (d - 0.012) / 2;
      box(g, w * 0.9, h * 0.5, 0.012, shade(c, -0.08), 0, h * 0.3, back + 0.006);
      box(g, w, th, d - 0.012, c, 0, y0, zc);
      box(g, w - 0.03, 0.01, d - 0.04, '#4a3a2c', 0, y0 + th - 0.012, zc);
      troughFlowers(g, r, w, d - 0.012, y0 + th, zc, y0 + th - 0.03);
    },
    // Railing planter: hooked over the top rail with its back on the railing; the rim is
    // at `railMount` of the height, which main.js puts level with the rail top.
    // mode 'herbs': basil and rosemary instead of flowers.
    railPlanter(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const th = h * (def(it).railMount || 0.4), back = -d / 2, zc = back + 0.005 + (d - 0.01) / 2;
      box(g, w, th, d - 0.01, c, 0, 0, zc);
      box(g, w - 0.03, 0.01, d - 0.04, '#4a3a2c', 0, th - 0.012, zc);
      for (const sx of [-1, 1]) {
        const x = sx * w * 0.3;
        tube(g, [[x, th * 0.5, back + 0.004], [x, th + 0.035, back + 0.002], [x, th + 0.04, back - 0.035], [x, th, back - 0.065]], 0.005, '#3b3f45', METAL);
      }
      if (def(it).mode !== 'herbs') { troughFlowers(g, r, w, d - 0.01, th, zc, th * 0.9); return; }
      const s = Math.max(0.1, h - th - 0.02);
      basilPlant(g, r, -w * 0.3, th - 0.01, zc, s * 0.8);
      basilPlant(g, r, -w * 0.06, th - 0.01, zc, s * 0.72);
      rosemaryPlant(g, r, w * 0.26, th - 0.01, zc, s);
    },
    basilPot(g, w, d, h, c, it) {
      const ph = h * 0.38;
      pot(g, w * 0.85, ph, c);
      basilPlant(g, mulberry(seedOf(it)), 0, ph - 0.01, 0, h - ph);
    },
    rosemaryPot(g, w, d, h, c, it) {
      const ph = h * 0.3;
      pot(g, w * 0.85, ph, c);
      rosemaryPlant(g, mulberry(seedOf(it)), 0, ph - 0.01, 0, h - ph);
    },
    // Key bowl for the hall: a shallow bowl with a bunch of keys in it.
    keyBowl(g, w, d, h, c) {
      const r0 = Math.min(w, d) / 2;
      cyl(g, r0 * 0.55, r0 * 0.55, 0.004, c, 0, 0, 0);
      add(g, new THREE.LatheGeometry(profile(8, h, t => r0 * (0.55 + 0.45 * Math.sin((t * Math.PI) / 2))), 32), mat(c, { side: THREE.DoubleSide, roughness: 0.5 }));
      const ring = add(g, new THREE.TorusGeometry(0.018, 0.0035, 6, 16), mat('#c0c4c6', METAL), -0.015, 0.012, 0);
      ring.rotation.x = Math.PI / 2;
      for (const [a, len, col] of [[0.4, 0.055, '#c0c4c6'], [1.3, 0.05, '#d8dbdd'], [2.3, 0.045, '#c9a24a']]) {
        const k = box(g, 0.017, 0.004, len, col, -0.015 + Math.cos(a) * (0.018 + len / 2), 0.01, Math.sin(a) * (0.018 + len / 2), METAL);
        k.rotation.y = Math.PI / 2 - a;
      }
    },
    // Garden arch fixed to the wall around a door: two lattice sides and a round top, with a
    // wisteria climbing it and its lilac bunches hanging over the way in.
    wallArch(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const p = 0.06, xp = w / 2 - p / 2, zp = d / 2 - p / 2, R = xp, ys = h - R - p / 2;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) box(g, p, ys, p, c, sx * xp, 0, sz * zp);
        for (let y = 0.3; y < ys; y += 0.25) box(g, 0.025, 0.025, d - 2 * p, c, sx * xp, y, 0);
      }
      const N = 14, arcAt = (k, z) => [Math.cos((k / N) * Math.PI) * R, ys + Math.sin((k / N) * Math.PI) * R, z];
      for (const sz of [-1, 1]) tube(g, Array.from({ length: N + 1 }, (_, k) => arcAt(k, sz * zp)), p / 2, c);
      for (let k = 1; k < N; k++) { const [x, y] = arcAt(k, 0); box(g, 0.025, 0.025, d - 2 * p, c, x, y - 0.0125, 0); }
      // the climber: up both sides, then along the top
      const lilac = ['#9b7fc4', '#b49ad8', '#8462b0', '#c3afe3'], cone = new THREE.ConeGeometry(0.03, 1, 7);
      for (const sx of [-1, 1]) {
        const pts = [];
        for (let y = 0.05; y < ys; y += 0.18) pts.push([sx * xp + (r() - 0.5) * 0.06, y, (r() - 0.5) * zp]);
        tube(g, pts, 0.008, '#6b5a45');
        for (const [x, y, z] of pts.slice(2)) {
          for (let k = 0; k < 2; k++) blob(g, 0.04 + r() * 0.02, GREEN[k % 4], x + (r() - 0.5) * 0.08, y + (r() - 0.5) * 0.1, z + (r() - 0.5) * d * 0.5);
          if (r() < 0.4) ball(g, 0.02, lilac[Math.floor(r() * 4)], x + (r() - 0.5) * 0.08, y, z + (r() - 0.5) * d * 0.5, { roughness: 0.9 });
        }
      }
      for (let k = 0; k <= N; k++) {
        for (let j = 0; j < 2; j++) {
          const [x, y, z] = arcAt(k + (r() - 0.5) * 0.6, (r() - 0.5) * d * 0.9);
          blob(g, 0.06 + r() * 0.025, GREEN[(k + j) % 4], x, y + 0.02, z);
          if (k < 2 || k > N - 2) continue;
          const len = 0.12 + r() * 0.13, o = add(g, cone, mat(lilac[(k + j) % 4], { roughness: 0.9 }), x, y - 0.03 - len / 2, z);
          o.scale.y = len;
          o.rotation.x = Math.PI; // point down
        }
      }
    },
    // Railing bar: a wooden shelf resting on the top rail (its lip over the rail, at
    // `railMount` of the height) with two brackets underneath, for coffee or a drink outside.
    railBar(g, w, d, h, c, it) {
      const back = -d / 2, rail = h * def(it).railMount;
      box(g, w, 0.03, d, c, 0, h - 0.03, 0);
      box(g, w, rail > 0.03 ? h - 0.03 - rail : 0.01, 0.06, c, 0, rail, back - 0.03);
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.08);
        tube(g, [[x, 0.01, back + 0.01], [x, h * 0.55, back + d * 0.35], [x, h - 0.03, d / 2 - 0.04]], 0.01, '#3b3f45', METAL);
        box(g, 0.04, h - 0.03, 0.012, '#3b3f45', x, 0, back + 0.006, METAL);
      }
    },
    // Wall pergola: wooden rafters fixed to the wall that stick out a little, carried by
    // arched brackets, with a wisteria on top and its lilac bunches hanging down. No posts.
    wallPergola(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const back = -d / 2, top = h - 0.02, rafterY = top - 0.12, beamY = rafterY - 0.1, beamZ = d / 2 - 0.12;
      box(g, w, 0.14, 0.05, c, 0, rafterY - 0.02, back + 0.025);
      const n = Math.max(3, Math.round(w / 0.4) + 1);
      for (let k = 0; k < n; k++) box(g, 0.05, 0.12, d - 0.05, c, -w / 2 + 0.03 + (k * (w - 0.06)) / (n - 1), rafterY, 0.025);
      box(g, w, 0.1, 0.06, c, 0, beamY, beamZ);
      const yLow = Math.max(0.02, beamY - 0.4);
      for (const x of w > 2 ? [-w / 2 + 0.06, 0, w / 2 - 0.06] : [-w / 2 + 0.06, w / 2 - 0.06]) {
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const t = (k / 6) * Math.PI / 2;
          pts.push([x, yLow + (beamY - yLow) * Math.sin(t), back + 0.03 + (beamZ - back - 0.03) * (1 - Math.cos(t))]);
        }
        tube(g, pts, 0.025, c);
        box(g, 0.08, beamY - yLow + 0.04, 0.02, c, x, yLow - 0.02, back + 0.01);
      }
      for (let k = 0, m = Math.round(w * d * 45); k < m; k++) blob(g, 0.05 + r() * 0.03, GREEN[k % 4], (r() - 0.5) * w * 0.95, top - 0.03, (r() - 0.5) * d * 0.9);
      const cone = new THREE.ConeGeometry(0.035, 1, 7), lilac = ['#9b7fc4', '#b49ad8', '#8462b0', '#c3afe3'];
      for (let k = 0, m = Math.round(w * d * 40); k < m; k++) {
        const len = 0.14 + r() * 0.16, x = (r() - 0.5) * w * 0.95, z = back + 0.1 + r() * (d - 0.12);
        const o = add(g, cone, mat(lilac[k % 4], { roughness: 0.9 }), x, rafterY - len / 2, z);
        o.scale.y = len;
        o.rotation.x = Math.PI; // point down
        if (k % 3 === 0) blob(g, 0.03, GREEN[k % 4], x + 0.03, rafterY - 0.01, z);
      }
    },
    // Trellis with a climber: a planter on the ground, a wooden grid on the wall and a
    // clematis climbing it, flowers in the piece's colour.
    climberTrellis(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const back = -d / 2, ph = Math.min(0.3, h * 0.2), gz = back + 0.012, wood = '#c9a57a';
      box(g, w, ph, d - 0.01, '#b5674a', 0, 0, back + 0.005 + (d - 0.01) / 2);
      box(g, w - 0.03, 0.01, d - 0.04, '#4a3a2c', 0, ph - 0.012, back + 0.005 + (d - 0.01) / 2);
      for (let x = -w / 2 + 0.02; x <= w / 2 - 0.01; x += (w - 0.04) / Math.max(2, Math.round(w / 0.15))) box(g, 0.02, h - ph, 0.012, wood, x, ph, gz);
      for (let y = ph + 0.1; y < h; y += 0.2) box(g, w, 0.02, 0.012, wood, 0, y, gz + 0.012);
      const petal = new THREE.CircleGeometry(0.035, 6), fm = mat(c, { side: THREE.DoubleSide, roughness: 0.8 });
      for (let s = 0; s < 3; s++) {
        let x = (s - 1) * w * 0.28, y = ph;
        const pts = [[x, ph - 0.02, gz + 0.06]];
        while (y < h - 0.08) {
          y += 0.12 + r() * 0.08;
          x = Math.max(-w / 2 + 0.03, Math.min(w / 2 - 0.03, x + (r() - 0.5) * 0.14));
          pts.push([x, Math.min(y, h - 0.04), gz + 0.035]);
        }
        tube(g, pts, 0.005, '#5b6b3a');
        for (const [px, py, pz] of pts.slice(1)) {
          for (let k = 0; k < 3; k++) blob(g, 0.03 + r() * 0.015, GREEN[k % 4], px + (r() - 0.5) * 0.12, py + (r() - 0.5) * 0.1, pz + 0.01);
          if (r() < 0.75) {
            const f = add(g, petal, fm, px + (r() - 0.5) * 0.1, py + (r() - 0.5) * 0.08, pz + 0.045);
            f.castShadow = false;
            ball(g, 0.009, '#f2e6a0', f.position.x, f.position.y, f.position.z + 0.005);
          }
        }
      }
    },
    lavender(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      box(g, w, h * 0.35, d, c, 0, 0, 0);
      box(g, w - 0.04, 0.01, d - 0.04, '#4a3a2c', 0, h * 0.35 - 0.005, 0);
      const stem = new THREE.CylinderGeometry(0.003, 0.003, 1, 4), tip = new THREE.CylinderGeometry(0.008, 0.006, 1, 5);
      const sm = mat('#7d8f6a'), tm = mat('#8c6bb1', { roughness: 1 });
      for (let k = 0; k < 70; k++) {
        const x = (r() - 0.5) * (w - 0.08), z = (r() - 0.5) * (d - 0.08), len = h * (0.45 + r() * 0.2), y0 = h * 0.35;
        const s = new THREE.Mesh(stem, sm);
        s.scale.y = len;
        s.position.set(x, y0 + len / 2, z);
        s.rotation.set((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
        g.add(s);
        const t = new THREE.Mesh(tip, tm);
        t.scale.y = 0.07;
        t.position.set(x + s.rotation.z * -len * 0.5, y0 + len, z + s.rotation.x * len * 0.5);
        g.add(t);
      }
    },
    flowerBed(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const t = 0.08;
      for (const s of [-1, 1]) box(g, w, h, t, c, 0, 0, s * (d / 2 - t / 2));
      for (const s of [-1, 1]) box(g, t, h, d - 2 * t, c, s * (w / 2 - t / 2), 0, 0);
      box(g, w - 2 * t, h - 0.04, d - 2 * t, '#4a3a2c', 0, 0, 0, { roughness: 1 });
      const cols = ['#e8b7a8', '#f2c14e', '#ffffff', '#c56b45', '#9b5c7a', '#8c6bb1'];
      const n = Math.round(w * d * 60);
      for (let k = 0; k < n; k++) {
        const x = (r() - 0.5) * (w - 0.2), z = (r() - 0.5) * (d - 0.2), y = h + 0.05 + r() * 0.12;
        blob(g, 0.05, GREEN[k % 4], x, h + 0.02, z);
        ball(g, 0.025, cols[Math.floor(r() * cols.length)], x, y, z, { roughness: 0.9 });
      }
    },
    raisedBed(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const t = 0.04;
      for (const s of [-1, 1]) box(g, w, h, t, c, 0, 0, s * (d / 2 - t / 2));
      for (const s of [-1, 1]) box(g, t, h, d - 2 * t, c, s * (w / 2 - t / 2), 0, 0);
      box(g, w - 2 * t, h - 0.05, d - 2 * t, '#4a3a2c', 0, 0, 0, { roughness: 1 });
      const rows = Math.max(2, Math.round(d / 0.3));
      for (let j = 0; j < rows; j++) {
        const z = -d / 2 + t + ((j + 0.5) * (d - 2 * t)) / rows;
        for (let x = -w / 2 + 0.12; x < w / 2 - 0.08; x += 0.18) {
          if (j % 2) {
            cyl(g, 0.004, 0.004, 0.45, '#c8b48a', x, h, z, {}, 4);
            for (let k = 0; k < 3; k++) ball(g, 0.022, '#d94a3a', x + (r() - 0.5) * 0.06, h + 0.15 + r() * 0.25, z + (r() - 0.5) * 0.06);
            blob(g, 0.06, '#4f7f3f', x, h + 0.2, z);
          } else blob(g, 0.07, '#8fbf5a', x, h - 0.01, z);
        }
      }
    },
    sunLounger(g, w, d, h, c) {
      const wood = 'wood:ash';
      for (const s of [-1, 1]) box(g, 0.04, 0.06, d, wood, s * (w / 2 - 0.02), h - 0.12, 0);
      legs4Lite(g, w, d, h - 0.12, wood);
      box(g, w - 0.04, 0.07, d * 0.65, c, 0, h - 0.07, d / 2 - d * 0.325, { roughness: 1 });
      const back = new THREE.Group();
      back.position.set(0, h - 0.06, -d / 2 + d * 0.35);
      back.rotation.x = 0.75; // backrest raised
      g.add(back);
      box(back, w - 0.04, 0.07, d * 0.33, c, 0, 0, -d * 0.165, { roughness: 1 });
    },
    parasol(g, w, d, h, c) {
      box(g, 0.45, 0.08, 0.45, '#5b5f63', 0, 0, 0);
      cyl(g, 0.02, 0.02, h - 0.08, '#e9e6df', 0, 0.08, 0, METAL, 10);
      const r = Math.min(w, d) / 2;
      add(g, new THREE.ConeGeometry(r, 0.45, 8, 1, true), mat(c, { side: THREE.DoubleSide, roughness: 1 }), 0, h - 0.3, 0);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        tube(g, [[0, h - 0.08, 0], [Math.cos(a) * r * 0.98, h - 0.52, Math.sin(a) * r * 0.98]], 0.005, '#e9e6df');
      }
      ball(g, 0.03, c, 0, h - 0.06, 0);
    },
    bbq(g, w, d, h, c) {
      const r = Math.min(0.32, d / 2);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        tube(g, [[Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.5, h * 0.6, Math.sin(a) * r * 0.5]], 0.012, '#5b5f63', METAL);
      }
      add(g, new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(c, { side: THREE.DoubleSide, roughness: 0.4 }), 0, h * 0.68, 0);
      add(g, new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(c, { side: THREE.DoubleSide, roughness: 0.4 }), 0, h * 0.68, 0).scale.y = 0.9;
      cyl(g, 0.02, 0.02, 0.05, '#c0c4c6', 0, h * 0.68 + r * 0.85, 0, METAL);
      const shelf = Math.max(0.2, w - 2 * r - 0.05);
      box(g, shelf, 0.02, d * 0.6, 'wood:oak', w / 2 - shelf / 2, h * 0.6, 0);
    },
    bench(g, w, d, h, c) {
      const seatY = 0.42;
      for (const s of [-1, 1]) {
        const x = s * (w / 2 - 0.06);
        box(g, 0.05, seatY, 0.05, DARK, x, 0, d / 2 - 0.08, METAL);
        box(g, 0.05, h, 0.05, DARK, x, 0, -d / 2 + 0.06, METAL);
        box(g, 0.05, 0.04, d - 0.1, DARK, x, seatY - 0.04, 0, METAL);
      }
      for (let k = 0; k < 4; k++) box(g, w, 0.025, 0.08, c, 0, seatY, -d / 2 + 0.1 + k * ((d - 0.15) / 4) + 0.04);
      for (let k = 0; k < 3; k++) box(g, w, 0.08, 0.025, c, 0, seatY + 0.12 + k * 0.11, -d / 2 + 0.05);
    },
    pool(g, w, d, h, c) {
      const rim = 0.3, stone = '#ece6da';
      for (const s of [-1, 1]) box(g, w, 0.06, rim, stone, 0, 0, s * (d / 2 - rim / 2), { roughness: 0.9 });
      for (const s of [-1, 1]) box(g, rim, 0.06, d - 2 * rim, stone, s * (w / 2 - rim / 2), 0, 0, { roughness: 0.9 });
      box(g, w - 2 * rim, 0.01, d - 2 * rim, shade(c, -0.15), 0, 0, 0);
      const water = box(g, w - 2 * rim, 0.01, d - 2 * rim, c, 0, 0.035, 0, { transparent: true, opacity: 0.82, roughness: 0.05, metalness: 0.1 });
      water.castShadow = false;
      for (const s of [-1, 1]) tube(g, [[w / 2 - rim - 0.05, 0.03, s * 0.25], [w / 2 - rim + 0.05, 0.75, s * 0.25], [w / 2 - rim + 0.15, 0.75, s * 0.25], [w / 2 - rim + 0.2, 0.06, s * 0.25]], 0.02, '#c0c4c6', METAL);
    },
    shed(g, w, d, h, c) {
      const wallH = h * 0.72;
      box(g, w, wallH, d, c, 0, 0, 0, { roughness: 1 });
      for (let x = -w / 2 + 0.1; x < w / 2; x += 0.12) box(g, 0.006, wallH, 0.004, shade(c, -0.15), x, 0, d / 2 + 0.002);
      const slope = Math.hypot(w / 2 + 0.1, h - wallH);
      for (const s of [-1, 1]) {
        const roof = box(g, slope, 0.04, d + 0.2, '#3b3f45', 0, 0, 0);
        roof.position.set(s * (w / 4), wallH + (h - wallH) / 2, 0);
        roof.rotation.z = -s * Math.atan2(h - wallH, w / 2);
      }
      const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h - wallH)]);
      for (const z of [d / 2, -d / 2]) add(g, new THREE.ShapeGeometry(gable), mat(c, { side: THREE.DoubleSide }), 0, wallH, z);
      box(g, 0.8, 1.85, 0.03, shade(c, -0.1), -w * 0.15, 0, d / 2 + 0.01);
      box(g, 0.02, 0.1, 0.03, '#c0c4c6', -w * 0.15 + 0.3, 0.95, d / 2 + 0.03, METAL);
      box(g, 0.5, 0.4, 0.03, '#bfe0f0', w * 0.25, 1.1, d / 2 + 0.01, GLASS);
    },
    pergola(g, w, d, h, c) {
      const p = 0.12;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, p, h - 0.2, p, c, sx * (w / 2 - p / 2), 0, sz * (d / 2 - p / 2));
      for (const sz of [-1, 1]) box(g, w + 0.3, 0.2, 0.08, c, 0, h - 0.2, sz * (d / 2 - p / 2));
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.35) box(g, 0.05, 0.14, d + 0.3, c, x, h - 0.06, 0);
    },
    // Wall tiles: a thin tiled panel, the pattern keeps its real size.
    // Doors and windows behind it (it.cutouts, set by main.js) stay uncovered: the panel is
    // made of the pieces around them.
    tilePanel(g, w, d, h, c, it) {
      const m = texMat(artTexture(def(it).art || 'subway'), { roughness: 0.25 }, c);
      const cuts = (it.cutouts || []).map(([x0, y0, x1, y1]) => [Math.max(-w / 2, x0), Math.max(0, y0), Math.min(w / 2, x1), Math.min(h, y1)]);
      const xs = [...new Set([-w / 2, w / 2, ...cuts.flatMap(q => [q[0], q[2]])])].sort((a, b) => a - b);
      const ys = [...new Set([0, h, ...cuts.flatMap(q => [q[1], q[3]])])].sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
        if (x1 - x0 < 0.002 || y1 - y0 < 0.002) continue;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        if (cuts.some(q => cx > q[0] && cx < q[2] && cy > q[1] && cy < q[3])) continue;
        box(g, x1 - x0, y1 - y0, d, c, cx, y0, 0).castShadow = false;
        // Tiles keep their real size (60 cm per picture) and line up across the pieces.
        const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
        const uv = geo.attributes.uv, pos = geo.attributes.position;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + pos.getX(k)) / 0.6, (cy + pos.getY(k)) / 0.6);
        add(g, geo, m, cx, cy, d / 2 + 0.001).castShadow = false;
      }
    },
    patternRug(g, w, d, h, c, it) {
      const m = box(g, w, Math.max(h, 0.008), d, c, 0, 0, 0, { roughness: 1 });
      m.castShadow = false;
      const top = plane(g, w - 0.004, d - 0.004, texMat(artTexture(def(it).art, seedOf(it)), { roughness: 1 }), 0, 0, 0);
      top.rotation.x = -Math.PI / 2;
      top.position.set(0, Math.max(h, 0.008) + 0.001, 0);
      top.receiveShadow = true;
    },
    roundRug(g, w, d, h, c, it) {
      const art = def(it).art;
      const top = art ? texMat(artTexture(art, seedOf(it)), { roughness: 1 }) : mat(shade(c, 0.1), { roughness: 1 });
      const o = add(g, new THREE.CylinderGeometry(0.5, 0.5, Math.max(h, 0.008), 48), [mat(c, { roughness: 1 }), top, mat(c)], 0, Math.max(h, 0.008) / 2, 0);
      o.scale.set(w, 1, d);
      o.castShadow = false;
      if (!art) {
        const ring = add(g, new THREE.RingGeometry(0.36, 0.4, 48), mat(c, { roughness: 1 }), 0, Math.max(h, 0.008) + 0.001, 0);
        ring.rotation.x = -Math.PI / 2;
        ring.scale.set(w, d, 1);
        ring.castShadow = false;
      }
    },

    // ---------- living room ----------
    sideboard(g, w, d, h, c) {
      const legH = 0.16;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.018, 0.012, legH, 'wood:walnut', sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.07), {}, 8);
      box(g, w, h - legH, d, c, 0, legH, 0);
      fronts(g, w, h - legH, d, Math.max(2, Math.round(w / 0.45)), legH);
    },
    // TV wall: low cabinet, two tall side columns and floating shelves between them.
    tvUnit(g, w, d, h, c, it) {
      const baseH = 0.45, col = Math.min(0.45, w * 0.18);
      box(g, w - 2 * col, baseH - 0.05, d, c, 0, 0.05, 0);
      box(g, w - 2 * col, 0.05, d - 0.04, shade(c, -0.2), 0, 0, -0.02);
      fronts(g, w - 2 * col, baseH - 0.05, d, Math.max(2, Math.round((w - 2 * col) / 0.6)), 0.05);
      for (const s of [-1, 1]) {
        box(g, col, h, d * 0.85, c, s * (w / 2 - col / 2), 0, -d * 0.075);
        fronts(g, col, h, d * 0.85, 1, 0, -d * 0.075, s * (w / 2 - col / 2));
      }
      const r = mulberry(seedOf(it));
      for (const y of [h * 0.68, h * 0.88]) {
        box(g, w - 2 * col - 0.1, 0.03, 0.25, c, 0, y, -d / 2 + 0.125);
        let x = -(w - 2 * col) / 2 + 0.15;
        for (let k = 0; k < 6; k++) {
          const bw = 0.025 + r() * 0.02;
          box(g, bw, 0.16 + r() * 0.06, 0.18, ['#2f4a6b', '#8b2f2f', '#e9e1d3', '#56704f'][k % 4], x, y + 0.03, -d / 2 + 0.12);
          x += bw + 0.003;
        }
        cyl(g, 0.05, 0.04, 0.18, '#dfe7ea', (w - 2 * col) / 2 - 0.3, y + 0.03, -d / 2 + 0.12, { roughness: 0.2 });
      }
    },
    // Glass display cabinet with a few things inside.
    displayCabinet(g, w, d, h, c, it) {
      const f = 0.04, r = mulberry(seedOf(it));
      for (const sx of [-1, 1]) box(g, f, h, d, c, sx * (w / 2 - f / 2), 0, 0);
      box(g, w, 0.08, d, c, 0, 0, 0);
      box(g, w, f, d, c, 0, h - f, 0);
      box(g, w - 2 * f, h - 0.12, 0.01, c, 0, 0.08, -d / 2 + 0.005);
      box(g, w - 2 * f, h - 0.12, 0.006, '#cfe8f2', 0, 0.08, d / 2 - 0.003, GLASS);
      const n = Math.max(3, Math.round(h / 0.4));
      for (let k = 1; k <= n; k++) {
        const y = 0.08 + ((h - 0.12) * k) / (n + 1);
        box(g, w - 2 * f, 0.008, d - 0.03, '#cfe8f2', 0, y, -0.01, GLASS);
        for (let j = 0; j < 3; j++) {
          const x = -w / 2 + 0.12 + (j * (w - 0.24)) / 2;
          if (r() < 0.5) cyl(g, 0.035, 0.03, 0.08 + r() * 0.1, ['#f2f0eb', '#2f4a6b', '#c9a24a'][j], x, y + 0.008, -0.02, { roughness: 0.25 });
          else ball(g, 0.04, ['#e8b7a8', '#dfe7ea', '#56704f'][j], x, y + 0.05, -0.02, { roughness: 0.3 });
        }
      }
    },
    // Cube shelving: open cells, some with fabric boxes, some with books.
    cubeShelf(g, w, d, h, c, it) {
      const t = 0.035, r = mulberry(seedOf(it));
      const nx = Math.max(1, Math.round(w / 0.37)), ny = Math.max(1, Math.round(h / 0.37));
      const cw = (w - t) / nx, ch = (h - t) / ny;
      for (let i = 0; i <= nx; i++) box(g, t, h, d, c, -w / 2 + t / 2 + i * cw, 0, 0);
      for (let j = 0; j <= ny; j++) box(g, w, t, d, c, 0, j * ch, 0);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const x = -w / 2 + t + i * cw + (cw - t) / 2, y = j * ch + t, k = r();
        if (k < 0.3) box(g, cw - t - 0.03, ch - t - 0.04, d - 0.04, ['#c9b48a', '#7d8a96', '#e9e1d3', '#b8735a'][Math.floor(r() * 4)], x, y, 0.01, { roughness: 1 });
        else if (k < 0.65) {
          let bx = x - (cw - t) / 2 + 0.03;
          while (bx < x + (cw - t) / 2 - 0.08) {
            const bw = 0.02 + r() * 0.025;
            box(g, bw, Math.min(ch - t - 0.03, 0.2 + r() * 0.08), d * 0.7, ['#2f4a6b', '#8b2f2f', '#d9b44a', '#56704f', '#e9e1d3'][Math.floor(r() * 5)], bx, y, 0);
            bx += bw + 0.002;
          }
        } else if (k < 0.8) blob(g, 0.08, GREEN[j % 4], x, y + 0.08, 0);
      }
    },
    // Three staggered wall shelves with small things on them.
    floatingShelves(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      const rows = [[-w * 0.15, 0, w * 0.6], [w * 0.15, h * 0.45, w * 0.6], [-w * 0.05, h * 0.9 - 0.025, w * 0.5]];
      rows.forEach(([x, y, sw], k) => {
        box(g, sw, 0.025, d, c, x, y, 0);
        if (k === 0) { cyl(g, 0.05, 0.04, 0.1, '#f2f0eb', x - sw * 0.3, y + 0.025, 0); for (let n = 0; n < 4; n++) blob(g, 0.045, GREEN[n], x - sw * 0.3 + (r() - 0.5) * 0.06, y + 0.15 + r() * 0.05, (r() - 0.5) * 0.06); }
        if (k === 1) for (let n = 0; n < 6; n++) box(g, 0.025, 0.16 + r() * 0.06, d * 0.7, ['#2f4a6b', '#8b2f2f', '#d9b44a', '#e9e1d3'][n % 4], x - sw * 0.35 + n * 0.03, y + 0.025, 0);
        if (k === 1) cyl(g, 0.04, 0.05, 0.14, '#c56b45', x + sw * 0.3, y + 0.025, 0, { roughness: 0.3 });
        if (k === 2 && y + 0.2 < h + 0.3) { box(g, 0.12, 0.15, 0.015, '#2b2b2b', x + sw * 0.2, y + 0.025, -d / 2 + 0.03); box(g, 0.1, 0.13, 0.004, '#e8b7a8', x + sw * 0.2, y + 0.035, -d / 2 + 0.04); }
      });
    },
    pouf(g, w, d, h, c) {
      const o = cyl(g, 0.5, 0.48, h, c, 0, 0, 0, { roughness: 1 }, 28);
      o.scale.set(w, 1, d);
      const top = ball(g, 0.5, shade(c, 0.05), 0, h, 0, { roughness: 1 });
      top.scale.set(w * 0.98, 0.06, d * 0.98);
      ball(g, 0.012, shade(c, -0.2), 0, h + 0.03, 0);
    },
    beanBag(g, w, d, h, c) {
      const b = ball(g, 0.5, c, 0, h * 0.45, 0, { roughness: 1 });
      b.scale.set(w, h * 0.95, d);
      const back = ball(g, 0.4, shade(c, -0.04), 0, h * 0.62, -d * 0.18, { roughness: 1 });
      back.scale.set(w * 0.9, h * 0.8, d * 0.6);
    },
    // L-shaped sofa: long seat along the back, chaise on the right reaching the front.
    cornerSofa(g, w, d, h, c) {
      const depth = Math.min(0.95, d * 0.6), arm = 0.16, light = shade(c, 0.06);
      box(g, w, 0.32, depth, c, 0, 0.08, -d / 2 + depth / 2);
      box(g, depth, 0.32, d - depth, c, w / 2 - depth / 2, 0.08, depth / 2);
      box(g, w, h - 0.08, 0.2, c, 0, 0.08, -d / 2 + 0.1);
      box(g, arm, 0.55, depth, c, -w / 2 + arm / 2, 0.08, -d / 2 + depth / 2);
      const seat = w - arm - depth, n = Math.max(1, Math.round(seat / 0.7)), cw = seat / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + arm + cw * i + cw / 2;
        box(g, cw - 0.02, 0.14, depth - 0.24, light, x, 0.4, -d / 2 + 0.2 + (depth - 0.2) / 2);
        box(g, cw - 0.04, h - 0.5, 0.14, light, x, 0.5, -d / 2 + 0.27);
      }
      box(g, depth - 0.04, 0.14, d - 0.24, light, w / 2 - depth / 2, 0.4, 0.1);
      box(g, depth - 0.06, h - 0.5, 0.14, light, w / 2 - depth / 2, 0.5, -d / 2 + 0.27);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.04, 0.08, 0.04, DARK, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06));
    },
    sideTable(g, w, d, h, c) {
      const top = cyl(g, w / 2, w / 2, 0.025, c, 0, h - 0.025, 0, {}, 32);
      top.scale.z = d / w;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        tube(g, [[Math.cos(a) * w * 0.4, 0, Math.sin(a) * d * 0.4], [Math.cos(a) * w * 0.25, h - 0.025, Math.sin(a) * d * 0.25]], 0.01, DARK, METAL);
      }
    },
    // The lower shelf's top is at `shelves[0]` cm, where pieces can stand too.
    consoleTable(g, w, d, h, c, it) {
      box(g, w, 0.03, d, c, 0, h - 0.03, 0);
      box(g, w - 0.08, 0.02, d - 0.06, c, 0, (def(it).shelves?.[0] ?? 20) / 100 - 0.02, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.025, h - 0.03, 0.025, DARK, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03), METAL);
    },
    fireplace(g, w, d, h, c) {
      const ow = w * 0.55, oh = h * 0.55;
      for (const s of [-1, 1]) box(g, (w - ow) / 2, h - 0.06, d, c, s * (ow / 2 + (w - ow) / 4), 0, 0, { roughness: 0.9 });
      box(g, ow, h - 0.06 - oh, d, c, 0, oh, 0, { roughness: 0.9 });
      box(g, w + 0.12, 0.06, d + 0.06, shade(c, -0.08), 0, h - 0.06, 0.03, { roughness: 0.8 });
      box(g, ow, oh, d * 0.6, '#1d1a18', 0, 0, -d * 0.2);
      box(g, ow + 0.1, 0.03, 0.25, '#5b5f63', 0, 0, d / 2 + 0.1);
      for (const s of [-1, 1]) { const l = cyl(g, 0.04, 0.04, ow * 0.6, '#6e4b33', 0, 0, 0); l.rotation.z = Math.PI / 2; l.rotation.y = s * 0.25; l.position.set(0, 0.05, d * 0.05); }
      for (let k = 0; k < 5; k++) add(g, new THREE.ConeGeometry(0.05 - k * 0.004, 0.18 + (k % 2) * 0.1, 8), glow(k % 2 ? '#ffb347' : '#ff7b2e', 2.4), -0.12 + k * 0.06, 0.18, d * 0.05).castShadow = false;
    },
    // Curtains on a rod: two gathered panels. Hang them over a window.
    curtains(g, w, d, h, c) {
      const rod = cyl(g, 0.012, 0.012, w + 0.1, '#5b5f63', 0, 0, 0, METAL);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, h - 0.03, -d / 2 + 0.06);
      const pw = w * 0.3;
      for (const s of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(pw, h - 0.06, 18, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 40) * 0.03);
        geo.computeVertexNormals();
        add(g, geo, mat(c, { side: THREE.DoubleSide, roughness: 1 }), s * (w / 2 - pw / 2), (h - 0.06) / 2, -d / 2 + 0.07);
      }
    },
    radiator(g, w, d, h, c) {
      const n = Math.max(4, Math.round(w / 0.06)), fw = w / n;
      for (let k = 0; k < n; k++) box(g, fw * 0.7, h, d * 0.6, c, -w / 2 + fw * (k + 0.5), 0, 0, { roughness: 0.4 });
      for (const y of [0.04, h - 0.06]) { const p = cyl(g, 0.016, 0.016, w, c, 0, 0, 0); p.rotation.z = Math.PI / 2; p.position.set(0, y, 0); }
      cyl(g, 0.012, 0.012, 0.12, '#c0c4c6', w / 2 + 0.02, -0.12, 0, METAL);
    },
    wallCupboard(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0);
      fronts(g, w, h, d, Math.max(1, Math.round(w / 0.6)), 0);
    },

    // ---------- entrance ----------
    shoeCabinet(g, w, d, h, c) {
      for (const sx of [-1, 1]) box(g, 0.03, 0.08, d - 0.04, DARK, sx * (w / 2 - 0.05), 0, 0);
      box(g, w, h - 0.08, d, c, 0, 0.08, 0);
      const n = Math.max(2, Math.round((h - 0.08) / 0.45)), fh = (h - 0.08) / n;
      for (let k = 1; k < n; k++) box(g, w - 0.01, 0.005, 0.004, DARK, 0, 0.08 + k * fh, d / 2 + 0.002);
      for (let k = 0; k < n; k++) box(g, 0.12, 0.015, 0.02, '#9a9a9a', 0, 0.08 + k * fh + fh - 0.06, d / 2 + 0.01, METAL);
    },
    // Wall coat rack: a board with hooks and a couple of coats.
    coatRack(g, w, d, h, c, it) {
      box(g, w, 0.1, 0.02, c, 0, h - 0.12, -d / 2 + 0.01);
      const n = Math.max(3, Math.round(w / 0.16));
      for (let k = 0; k < n; k++) cyl(g, 0.008, 0.008, 0.06, '#5b5f63', -w / 2 + 0.08 + (k * (w - 0.16)) / (n - 1), h - 0.08, -d / 2 + 0.04, METAL, 6).rotation.x = Math.PI / 2;
      box(g, w, 0.02, d * 0.9, c, 0, h - 0.02, 0);
      const r = mulberry(seedOf(it));
      for (const k of [0, 2, 3]) {
        if (k >= n) continue;
        const x = -w / 2 + 0.08 + (k * (w - 0.16)) / (n - 1);
        const coat = box(g, 0.34, 0.85, 0.12, ['#3f5e7a', '#8a5a3c', '#5b5f63', '#9b5c7a'][Math.floor(r() * 4)], x, h - 0.95, -d / 2 + 0.09, { roughness: 1 });
        coat.scale.x = 0.9 + r() * 0.2;
      }
    },
    coatStand(g, w, d, h, c) {
      cyl(g, w * 0.4, w * 0.45, 0.03, c, 0, 0, 0);
      cyl(g, 0.018, 0.018, h - 0.03, c, 0, 0.03, 0, {}, 10);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        tube(g, [[0, h - 0.15, 0], [Math.cos(a) * 0.12, h - 0.1, Math.sin(a) * 0.12], [Math.cos(a) * 0.15, h - 0.04, Math.sin(a) * 0.15]], 0.008, c);
      }
      box(g, 0.32, 0.8, 0.14, '#5b4636', 0.07, h - 0.95, 0.06, { roughness: 1 }).rotation.y = 0.4;
      ball(g, 0.11, '#2f4a6b', -0.1, h - 0.08, -0.08, { roughness: 1 }).scale.y = 0.6;
    },
    entryBench(g, w, d, h, c) {
      box(g, w, 0.04, d, c, 0, h - 0.04, 0);
      for (const sx of [-1, 1]) box(g, 0.035, h - 0.04, d, c, sx * (w / 2 - 0.018), 0, 0);
      box(g, w - 0.07, 0.02, d - 0.04, c, 0, 0.12, 0);
      const cols = ['#2b2b2b', '#8a5a3c', '#e9e1d3', '#3f5e7a'];
      for (let k = 0; k < Math.floor((w - 0.1) / 0.24); k++) {
        const x = -w / 2 + 0.17 + k * 0.24;
        for (const s of [-1, 1]) box(g, 0.08, 0.08, Math.min(0.26, d - 0.06), cols[k % 4], x + s * 0.045, 0.14, 0, { roughness: 0.8 });
      }
      box(g, w - 0.1, 0.06, d - 0.06, '#9c8f7c', 0, h, 0, { roughness: 1 });
    },
    umbrellaStand(g, w, d, h, c) {
      cyl(g, w / 2, w * 0.45, h, c, 0, 0, 0, { side: THREE.DoubleSide }, 20);
      for (const [x, z, col] of [[0.03, 0.02, '#2f4a6b'], [-0.04, -0.01, '#8b2f2f']]) {
        cyl(g, 0.006, 0.006, 0.4, '#3b3f45', x, h - 0.2, z, {}, 6);
        tube(g, [[x, h + 0.2, z], [x, h + 0.27, z], [x + 0.05, h + 0.3, z], [x + 0.08, h + 0.25, z]], 0.008, col);
        cyl(g, 0.035, 0.012, 0.5, col, x, h - 0.32, z, { roughness: 0.9 }, 8);
      }
    },

    // ---------- small things to put on top of furniture ----------
    booksStack(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      let y = 0;
      const n = Math.max(2, Math.round(h / 0.035));
      for (let k = 0; k < n; k++) {
        const bh = h / n;
        const b = box(g, w * (0.8 + r() * 0.2), bh - 0.002, d * (0.8 + r() * 0.2), ['#2f4a6b', '#8b2f2f', '#d9b44a', '#56704f', '#e9e1d3', '#3b3f45'][Math.floor(r() * 6)], 0, y, 0);
        b.rotation.y = (r() - 0.5) * 0.3;
        y += bh;
      }
    },
    candles(g, w, d, h, c) {
      const tray = cyl(g, w / 2, w / 2, 0.015, '#c9a24a', 0, 0, 0, METAL, 28);
      tray.scale.z = d / w;
      [[-w * 0.25, 0.9], [0, 0.6], [w * 0.25, 0.4]].forEach(([x, k]) => {
        const ch = (h - 0.04) * k;
        cyl(g, 0.03, 0.03, ch, c, x, 0.015, 0, { roughness: 0.6 }, 16);
        add(g, new THREE.ConeGeometry(0.008, 0.03, 6), glow('#ffcf6b', 2.6), x, 0.015 + ch + 0.018, 0).castShadow = false;
      });
    },
    photoFrame(g, w, d, h, c, it) {
      const p = new THREE.Group();
      p.rotation.x = -0.18;
      p.position.z = 0.01;
      g.add(p);
      box(p, w, h, 0.015, c, 0, 0, 0);
      plane(p, w - 0.03, h - 0.03, texMat(artTexture('landscape', seedOf(it)), { roughness: 0.6 }), 0, 0.015, 0.008);
      box(g, 0.01, h * 0.8, 0.01, c, 0, 0, -d / 2 + 0.02).rotation.x = 0.4;
    },
    speaker(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.6 });
      disc(g, w * 0.32, 0.01, '#1d1d1f', 0, h * 0.38, d / 2 + 0.002);
      disc(g, w * 0.14, 0.01, '#1d1d1f', 0, h * 0.78, d / 2 + 0.002);
    },
    recordPlayer(g, w, d, h, c) {
      box(g, w, h * 0.7, d, c, 0, 0, 0, { roughness: 0.5 });
      const rr = Math.min(w, d) * 0.4;
      cyl(g, rr, rr, 0.01, '#1d1d1f', -w * 0.08, h * 0.7, 0, { roughness: 0.3 }, 40);
      cyl(g, rr * 0.33, rr * 0.33, 0.012, '#d94a3a', -w * 0.08, h * 0.7, 0, {}, 24);
      tube(g, [[w * 0.4, h * 0.75, -d * 0.35], [w * 0.38, h * 0.78, 0], [w * 0.15, h * 0.78, d * 0.15]], 0.004, '#c0c4c6', METAL);
      box(g, w, 0.006, d, '#cfe8f2', 0, h - 0.006, 0, GLASS);
    },
    microwave(g, w, d, h, c) {
      box(g, w, h, d, c, 0, 0, 0, { roughness: 0.4 });
      box(g, w * 0.68, h * 0.75, 0.005, '#1d1d1f', -w * 0.12, h * 0.12, d / 2 + 0.002, { roughness: 0.1 });
      box(g, w * 0.18, h * 0.75, 0.005, '#3b3f45', w * 0.37, h * 0.12, d / 2 + 0.002);
      box(g, 0.012, h * 0.6, 0.02, '#c0c4c6', w * 0.24, h * 0.2, d / 2 + 0.01, METAL);
    },
    coffeeMachine(g, w, d, h, c) {
      box(g, w, 0.04, d, c, 0, 0, 0, METAL);
      box(g, w, h - 0.04, d * 0.45, c, 0, 0.04, -d / 2 + d * 0.225, METAL);
      box(g, w, 0.06, d, c, 0, h - 0.06, 0, METAL);
      box(g, 0.08, 0.025, 0.12, '#2b2b2b', 0, h - 0.12, d * 0.1);
      cyl(g, 0.03, 0.025, 0.06, '#ffffff', 0, 0.04, d * 0.15, { roughness: 0.2 });
      disc(g, 0.012, 0.01, '#7fc7c0', -w * 0.3, h - 0.03, d / 2, { emissive: '#7fc7c0', emissiveIntensity: 1 });
    },
    fruitBowl(g, w, d, h, c, it) {
      const r = mulberry(seedOf(it));
      add(g, new THREE.SphereGeometry(w / 2, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(c, { side: THREE.DoubleSide, roughness: 0.3 }), 0, h * 0.75, 0).scale.y = (h * 0.75) / (w / 2);
      const fr = ['#e8a33c', '#d94a3a', '#e9d64a', '#7fae4a'];
      for (let k = 0; k < 6; k++) ball(g, 0.04, fr[k % 4], (r() - 0.5) * w * 0.45, h * 0.6 + r() * h * 0.3, (r() - 0.5) * d * 0.45);
    },
    vase(g, w, d, h, c) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        pts.push(new THREE.Vector2((w / 2) * (0.55 + 0.45 * Math.sin(Math.PI * (t * 0.85 + 0.1))) * (t > 0.85 ? 0.7 : 1), t * h));
      }
      add(g, new THREE.LatheGeometry(pts, 28), mat(c, { side: THREE.DoubleSide, roughness: 0.25 }));
    },
  };

  // Gaps and knobs on a cabinet front (n doors), starting at height y0.
  function fronts(g, w, h, d, n, y0, z0 = 0, x0 = 0) {
    const dw = w / n, z = z0 + d / 2, L = x0 - w / 2;
    for (let i = 1; i < n; i++) box(g, 0.005, h - 0.02, 0.004, DARK, L + i * dw, y0 + 0.01, z + 0.002);
    for (let i = 0; i < n; i++) {
      const cx = L + dw * i + dw / 2, hx = n === 1 ? cx + dw * 0.38 : cx + (i % 2 ? -dw * 0.38 : dw * 0.38);
      box(g, 0.012, Math.min(0.14, h * 0.4), 0.018, '#9a9a9a', hx, y0 + h * 0.5 - 0.07, z + 0.009, METAL);
    }
  }

  // Four plain legs (lounger and the like).
  function legs4Lite(g, w, d, h, color) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.04, h, 0.04, color, sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.06));
  }

  // Guitar standing on its bottom end, facing +z. Electric: thinner, solid colour.
  function guitar(c, L, electric) {
    const gt = new THREE.Group();
    const bodyL = L * (electric ? 0.42 : 0.48), R1 = bodyL * (electric ? 0.36 : 0.38), R2 = bodyL * (electric ? 0.27 : 0.29);
    const yb = R1, yu = bodyL - R2;
    const arc = (R, c, y) => Math.sqrt(Math.max(0, R * R - (y - c) ** 2)); // rounding can make it negative
    const half = y => Math.max(
      arc(R1, yb, y),
      arc(R2, yu, y),
      y > 0.02 && y < bodyL - 0.02 ? R2 * 0.75 : 0,
    );
    const pts = [];
    const n = 40;
    for (let i = 0; i <= n; i++) { const y = (i / n) * bodyL; pts.push(new THREE.Vector2(half(y), y)); }
    // Left side, skipping the two ends the right side already has (repeated points break the bevel).
    for (let i = n - 1; i >= 1; i--) { const y = (i / n) * bodyL; pts.push(new THREE.Vector2(-half(y) * (electric && y > bodyL * 0.6 ? 0.7 : 1), y)); }
    const depth = electric ? 0.045 : 0.1;
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
    geo.translate(0, 0, -depth / 2);
    const body = new THREE.Mesh(geo, mat(c, { roughness: 0.3 }));
    body.castShadow = true;
    gt.add(body);
    const front = depth / 2 + 0.007;
    if (electric) {
      box(gt, R1 * 0.9, bodyL * 0.35, 0.003, '#f4f3ef', R1 * 0.1, bodyL * 0.12, front);
      for (const y of [0.3, 0.45]) box(gt, 0.075, 0.02, 0.008, '#1d1d1f', 0, bodyL * y, front + 0.002);
    } else {
      disc(gt, R2 * 0.42, 0.002, '#1d1d1f', 0, yu - R2 * 0.15, front);
      box(gt, 0.1, 0.02, 0.008, '#3a2a1c', 0, yb * 0.6, front + 0.002);
    }
    const neckL = L - bodyL - 0.17;
    box(gt, 0.05, neckL + 0.04, 0.025, '#5a3a24', 0, bodyL - 0.04, front - 0.01);
    box(gt, 0.08, 0.17, 0.018, electric ? c : '#3a2a1c', 0, bodyL + neckL, front - 0.015);
    for (let k = 0; k < 6; k++) box(gt, 0.0012, L - 0.25, 0.002, '#d9d6cf', -0.016 + k * 0.0064, yb * 0.6, front + 0.01, METAL);
    return gt;
  }
}
