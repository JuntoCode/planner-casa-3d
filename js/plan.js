import * as G from './geometry.js';

// The floor plan is a graph: nodes (corners) joined by walls. Walls can be
// curved (`bulge`), railings (terraces) or invisible dividers. Rooms are not
// drawn directly: they are the closed areas the walls form, found by walking
// the graph. Each room keeps its settings in `st.rooms` (a "meta" with an
// anchor point inside it), matched again to the areas after every edit.
// Doors and windows hang on a wall: `wall` id + `t` (cm from the wall start).

export const ROOM_TYPES = {
  living: { label: 'Soggiorno', floor: 'parquet' },
  kitchen: { label: 'Cucina', floor: 'tiles' },
  bedroom: { label: 'Camera', floor: 'parquet' },
  kidsroom: { label: 'Cameretta', floor: 'parquet' },
  bath: { label: 'Bagno', floor: 'gres' },
  entrance: { label: 'Ingresso', floor: 'gres' },
  corridor: { label: 'Corridoio', floor: 'parquet' },
  study: { label: 'Studio', floor: 'walnut' },
  storage: { label: 'Ripostiglio', floor: 'concrete' },
  laundry: { label: 'Lavanderia', floor: 'tiles' },
  terrace: { label: 'Terrazzo', floor: 'decking' },
  balcony: { label: 'Balcone', floor: 'cotto' },
  other: { label: 'Stanza', floor: 'parquet' },
};

export const WALL_TYPES = {
  wall: 'Muro',
  railing: 'Ringhiera',
  divider: 'Divisorio',
};

let counter = 0;
export const uid = p => p + Date.now().toString(36).slice(-5) + (counter++).toString(36) + Math.random().toString(36).slice(2, 4);

export const nodeMap = st => new Map(st.nodes.map(n => [n.id, n]));
export const P = n => [n.x, n.z];
export const isCurved = w => Math.abs(w.bulge || 0) >= 0.5;

export function wallEnds(st, w, nm = nodeMap(st)) {
  return [P(nm.get(w.a)), P(nm.get(w.b))];
}
export function wallPathOf(st, w, nm = nodeMap(st)) {
  const [A, B] = wallEnds(st, w, nm);
  return G.wallPath(A, B, w.bulge || 0);
}
export function wallLength(st, w, nm = nodeMap(st)) {
  const [A, B] = wallEnds(st, w, nm);
  const arc = G.arcInfo(A, B, w.bulge || 0);
  return arc ? arc.length : G.dist(A, B);
}
export function wallThickness(st, w) {
  if (w.type === 'divider') return 0;
  return w.t ?? (w.type === 'railing' ? 5 : st.wallT);
}
export function wallHeight(st, w) {
  return w.h ?? (w.type === 'railing' ? 100 : st.wallH);
}
export const degree = (st, id) => st.walls.reduce((n, w) => n + (w.a === id) + (w.b === id), 0);

// Unit direction leaving node `id` along wall w (tangent for curved walls).
export function dirFrom(st, w, id, nm = nodeMap(st)) {
  const path = wallPathOf(st, w, nm);
  const n = path.length;
  return G.norm(w.a === id ? G.sub(path[1], path[0]) : G.sub(path[n - 2], path[n - 1]));
}

// ---------- doors and windows ----------

export function openingFrame(st, it, nm = nodeMap(st)) {
  const w = st.walls.find(x => x.id === it.wall);
  if (!w) return null;
  const [A, B] = wallEnds(st, w, nm);
  const len = G.dist(A, B);
  const d = G.norm(G.sub(B, A));
  const t = Math.min(Math.max(it.t, it.w / 2), Math.max(it.w / 2, len - it.w / 2));
  const p = G.add(A, G.mul(d, t));
  const rotW = (Math.atan2(-d[1], d[0]) * 180) / Math.PI;
  return { x: p[0], z: p[1], rot: (((rotW + (it.flip ? 180 : 0)) % 360) + 360) % 360, t };
}

export function syncOpenings(st) {
  const nm = nodeMap(st);
  st.items = st.items.filter(it => {
    if (!it.wall) return true;
    const f = openingFrame(st, it, nm);
    if (!f) return false;
    Object.assign(it, f);
    return true;
  });
}

// Closest straight, solid wall to p that can hold an opening `w` cm wide.
export function wallSlot(st, p, w, maxDist = Infinity) {
  const nm = nodeMap(st);
  let best = null;
  for (const wall of st.walls) {
    if (wall.type !== 'wall' || isCurved(wall)) continue;
    const [A, B] = wallEnds(st, wall, nm);
    const len = G.dist(A, B);
    if (len < w + 2) continue;
    const r = G.segDist(p, A, B);
    if (r.d > maxDist || (best && r.d >= best.dist)) continue;
    const d = G.norm(G.sub(B, A));
    const t = Math.min(len - w / 2, Math.max(w / 2, Math.round((r.t * len) / 5) * 5));
    // Doors open toward the side the pointer is on.
    const flip = G.dot(G.sub(p, A), G.left(d)) < 0;
    best = { dist: r.d, wall: wall.id, t, flip };
  }
  return best;
}

// ---------- editing the graph ----------

export function splitWall(st, wallId, p) {
  const nm = nodeMap(st);
  const w = st.walls.find(x => x.id === wallId);
  const [A, B] = wallEnds(st, w, nm);
  const arc = G.arcInfo(A, B, w.bulge || 0);
  let q, tSplit, b1 = 0, b2 = 0;
  if (!arc) {
    const r = G.segDist(p, A, B);
    q = r.q;
    tSplit = r.t * G.dist(A, B);
  } else {
    let rel = Math.atan2(p[1] - arc.C[1], p[0] - arc.C[0]) - arc.a0;
    const TAU = 2 * Math.PI;
    rel = arc.sweep > 0 ? ((rel % TAU) + TAU) % TAU : -((((-rel) % TAU) + TAU) % TAU);
    const f = Math.min(0.97, Math.max(0.03, rel / arc.sweep));
    const at = k => [arc.C[0] + Math.cos(arc.a0 + arc.sweep * k) * arc.r, arc.C[1] + Math.sin(arc.a0 + arc.sweep * k) * arc.r];
    q = at(f);
    b1 = G.bulgeThrough(A, q, at(f / 2));
    b2 = G.bulgeThrough(q, B, at((1 + f) / 2));
    tSplit = f * arc.length;
  }
  if (G.dist(q, A) < 1) return w.a;
  if (G.dist(q, B) < 1) return w.b;
  const n = { id: uid('n'), x: round1(q[0]), z: round1(q[1]) };
  st.nodes.push(n);
  const w2 = { ...w, id: uid('w'), a: n.id, bulge: b2 };
  w.b = n.id;
  w.bulge = b1;
  st.walls.push(w2);
  for (const it of st.items) if (it.wall === w.id && it.t > tSplit) { it.wall = w2.id; it.t -= tSplit; }
  return n.id;
}
const round1 = v => Math.round(v * 10) / 10;

// Node at p: an existing corner, a split of a wall passing there, or a new node.
export function ensureNode(st, p, tol = 1) {
  let best = null, bd = tol;
  for (const n of st.nodes) {
    const d = G.dist(p, P(n));
    if (d <= bd) { bd = d; best = n; }
  }
  if (best) return best.id;
  const nm = nodeMap(st);
  for (const w of st.walls) {
    const path = wallPathOf(st, w, nm);
    for (let i = 1; i < path.length; i++) {
      if (G.segDist(p, path[i - 1], path[i]).d <= tol) return splitWall(st, w.id, p);
    }
  }
  const n = { id: uid('n'), x: round1(p[0]), z: round1(p[1]) };
  st.nodes.push(n);
  return n.id;
}

// Draw a straight wall from p to q, joining existing corners and splitting
// the walls it touches or crosses. Returns the id of the end node.
export function addSegment(st, p, q, props = {}, tol = 1) {
  const a = ensureNode(st, p, tol);
  const b = ensureNode(st, q, tol);
  if (a === b) return b;
  let nm = nodeMap(st);
  const A = P(nm.get(a)), B = P(nm.get(b));
  const mids = [];
  for (const w of [...st.walls]) {
    const path = wallPathOf(st, w, nm);
    for (let i = 1; i < path.length; i++) {
      const x = G.segIntersect(A, B, path[i - 1], path[i]);
      if (x) { mids.push({ t: x.t, id: splitWall(st, w.id, x.p) }); nm = nodeMap(st); break; }
    }
  }
  for (const n of st.nodes) {
    if (n.id === a || n.id === b) continue;
    const r = G.segDist(P(n), A, B);
    if (r.d < 0.75 && r.t > 1e-4 && r.t < 1 - 1e-4) mids.push({ t: r.t, id: n.id });
  }
  mids.sort((x, y) => x.t - y.t);
  const chain = [...new Set([a, ...mids.map(m => m.id), b])];
  for (let i = 1; i < chain.length; i++) {
    const u = chain[i - 1], v = chain[i];
    if (st.walls.some(w => (w.a === u && w.b === v) || (w.a === v && w.b === u))) continue;
    st.walls.push({ id: uid('w'), a: u, b: v, type: props.type || 'wall', t: props.t ?? null, h: props.h ?? null, bulge: 0 });
  }
  return b;
}

// Merge corners that ended up on top of each other, drop empty/duplicate walls.
export function cleanup(st, tol = 0.5) {
  const remap = new Map();
  for (let i = 0; i < st.nodes.length; i++) {
    const n = st.nodes[i];
    if (remap.has(n.id)) continue;
    for (let j = i + 1; j < st.nodes.length; j++) {
      const m = st.nodes[j];
      if (!remap.has(m.id) && G.dist(P(n), P(m)) < tol) remap.set(m.id, n.id);
    }
  }
  if (remap.size) {
    st.nodes = st.nodes.filter(n => !remap.has(n.id));
    for (const w of st.walls) { w.a = remap.get(w.a) || w.a; w.b = remap.get(w.b) || w.b; }
  }
  const seen = new Set(), removed = new Set();
  st.walls = st.walls.filter(w => {
    if (w.a === w.b) { removed.add(w.id); return false; }
    const flip = w.a > w.b;
    const k = (flip ? w.b + '|' + w.a : w.a + '|' + w.b) + (isCurved(w) ? ':' + Math.round(flip ? -w.bulge : w.bulge) : '');
    if (seen.has(k)) { removed.add(w.id); return false; }
    seen.add(k);
    return true;
  });
  st.items = st.items.filter(it => !it.wall || !removed.has(it.wall));
  const used = new Set(st.walls.flatMap(w => [w.a, w.b]));
  st.nodes = st.nodes.filter(n => used.has(n.id));
}

export function removeWall(st, id) {
  st.walls = st.walls.filter(w => w.id !== id);
  st.items = st.items.filter(it => it.wall !== id);
  cleanup(st);
}

// Move a straight wall sideways by `delta` cm (along its left normal).
// Where the wall continues straight into another one, a short connecting wall
// is added instead of bending the neighbour, so the other walls stay square.
export function moveWallOp(st, wallId, delta) {
  const w = st.walls.find(x => x.id === wallId);
  if (!w || !delta) return;
  let nm = nodeMap(st);
  const [A, B] = wallEnds(st, w, nm);
  const d = G.norm(G.sub(B, A));
  const off = G.mul(G.left(d), delta);
  for (const end of ['a', 'b']) {
    nm = nodeMap(st);
    const N = nm.get(w[end]);
    const others = st.walls.filter(o => o !== w && (o.a === N.id || o.b === N.id));
    const dirs = new Map(others.map(o => [o, dirFrom(st, o, N.id, nm)]));
    const collinear = others.filter(o => Math.abs(G.cross(dirs.get(o), d)) < 0.03);
    if (!collinear.length) { N.x = round1(N.x + off[0]); N.z = round1(N.z + off[1]); continue; }
    const N2 = { id: uid('n'), x: round1(N.x + off[0]), z: round1(N.z + off[1]) };
    st.nodes.push(N2);
    for (const o of others) {
      if (collinear.includes(o)) continue;
      const proj = G.dot(dirs.get(o), off);
      if (proj <= 0.01 * Math.abs(delta)) continue;
      // This wall points the way we move: it now starts at the new corner.
      if (o.a === N.id) {
        o.a = N2.id;
        for (const it of st.items) if (it.wall === o.id) it.t -= proj;
      } else o.b = N2.id;
    }
    w[end] = N2.id;
    st.walls.push({ id: uid('w'), a: N.id, b: N2.id, type: w.type, t: w.t, h: w.h, bulge: 0 });
  }
  cleanup(st);
}

// A corner can be rounded when exactly two straight walls meet there at an angle.
export function cornerInfo(st, nodeId) {
  const walls = st.walls.filter(w => w.a === nodeId || w.b === nodeId);
  if (walls.length !== 2) return { ok: false, reason: 'Si arrotonda solo un angolo dove si incontrano due muri.' };
  if (walls.some(isCurved)) return { ok: false, reason: 'Uno dei due muri è già curvo.' };
  const nm = nodeMap(st);
  const [d1, d2] = walls.map(w => dirFrom(st, w, nodeId, nm));
  const theta = Math.acos(Math.max(-1, Math.min(1, G.dot(d1, d2))));
  if (theta > Math.PI - 0.02 || theta < 0.05) return { ok: false, reason: 'I due muri sono in linea: non c’è un angolo da arrotondare.' };
  // Space free of doors/windows along each wall, measured from the corner.
  const free = walls.map(w => {
    const len = wallLength(st, w, nm);
    let room = len - 5;
    for (const it of st.items) {
      if (it.wall !== w.id) continue;
      const fromCorner = w.a === nodeId ? it.t - it.w / 2 : len - it.t - it.w / 2;
      room = Math.min(room, fromCorner - 5);
    }
    return Math.max(0, room);
  });
  const maxR = Math.floor(Math.min(...free) * Math.tan(theta / 2));
  return { ok: maxR >= 5, reason: maxR >= 5 ? '' : 'Muri troppo corti (o porte troppo vicine) per arrotondare.', walls, d1, d2, theta, maxR, angle: Math.round((theta * 180) / Math.PI) };
}

// Replace the corner with an arc of radius r tangent to both walls.
export function roundCorner(st, nodeId, r) {
  const info = cornerInfo(st, nodeId);
  if (!info.ok) return false;
  r = Math.min(r, info.maxR);
  if (!(r >= 5)) return false;
  const nm = nodeMap(st);
  const N = P(nm.get(nodeId));
  const t = r / Math.tan(info.theta / 2);
  const p1 = G.add(N, G.mul(info.d1, t)), p2 = G.add(N, G.mul(info.d2, t));
  const [w1, w2] = info.walls;
  const a = splitWall(st, w1.id, p1);
  const b = splitWall(st, w2.id, p2);
  // Drop the two short stubs that reached the old corner.
  st.walls = st.walls.filter(w => !((w.a === nodeId && (w.b === a || w.b === b)) || (w.b === nodeId && (w.a === a || w.a === b))));
  const A = P(nodeMap(st).get(a)), B = P(nodeMap(st).get(b));
  // Sagitta of the arc, bulging toward where the corner was.
  const phi = Math.PI - info.theta;
  const side = Math.sign(G.dot(G.sub(N, A), G.left(G.norm(G.sub(B, A))))) || 1;
  const bulge = side * r * (1 - Math.cos(phi / 2));
  st.walls.push({ id: uid('w'), a, b, type: w1.type, t: w1.t, h: w1.h, bulge });
  cleanup(st);
  return true;
}

export function setWallLength(st, wallId, L) {
  const w = st.walls.find(x => x.id === wallId);
  if (!w || isCurved(w) || !(L > 1)) return false;
  const nm = nodeMap(st);
  const [A, B] = wallEnds(st, w, nm);
  const d = G.norm(G.sub(B, A));
  // Move the free end if there is one, otherwise the end node.
  if (degree(st, w.a) === 1 && degree(st, w.b) > 1) {
    const a = nm.get(w.a);
    a.x = round1(B[0] - d[0] * L); a.z = round1(B[1] - d[1] * L);
  } else {
    const b = nm.get(w.b);
    b.x = round1(A[0] + d[0] * L); b.z = round1(A[1] + d[1] * L);
  }
  return true;
}

// ---------- finding rooms ----------

export function computeFaces(st) {
  const nm = nodeMap(st);
  const adj = new Map(st.nodes.map(n => [n.id, []]));
  const paths = new Map();
  for (const w of st.walls) {
    const path = wallPathOf(st, w, nm);
    paths.set(w.id, path);
    const n = path.length;
    const dA = G.sub(path[1], path[0]), dB = G.sub(path[n - 2], path[n - 1]);
    adj.get(w.a)?.push({ wall: w, other: w.b, ang: Math.atan2(dA[1], dA[0]) });
    adj.get(w.b)?.push({ wall: w, other: w.a, ang: Math.atan2(dB[1], dB[0]) });
  }
  for (const l of adj.values()) l.sort((x, y) => x.ang - y.ang);

  const visited = new Set();
  const faces = [];
  for (const w0 of st.walls) {
    for (const from0 of [w0.a, w0.b]) {
      const key0 = w0.id + '>' + from0;
      if (visited.has(key0)) continue;
      const pts = [], walls = [], nodes = [];
      let w = w0, from = from0, to = from0 === w0.a ? w0.b : w0.a, ok = false;
      for (let guard = 0; guard < 10000; guard++) {
        const key = w.id + '>' + from;
        if (visited.has(key)) { ok = key === key0; break; }
        visited.add(key);
        const path = paths.get(w.id);
        const seq = from === w.a ? path : [...path].reverse();
        for (let i = 0; i < seq.length - 1; i++) pts.push(seq[i]);
        walls.push(w.id);
        nodes.push(from);
        const list = adj.get(to);
        const idx = list.findIndex(e => e.wall === w && e.other === from);
        const next = list[(idx - 1 + list.length) % list.length];
        w = next.wall; from = to; to = next.other;
      }
      if (!ok) continue;
      const clean = G.cleanPoly(pts);
      if (clean.length < 3) continue;
      const a = G.signedArea(clean);
      if (a < 3000) continue; // inner areas wind positive; the outside winds negative
      faces.push({ pts: clean, walls: [...new Set(walls)], nodes: [...new Set(nodes)], area: a });
    }
  }
  return faces;
}

export function newMeta(extra = {}) {
  return { id: uid('r'), name: '', type: 'other', floor: 'parquet', autoName: true, autoType: true, autoFloor: true, anchor: null, ...extra };
}

// Match the closed areas to the saved room settings and fill in automatic
// names, types and floors. `prune` drops settings of rooms that disappeared.
export function syncRooms(st, prune = false) {
  const faces = computeFaces(st).sort((a, b) => b.area - a.area);
  const used = new Set();
  const rooms = [];
  for (const f of faces) {
    let meta = st.rooms.find(m => !used.has(m.id) && m.anchor && G.inPoly(m.anchor[0], m.anchor[1], f.pts));
    if (!meta) { meta = newMeta(); st.rooms.push(meta); }
    used.add(meta.id);
    if (!meta.anchor || !G.inPoly(meta.anchor[0], meta.anchor[1], f.pts) || G.edgeDist(meta.anchor[0], meta.anchor[1], f.pts) < 30) {
      meta.anchor = G.pole(f.pts).map(round1);
    }
    rooms.push({ ...f, id: meta.id, meta });
  }
  if (prune) st.rooms = st.rooms.filter(m => used.has(m.id));
  autoLabel(st, rooms);
  return rooms;
}

const KITCHEN = ['kitchenBase', 'sinkUnit', 'hobUnit', 'fridge'];
const SOFA = ['sofa3', 'sofa2', 'armchair', 'tvStand'];

function autoLabel(st, rooms) {
  const faceCount = new Map();
  for (const r of rooms) for (const w of r.walls) faceCount.set(w, (faceCount.get(w) || 0) + 1);
  const byId = new Map(st.walls.map(w => [w.id, w]));
  const furniture = st.items.filter(it => !it.wall);
  const indoor = rooms.filter(r => !r.walls.some(id => byId.get(id)?.type === 'railing'));
  const largest = indoor.reduce((m, r) => (!m || r.area > m.area ? r : m), null);

  for (const r of rooms) r.contents = furniture.filter(it => G.inPoly(it.x, it.z, r.pts)).map(it => it.type);
  const fixedLiving = rooms.some(r => !r.meta.autoType && r.meta.type === 'living');
  for (const r of rooms) {
    const m = r.meta;
    if (m.autoType) m.type = guessType(st, r, { byId, faceCount, largest: fixedLiving ? null : largest });
    if (m.autoFloor) m.floor = ROOM_TYPES[m.type]?.floor || 'parquet';
  }
  // Names the user typed count too, so a new room never repeats one.
  const taken = new Set(rooms.filter(r => !r.meta.autoName).map(r => r.meta.name));
  for (const r of rooms) {
    const m = r.meta;
    if (!m.autoName) continue;
    let base = ROOM_TYPES[m.type]?.label || 'Stanza';
    if (m.type === 'living' && r.contents.some(t => KITCHEN.includes(t))) base = 'Soggiorno con cucina';
    let name = base;
    for (let i = 2; taken.has(name); i++) name = `${base} ${i}`;
    taken.add(name);
    m.name = name;
  }
}

function guessType(st, r, { byId, faceCount, largest }) {
  const has = (...types) => types.some(t => r.contents.includes(t));
  const walls = r.walls.map(id => byId.get(id)).filter(Boolean);
  const m2 = r.area / 10000;
  if (walls.some(w => w.type === 'railing')) return m2 < 6 ? 'balcony' : 'terrace';
  if (has('toilet', 'bidet', 'shower', 'bathtub', 'washbasin')) return 'bath';
  if (has(...KITCHEN)) return has(...SOFA) ? 'living' : 'kitchen';
  if (has('bed2')) return 'bedroom';
  if (has('bed1')) return 'kidsroom';
  if (has(...SOFA)) return 'living';
  if (has('desk', 'officeChair')) return 'study';
  if (has('washer') && m2 < 8) return 'laundry';
  const per = G.perimeter(r.pts);
  const width = (2 * r.area) / per;
  const elongated = (per * per) / r.area > 24;
  const entrance = st.items.some(it => it.wall && ['door', 'door90'].includes(it.type) && r.walls.includes(it.wall) && faceCount.get(it.wall) === 1);
  if (m2 < 3) return 'storage';
  if (entrance && m2 < 12) return 'entrance';
  // A small area cut off by an invisible divider is usually the entrance.
  if (m2 < 12 && walls.some(w => w.type === 'divider')) return 'entrance';
  if (elongated && width < 110) return 'corridor';
  if (r === largest) return 'living';
  if (m2 < 6.5) return 'bath';
  return 'bedroom';
}

export function typeFromName(name = '') {
  const n = name.toLowerCase();
  const rules = [
    [/soggiorno|living|open space|salotto/, 'living'], [/cucin/, 'kitchen'], [/cameretta/, 'kidsroom'],
    [/camera|matrimonial|zona notte/, 'bedroom'], [/bagno|wc/, 'bath'], [/ingresso/, 'entrance'],
    [/corridoio|disimpegno/, 'corridor'], [/studio/, 'study'], [/ripost/, 'storage'], [/lavanderia/, 'laundry'],
    [/terrazz/, 'terrace'], [/balcon/, 'balcony'],
  ];
  return rules.find(([re]) => re.test(n))?.[1] || 'other';
}

// Move a whole room: its corners, its furniture and its doors/windows.
export function moveRoom(st, room, dx, dz) {
  const ids = new Set(room.nodes);
  for (const n of st.nodes) if (ids.has(n.id)) { n.x = round1(n.x + dx); n.z = round1(n.z + dz); }
  for (const it of st.items) if (!it.wall && G.inPoly(it.x, it.z, room.pts)) { it.x += dx; it.z += dz; }
  if (room.meta.anchor) room.meta.anchor = [room.meta.anchor[0] + dx, room.meta.anchor[1] + dz];
}

// Delete a room: remove the walls that only it uses.
export function deleteRoom(st, room, rooms) {
  const shared = new Set(rooms.filter(r => r !== room).flatMap(r => r.walls));
  const drop = new Set(room.walls.filter(id => !shared.has(id)));
  st.walls = st.walls.filter(w => !drop.has(w.id));
  st.items = st.items.filter(it => !it.wall || !drop.has(it.wall));
  st.rooms = st.rooms.filter(m => m.id !== room.id);
  cleanup(st);
}

// ---------- old saves and generated layouts (rooms as rectangles / polygons) ----------

export function fromRooms(data, isOpeningType) {
  const rect = (x, z, w, d) => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
  const polys = (data.rooms || []).map(r => ({
    r,
    pts: Array.isArray(r.pts) && r.pts.length >= 3 ? r.pts.map(p => [+p[0] || 0, +p[1] || 0]) : rect(+r.x || 0, +r.z || 0, +r.w || 300, +r.d || 300),
  }));
  const st = {
    name: data.name, wallH: data.wallH, wallT: data.wallT, snap: data.snap,
    nodes: [], walls: [], rooms: [], items: [],
  };
  const byKey = new Map();
  const nodeAt = p => {
    const k = Math.round(p[0]) + ',' + Math.round(p[1]);
    if (!byKey.has(k)) { const n = { id: uid('n'), x: round1(p[0]), z: round1(p[1]) }; byKey.set(k, n); st.nodes.push(n); }
    return byKey.get(k);
  };
  for (const { pts } of polys) pts.forEach(nodeAt);
  const pairs = new Set();
  for (const { pts } of polys) {
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i], B = pts[(i + 1) % pts.length];
      const on = st.nodes.map(n => ({ n, ...G.segDist(P(n), A, B) })).filter(o => o.d < 0.6).sort((x, y) => x.t - y.t);
      for (let j = 1; j < on.length; j++) {
        const u = on[j - 1].n, v = on[j].n;
        if (u === v) continue;
        const k = u.id < v.id ? u.id + '|' + v.id : v.id + '|' + u.id;
        if (pairs.has(k)) continue;
        pairs.add(k);
        st.walls.push({ id: uid('w'), a: u.id, b: v.id, type: 'wall', t: null, h: null, bulge: 0 });
      }
    }
  }
  // Walls that only border terraces become railings.
  const outdoor = r => r.terrace || /terrazz|balcon/i.test(r.name || '');
  const nm = nodeMap(st);
  for (const w of st.walls) {
    const [A, B] = wallEnds(st, w, nm);
    const M = G.mul(G.add(A, B), 0.5), n = G.left(G.norm(G.sub(B, A)));
    const sides = [G.add(M, G.mul(n, 2)), G.add(M, G.mul(n, -2))].map(p => polys.find(o => G.inPoly(p[0], p[1], o.pts)));
    if (sides.some(s => s && outdoor(s.r)) && sides.every(s => !s || outdoor(s.r))) w.type = 'railing';
  }
  for (const { r, pts } of polys) {
    const type = r.type || (r.terrace ? 'terrace' : typeFromName(r.name));
    st.rooms.push(newMeta({
      name: r.name || ROOM_TYPES[type].label, type, floor: r.floor || ROOM_TYPES[type].floor,
      autoName: false, autoType: false, autoFloor: !r.floor, anchor: G.pole(pts).map(round1),
    }));
  }
  for (const src of data.items || []) {
    const it = { ...src };
    if (isOpeningType(it.type)) {
      const p = [+it.x || 0, +it.z || 0];
      const th = ((+it.rot || 0) * Math.PI) / 180;
      const ax = [Math.cos(th), -Math.sin(th)], az = [Math.sin(th), Math.cos(th)];
      let best = null;
      for (const w of st.walls) {
        const [A, B] = wallEnds(st, w, nm);
        const d = G.norm(G.sub(B, A));
        if (Math.abs(G.dot(d, ax)) < 0.99) continue;
        const r = G.segDist(p, A, B);
        if (r.d < 2 && (!best || r.d < best.d)) best = { d: r.d, w, t: r.t * G.dist(A, B), flip: G.dot(az, G.left(d)) < 0 };
      }
      if (!best) continue;
      Object.assign(it, { wall: best.w.id, t: best.t, flip: best.flip });
    }
    st.items.push(it);
  }
  return st;
}
