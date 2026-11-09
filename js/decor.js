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
    tilePanel(g, w, d, h, c, it) {
      const tex = artTexture(def(it).art || 'subway').clone();
      tex.repeat.set(w / 0.6, h / 0.6);
      tex.needsUpdate = true;
      const m = new THREE.MeshStandardMaterial({ map: tex, color: c, roughness: 0.25 });
      const o = add(g, new THREE.BoxGeometry(w, h, d), [mat(c), mat(c), mat(c), mat(c), m, mat(c)], 0, h / 2, 0);
      o.castShadow = false;
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
    consoleTable(g, w, d, h, c) {
      box(g, w, 0.03, d, c, 0, h - 0.03, 0);
      box(g, w - 0.08, 0.02, d - 0.06, c, 0, 0.18, 0);
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
