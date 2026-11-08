import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CATALOG, TYPES, SWATCHES, buildModel } from './catalog.js';
import { FLOORS, TILE_M, floorTexture } from './textures.js';
import { PRESETS } from './presets.js';
import { createWizard } from './wizard.js';

// All state values are in centimeters; the 3D scene works in meters (cm / 100).
// Rooms are orthogonal polygons (`pts`, list of [x, z] corners), so they can be
// rectangles, L-shapes and so on. Walls are generated from the room edges.

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORAGE_KEY = 'planner-casa-3d-v1';
const SEL = 0x2f6fde;
const BAD = 0xe5484d;
const THUMBS = {};

let state;
let selection = null; // { kind: 'item' | 'room', id }
let wallMode = 'auto';
let tab = 'furniture';
let walls = [];
const history = { stack: [], index: -1 };

// ---------- polygon helpers ----------

const rectPts = (x, z, w, d) => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];

function roomBox(r) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of r.pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return { x: x0, z: z0, w: x1 - x0, d: z1 - z0 };
}
const isRect = r => r.pts.length === 4;

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function edgeDist(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)));
  }
  return best;
}

// The point deepest inside the room: where its label goes.
function roomPole(r) {
  const b = roomBox(r);
  let best = null, bd = -1;
  const N = 16;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = b.x + ((i + 0.5) / N) * b.w, z = b.z + ((j + 0.5) / N) * b.d;
    if (!inPoly(x, z, r.pts)) continue;
    const d = edgeDist(x, z, r.pts);
    if (d > bd) { bd = d; best = { x, z }; }
  }
  return best || { x: b.x + b.w / 2, z: b.z + b.d / 2 };
}

function edgeOf(P, Q) {
  if (Math.abs(P[1] - Q[1]) < 0.5) return { o: 'h', c: P[1], lo: Math.min(P[0], Q[0]), hi: Math.max(P[0], Q[0]) };
  if (Math.abs(P[0] - Q[0]) < 0.5) return { o: 'v', c: P[0], lo: Math.min(P[1], Q[1]), hi: Math.max(P[1], Q[1]) };
  return null;
}
const alongOf = (p, o) => (o === 'h' ? p[0] : p[1]);
const near = (a, b) => Math.abs(a - b) < 0.5;

// Drop duplicate and collinear corners.
function simplify(pts) {
  const p = pts.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]);
  for (let changed = true; changed && p.length > 3;) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      const dup = near(a[0], b[0]) && near(a[1], b[1]);
      const col = (near(a[0], b[0]) && near(b[0], c[0])) || (near(a[1], b[1]) && near(b[1], c[1]));
      if (dup || col) { p.splice(i, 1); changed = true; break; }
    }
  }
  return p;
}

function validPoly(pts) {
  const n = pts.length;
  if (n < 4 || polyArea(pts) < 5000) return false;
  const E = [];
  for (let i = 0; i < n; i++) {
    const e = edgeOf(pts[i], pts[(i + 1) % n]);
    if (!e) return false;
    E.push(e);
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = E[i], b = E[j];
      if (a.o === b.o) {
        if (near(a.c, b.c) && Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > -0.5) return false;
      } else {
        const h = a.o === 'h' ? a : b, v = a.o === 'h' ? b : a;
        if (v.c >= h.lo - 0.5 && v.c <= h.hi + 0.5 && h.c >= v.lo - 0.5 && h.c <= v.hi + 0.5) return false;
      }
    }
  }
  return true;
}

// Move the stretch [a, b] of the wall line (o, c) by `delta`, perpendicular to it.
// Edges that only partly overlap the stretch get split, which creates a step.
function shiftPiece(pts, o, c, a, b, delta) {
  const n = pts.length;
  const E = pts.map((P, i) => edgeOf(P, pts[(i + 1) % n]));
  const hits = e => e && e.o === o && near(e.c, c) && Math.min(e.hi, b) - Math.max(e.lo, a) > 0.5;
  const out = [];
  for (let i = 0; i < n; i++) {
    const P = pts[i], Q = pts[(i + 1) % n];
    const al = alongOf(P, o);
    out.push({ p: [...P], mv: (hits(E[i]) || hits(E[(i - 1 + n) % n])) && al >= a - 0.5 && al <= b + 0.5 });
    if (!hits(E[i])) continue;
    const ql = alongOf(Q, o), dir = Math.sign(ql - al);
    const cuts = [a, b].filter(t => t > Math.min(al, ql) + 0.5 && t < Math.max(al, ql) - 0.5).sort((m, k) => dir * (m - k));
    for (const t of cuts) {
      const pt = o === 'h' ? [t, c] : [c, t];
      const entering = dir > 0 ? t === a : t === b;
      out.push({ p: [...pt], mv: !entering }, { p: [...pt], mv: entering });
    }
  }
  return out.map(({ p, mv }) => {
    if (mv) { if (o === 'h') p[1] += delta; else p[0] += delta; }
    return p;
  });
}

// One wall move applied to every room (rooms sharing the wall stay attached)
// and to the doors/windows sitting on it. Returns null if a room would break.
function moveWall(base, o, c, a, b, delta) {
  const rooms = base.rooms.map(pts => simplify(shiftPiece(pts, o, c, a, b, delta)));
  if (!rooms.every(validPoly)) return null;
  const ops = base.ops.map(op => {
    const it = getItem(op.id);
    const orient = openingOrient(it);
    const perp = orient === 'h' ? op.z : op.x, al = orient === 'h' ? op.x : op.z;
    if (orient !== o || !near(perp, c) || al < a - 0.5 || al > b + 0.5) return op;
    return o === 'h' ? { ...op, z: op.z + delta } : { ...op, x: op.x + delta };
  });
  return { rooms, ops };
}

function snapshot() {
  return {
    rooms: state.rooms.map(r => r.pts.map(p => [...p])),
    ops: state.items.filter(isOpening).map(i => ({ id: i.id, x: i.x, z: i.z })),
  };
}
function applySnapshot(s) {
  state.rooms.forEach((r, i) => { r.pts = s.rooms[i]; });
  for (const op of s.ops) { const it = getItem(op.id); it.x = op.x; it.z = op.z; }
}

// ---------- state helpers ----------

let uidCounter = 0;
const newId = () => (Date.now() + uidCounter++).toString(36) + Math.random().toString(36).slice(2, 5);
const getItem = id => state.items.find(i => i.id === id);
const getRoom = id => state.rooms.find(r => r.id === id);
const isOpening = it => TYPES[it.type].opening;
const isDoor = it => ['door', 'arch'].includes(TYPES[it.type].build);

function normalize(s) {
  s = s && typeof s === 'object' ? s : {};
  const out = {
    name: String(s.name || 'Il mio appartamento'),
    wallH: +s.wallH || 270,
    wallT: +s.wallT || 10,
    snap: +s.snap || 5,
    rooms: (Array.isArray(s.rooms) ? s.rooms : []).map(r => {
      let pts = Array.isArray(r.pts) && r.pts.length >= 4 ? r.pts.map(p => [+p[0] || 0, +p[1] || 0]) : null;
      if (!pts) pts = rectPts(+r.x || 0, +r.z || 0, Math.max(50, +r.w || 300), Math.max(50, +r.d || 300));
      pts = simplify(pts);
      return { id: r.id || newId(), name: String(r.name || 'Stanza'), floor: FLOORS[r.floor] ? r.floor : 'parquet', pts };
    }).filter(r => validPoly(r.pts)),
    items: (Array.isArray(s.items) ? s.items : []).filter(i => TYPES[i?.type]).map(i => {
      const t = TYPES[i.type];
      return {
        id: i.id || newId(), type: i.type, x: +i.x || 0, z: +i.z || 0,
        rot: (((+i.rot || 0) % 360) + 360) % 360,
        w: +i.w || t.w, d: +i.d || t.d, h: +i.h || t.h,
        elev: i.elev != null ? +i.elev : t.elev, color: i.color || t.color,
      };
    }),
  };
  for (const it of out.items) if (TYPES[it.type].opening) it.d = out.wallT;
  return out;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}
function loadSaved() {
  try { const t = localStorage.getItem(STORAGE_KEY); return t ? JSON.parse(t) : null; } catch { return null; }
}

function commit() {
  const snap = JSON.stringify(state);
  if (history.stack[history.index] === snap) return;
  history.stack.length = history.index + 1;
  history.stack.push(snap);
  if (history.stack.length > 150) history.stack.shift();
  history.index = history.stack.length - 1;
  save();
  updateUndoButtons();
}

function restore(snap) {
  state = JSON.parse(snap);
  if (selection && !(selection.kind === 'item' ? getItem(selection.id) : getRoom(selection.id))) selection = null;
  rebuildAll();
  save();
  updateUndoButtons();
}
function undo() { if (history.index > 0) restore(history.stack[--history.index]); }
function redo() { if (history.index < history.stack.length - 1) restore(history.stack[++history.index]); }
function updateUndoButtons() {
  $('#undoBtn').disabled = history.index <= 0;
  $('#redoBtn').disabled = history.index >= history.stack.length - 1;
}

function bounds() {
  if (!state.rooms.length) return { minX: 0, maxX: 4, minZ: 0, maxZ: 4, cx: 2, cz: 2, w: 4, d: 4 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of state.rooms) for (const [x, z] of r.pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const b = { minX: minX / 100, maxX: maxX / 100, minZ: minZ / 100, maxZ: maxZ / 100 };
  b.w = b.maxX - b.minX; b.d = b.maxZ - b.minZ;
  b.cx = (b.minX + b.maxX) / 2; b.cz = (b.minZ + b.maxZ) / 2;
  return b;
}

const roomAt = p => state.rooms.find(r => inPoly(p.x, p.z, r.pts));
const areaM2 = r => (polyArea(r.pts) / 10000).toFixed(1).replace('.', ',');
const fmtM = cm => (cm / 100).toFixed(2).replace('.', ',');
const wallTop = () => (wallMode === 'low' ? Math.min(state.wallH, 45) : state.wallH);

// ---------- three.js setup ----------

const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const canvas = renderer.domElement;
canvas.id = 'scene';
viewport.prepend(canvas);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
viewport.insertBefore(labelRenderer.domElement, canvas.nextSibling);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e7eaee');
scene.add(new THREE.HemisphereLight('#ffffff', '#b8b0a4', 1.5));
const sun = new THREE.DirectionalLight('#fff4e2', 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: '#dde1e5', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(80, 160, '#c3cad1', '#d3d9de');
grid.position.y = -0.006;
scene.add(grid);

const floorsG = new THREE.Group();
const wallsG = new THREE.Group();
const itemsG = new THREE.Group();
const overlayG = new THREE.Group();
const handlesG = new THREE.Group();
const hoverG = new THREE.Group();
scene.add(floorsG, wallsG, itemsG, overlayG, handlesG, hoverG);
const itemObjs = new Map();

const persp = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
let orthoHalf = 5;
let camera = persp;
let controls;
let view3d = null;

function makeControls() {
  controls?.dispose();
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;
  if (camera === ortho) {
    controls.enableRotate = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.minZoom = 0.2;
    controls.maxZoom = 12;
  } else {
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 0.8;
    controls.maxDistance = 70;
  }
}

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  updateOrtho();
}
function updateOrtho() {
  const a = viewport.clientWidth / Math.max(1, viewport.clientHeight);
  ortho.left = -orthoHalf * a; ortho.right = orthoHalf * a;
  ortho.top = orthoHalf; ortho.bottom = -orthoHalf;
  ortho.updateProjectionMatrix();
}

function fitView() {
  const b = bounds();
  if (camera === persp) {
    const s = Math.max(b.w, b.d);
    controls.target.set(b.cx, 0, b.cz);
    persp.position.set(b.cx + s * 0.25, s * 0.95 + 1.5, b.cz + s * 0.95 + 1.5);
  } else {
    const a = viewport.clientWidth / Math.max(1, viewport.clientHeight);
    orthoHalf = Math.max(b.d / 2, b.w / 2 / a) * 1.15 + 0.5;
    ortho.zoom = 1;
    updateOrtho();
    ortho.position.set(b.cx, 50, b.cz + 0.001);
    controls.target.set(b.cx, 0, b.cz);
  }
  controls.update();
}

function setView(v) {
  if (camera === persp) view3d = { pos: persp.position.clone(), target: controls.target.clone() };
  camera = v === '2d' ? ortho : persp;
  makeControls();
  if (v === '3d' && view3d) {
    persp.position.copy(view3d.pos);
    controls.target.copy(view3d.target);
    controls.update();
  } else fitView();
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  sun.castShadow = v !== '2d'; // shadows only clutter the floor plan
}

function updateSun() {
  const b = bounds();
  const s = Math.max(b.w, b.d) / 2 + 3;
  sun.position.set(b.cx - s * 0.6, s * 1.6 + 4, b.cz + s * 0.9);
  sun.target.position.set(b.cx, 0, b.cz);
  const c = sun.shadow.camera;
  c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 0.5; c.far = s * 6 + 10;
  c.updateProjectionMatrix();
}

// ---------- building the scene ----------

function clearGroup(g, keepMaterials = false) {
  g.traverse(o => {
    o.geometry?.dispose();
    if (!keepMaterials && o.material) {
      for (const m of [].concat(o.material)) { m.map?.dispose(); m.dispose(); }
    }
  });
  while (g.children.length) g.remove(g.children[0]);
}

const shapeOf = pts => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x / 100, -z / 100)));

function rebuildRooms() {
  clearGroup(floorsG);
  for (const r of state.rooms) {
    const tex = floorTexture(r.floor).clone();
    tex.repeat.set(1 / TILE_M, 1 / TILE_M);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(r.pts)), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.002;
    m.receiveShadow = true;
    m.userData = { kind: 'room', id: r.id };
    floorsG.add(m);

    const b = roomBox(r);
    const el = document.createElement('div');
    el.className = 'room-label';
    el.innerHTML = `<b>${esc(r.name)}</b><span>${isRect(r) ? `${fmtM(b.w)} × ${fmtM(b.d)} m · ` : ''}${areaM2(r)} m²</span>`;
    const lbl = new CSS2DObject(el);
    const p = roomPole(r);
    lbl.position.set(p.x / 100, 0.05, p.z / 100);
    floorsG.add(lbl);
  }
}

// Merge room edges into wall segments so shared walls are built once.
function computeWalls() {
  const lines = new Map();
  for (const r of state.rooms) {
    for (let i = 0; i < r.pts.length; i++) {
      const e = edgeOf(r.pts[i], r.pts[(i + 1) % r.pts.length]);
      if (!e) continue;
      const k = e.o + ':' + Math.round(e.c * 10);
      if (!lines.has(k)) lines.set(k, { o: e.o, c: e.c, segs: [] });
      lines.get(k).segs.push([e.lo, e.hi]);
    }
  }
  const out = [];
  for (const L of lines.values()) {
    L.segs.sort((p, q) => p[0] - q[0]);
    let cur = null;
    for (const s of L.segs) {
      if (cur && s[0] <= cur[1] + 0.5) cur[1] = Math.max(cur[1], s[1]);
      else { if (cur) out.push({ orient: L.o, c: L.c, a: cur[0], b: cur[1] }); cur = [...s]; }
    }
    if (cur) out.push({ orient: L.o, c: L.c, a: cur[0], b: cur[1] });
  }
  return out;
}

const openingOrient = it => (Math.round(it.rot / 90) % 2 === 0 ? 'h' : 'v');
function onWall(it, w) {
  if (openingOrient(it) !== w.orient) return false;
  const perp = w.orient === 'h' ? it.z : it.x;
  const al = w.orient === 'h' ? it.x : it.z;
  return Math.abs(perp - w.c) < 1 && al >= w.a - 1 && al <= w.b + 1;
}

function rebuildWalls() {
  clearGroup(wallsG);
  walls = computeWalls();
  const T = state.wallT;
  const H = wallTop();
  const openings = state.items.filter(isOpening);
  for (const w of walls) {
    const side = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.92 });
    const top = new THREE.MeshStandardMaterial({ color: '#4f565e', roughness: 0.9 });
    const mats = [side, side, top, side, side, side];
    const ops = openings.filter(o => onWall(o, w)).map(o => {
      const al = w.orient === 'h' ? o.x : o.z;
      return { s: Math.max(w.a, al - o.w / 2), e: Math.min(w.b, al + o.w / 2), y0: o.elev, y1: o.elev + o.h };
    }).sort((p, q) => p.s - q.s);

    const pieces = [];
    let cur = w.a - T / 2; // walls reach into the corners
    for (const op of ops) {
      if (op.s > cur) pieces.push([cur, op.s, 0, H]);
      const s = Math.max(cur, op.s);
      if (op.y0 > 0) pieces.push([s, op.e, 0, Math.min(op.y0, H)]);
      if (op.y1 < H) pieces.push([s, op.e, Math.max(op.y1, 0), H]);
      cur = Math.max(cur, op.e);
    }
    if (w.b + T / 2 > cur) pieces.push([cur, w.b + T / 2, 0, H]);

    const g = new THREE.Group();
    g.userData = { kind: 'wall', orient: w.orient, c: w.c, a: w.a, b: w.b, mats: [side, top], faded: false };
    for (const [s, e, y0, y1] of pieces) {
      if (e - s < 0.5 || y1 - y0 < 0.5) continue;
      const len = (e - s) / 100, hh = (y1 - y0) / 100, t = T / 100, mid = (s + e) / 200;
      const m = new THREE.Mesh(w.orient === 'h' ? new THREE.BoxGeometry(len, hh, t) : new THREE.BoxGeometry(t, hh, len), mats);
      if (w.orient === 'h') m.position.set(mid, (y0 + y1) / 200, w.c / 100);
      else m.position.set(w.c / 100, (y0 + y1) / 200, mid);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    wallsG.add(g);
  }
}

// IKEA-style cutaway: walls between the camera and the middle of the home fade out.
function updateWallFade() {
  const auto = wallMode === 'auto' && camera === persp;
  const b = bounds();
  const p = camera.position;
  for (const g of wallsG.children) {
    const { orient, c } = g.userData;
    let fade = false;
    if (auto) {
      const line = c / 100;
      const cam = (orient === 'h' ? p.z : p.x) - line;
      const mid = (orient === 'h' ? b.cz : b.cx) - line;
      fade = Math.abs(cam) > 0.05 && (Math.sign(cam) !== Math.sign(mid) || Math.abs(mid) < 0.05);
    }
    if (fade === g.userData.faded) continue;
    g.userData.faded = fade;
    for (const m of g.userData.mats) {
      m.transparent = fade;
      m.opacity = fade ? 0.13 : 1;
      m.depthWrite = !fade;
      m.needsUpdate = true;
    }
    for (const ch of g.children) ch.castShadow = !fade;
  }
}

function placeObj(o, it) {
  o.position.set(it.x / 100, it.elev / 100, it.z / 100);
  o.rotation.y = THREE.MathUtils.degToRad(it.rot);
}

function makeItemObj(it) {
  const o = buildModel(it);
  placeObj(o, it);
  o.userData = { kind: 'item', id: it.id };
  if (wallMode === 'low' && isOpening(it)) o.traverse(c => { if (c.userData.tall) c.visible = false; });
  return o;
}

function rebuildItems() {
  clearGroup(itemsG, true);
  itemObjs.clear();
  for (const it of state.items) {
    const o = makeItemObj(it);
    itemsG.add(o);
    itemObjs.set(it.id, o);
  }
}

function refreshItem(it) {
  const old = itemObjs.get(it.id);
  if (old) { old.traverse(c => c.geometry?.dispose()); itemsG.remove(old); }
  const o = makeItemObj(it);
  itemsG.add(o);
  itemObjs.set(it.id, o);
  if (isOpening(it)) rebuildWalls();
  updateOverlay();
}

function rebuildGeometry() {
  rebuildRooms();
  rebuildWalls();
  for (const it of state.items) if (isOpening(it)) placeObj(itemObjs.get(it.id), it);
  updateOverlay();
}

function rebuildAll() {
  rebuildRooms();
  rebuildWalls();
  rebuildItems();
  updateOverlay();
  updateSun();
  renderProps();
  renderRoomsTab();
  renderList();
  $('#projectName').value = state.name;
}

// ---------- collisions + overlay ----------

function corners(it, pad = 0) {
  const hw = it.w / 2 - pad, hd = it.d / 2 - pad;
  const a = THREE.MathUtils.degToRad(it.rot), c = Math.cos(a), s = Math.sin(a);
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [it.x + x * c + z * s, it.z - x * s + z * c]);
}

function overlap(A, B) {
  for (const P of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % 4];
      const nx = z2 - z1, nz = x1 - x2;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [x, z] of A) { const p = x * nx + z * nz; a0 = Math.min(a0, p); a1 = Math.max(a1, p); }
      for (const [x, z] of B) { const p = x * nx + z * nz; b0 = Math.min(b0, p); b1 = Math.max(b1, p); }
      if (a1 <= b0 || b1 <= a0) return false;
    }
  }
  return true;
}

function findConflicts() {
  const bad = new Set();
  const T2 = state.wallT / 2;
  const list = state.items.filter(i => !isOpening(i) && !TYPES[i.type].noCollide);
  const polys = list.map(i => corners(i, 0.5));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (A.elev >= B.elev + B.h || B.elev >= A.elev + A.h) continue;
      if (overlap(polys[i], polys[j])) { bad.add(A.id); bad.add(B.id); }
    }
    const inside = polys[i].every(([x, z]) => state.rooms.some(r => inPoly(x, z, r.pts) && edgeDist(x, z, r.pts) >= T2 - 0.6));
    if (!inside) bad.add(list[i].id);
  }
  return bad;
}

const overlayMats = {
  bad: new THREE.MeshBasicMaterial({ color: BAD, transparent: true, opacity: 0.35, depthWrite: false }),
  sel: new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  handle: new THREE.MeshBasicMaterial({ color: SEL, depthTest: false }),
  handleIn: new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
  hover: new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.45, depthWrite: false }),
};
const handleGeo = new THREE.SphereGeometry(0.09, 20, 12);
const handleInGeo = new THREE.SphereGeometry(0.055, 16, 10);

function footprint(it, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(it.w / 100, Math.max(it.d, 4) / 100), mat);
  m.rotation.set(-Math.PI / 2, 0, THREE.MathUtils.degToRad(it.rot));
  m.position.set(it.x / 100, 0.012, it.z / 100);
  m.renderOrder = 2;
  return m;
}

function clearOverlay(g) {
  g.traverse(o => {
    if (o.geometry && o.geometry !== handleGeo && o.geometry !== handleInGeo) o.geometry.dispose();
    if (o.material?.isLineBasicMaterial) o.material.dispose();
  });
  while (g.children.length) g.remove(g.children[0]);
}

function updateOverlay() {
  clearOverlay(overlayG);
  clearOverlay(handlesG);
  const conflicts = findConflicts();
  for (const id of conflicts) overlayG.add(footprint(getItem(id), overlayMats.bad));

  if (selection?.kind === 'item') {
    const it = getItem(selection.id);
    if (it) {
      const bad = conflicts.has(it.id);
      if (!bad) overlayG.add(footprint(it, overlayMats.sel));
      const box = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(it.w / 100 + 0.02, it.h / 100 + 0.02, Math.max(it.d, 4) / 100 + 0.02)),
        new THREE.LineBasicMaterial({ color: bad ? BAD : SEL }),
      );
      box.position.set(it.x / 100, (it.elev + it.h / 2) / 100, it.z / 100);
      box.rotation.y = THREE.MathUtils.degToRad(it.rot);
      overlayG.add(box);
      const el = document.createElement('div');
      el.className = 'dim-label' + (bad ? ' bad' : '');
      el.textContent = isOpening(it) ? `${Math.round(it.w)} × ${Math.round(it.h)} cm` : `${Math.round(it.w)} × ${Math.round(it.d)} × ${Math.round(it.h)} cm`;
      const lbl = new CSS2DObject(el);
      lbl.position.set(it.x / 100, (it.elev + it.h) / 100 + 0.12, it.z / 100);
      overlayG.add(lbl);
    }
  }
  if (selection?.kind === 'room') {
    const r = getRoom(selection.id);
    if (r) roomEditOverlay(r);
  }

  const st = $('#status');
  st.hidden = conflicts.size === 0;
  st.textContent = conflicts.size === 1
    ? '⚠ 1 mobile si sovrappone ad altro o esce dai muri'
    : `⚠ ${conflicts.size} mobili si sovrappongono o escono dai muri`;
}

// Selected room: blue fill, a handle on every corner and an editable length on every side.
function roomEditOverlay(r) {
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(r.pts)), overlayMats.sel);
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.01;
  overlayG.add(fill);

  const y = wallTop() / 100 + 0.03;
  const n = r.pts.length;
  r.pts.forEach(([x, z], k) => {
    const h = new THREE.Mesh(handleGeo, overlayMats.handle);
    h.position.set(x / 100, y, z / 100);
    h.renderOrder = 10;
    h.userData = { kind: 'handle', room: r.id, k };
    const inner = new THREE.Mesh(handleInGeo, overlayMats.handleIn);
    inner.renderOrder = 11;
    inner.raycast = () => {};
    h.add(inner);
    handlesG.add(h);
  });

  for (let i = 0; i < n; i++) {
    const P = r.pts[i], Q = r.pts[(i + 1) % n];
    const e = edgeOf(P, Q);
    if (!e || e.hi - e.lo < 25) continue;
    const mx = (P[0] + Q[0]) / 2, mz = (P[1] + Q[1]) / 2;
    // Put the label just inside the room.
    const nx = e.o === 'v' ? 1 : 0, nz = e.o === 'h' ? 1 : 0;
    const s = inPoly(mx + nx * 2, mz + nz * 2, r.pts) ? 1 : -1;
    const el = document.createElement('div');
    el.className = 'edge-label';
    const canSplit = e.hi - e.lo >= 120;
    el.innerHTML = `<input type="number" min="30" step="5" value="${Math.round(e.hi - e.lo)}" title="Lunghezza del lato (cm)"><em>cm</em>`
      + (canSplit ? `<button type="button" title="Crea una rientranza a metà di questo lato (forma a L)">⊕</button>` : '');
    el.querySelector('input').addEventListener('change', ev => setEdgeLength(r.id, i, parseFloat(ev.target.value)));
    el.querySelector('input').addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.target.blur(); });
    el.querySelector('button')?.addEventListener('click', () => splitEdge(r.id, i));
    const lbl = new CSS2DObject(el);
    lbl.position.set((mx + nx * s * 32) / 100, y, (mz + nz * s * 32) / 100);
    overlayG.add(lbl);
  }
}

// ---------- room shape editing ----------

function commitShape(res) {
  if (!res) return false;
  applySnapshot(res);
  rebuildGeometry();
  return true;
}

function setEdgeLength(roomId, i, L) {
  const ri = state.rooms.findIndex(r => r.id === roomId);
  const pts = state.rooms[ri]?.pts;
  if (!pts || !isFinite(L)) return updateOverlay();
  const n = pts.length;
  const P = pts[i], Q = pts[(i + 1) % n], R = pts[(i + 2) % n];
  const e = edgeOf(P, Q), en = edgeOf(Q, R);
  const delta = (Math.max(30, L) - (e.hi - e.lo)) * Math.sign(alongOf(Q, e.o) - alongOf(P, e.o));
  if (commitShape(moveWall(snapshot(), en.o, en.c, en.lo, en.hi, delta))) { commit(); afterShapeChange(); }
  else { updateOverlay(); toast('Questa misura non è possibile: la stanza si incrocerebbe con se stessa.'); }
}

function splitEdge(roomId, i) {
  const r = getRoom(roomId);
  const n = r.pts.length;
  const e = edgeOf(r.pts[i], r.pts[(i + 1) % n]);
  const mid = Math.round((e.lo + e.hi) / 2 / 5) * 5;
  const probe = (e.hi + mid) / 2;
  const s = (e.o === 'h' ? inPoly(probe, e.c + 2, r.pts) : inPoly(e.c + 2, probe, r.pts)) ? 1 : -1;
  for (const depth of [60, 40, 20]) {
    if (commitShape(moveWall(snapshot(), e.o, e.c, mid, e.hi, s * depth))) { commit(); afterShapeChange(); return; }
  }
  toast('Lato troppo corto per una rientranza.');
}

function afterShapeChange() {
  updateSun();
  renderProps();
  renderRoomsTab();
}

// The stretch of wall between two junctions (corners of any room on that line).
function wallPiece(data, al, whole) {
  const { orient: o, c, a, b } = data;
  if (whole) return [a, b];
  const js = new Set([a, b]);
  for (const r of state.rooms) for (const p of r.pts) {
    const perp = o === 'h' ? p[1] : p[0], t = alongOf(p, o);
    if (near(perp, c) && t > a + 0.5 && t < b - 0.5) js.add(t);
  }
  const arr = [...js].sort((x, y) => x - y);
  for (let i = 0; i < arr.length - 1; i++) if (al >= arr[i] - 0.5 && al <= arr[i + 1] + 0.5) return [arr[i], arr[i + 1]];
  return [a, b];
}

function showHover(o, c, a, b) {
  clearOverlay(hoverG);
  if (o == null) return;
  const T = state.wallT / 100 + 0.05, H = wallTop() / 100 + 0.02, len = (b - a) / 100;
  const m = new THREE.Mesh(o === 'h' ? new THREE.BoxGeometry(len, H, T) : new THREE.BoxGeometry(T, H, len), overlayMats.hover);
  const mid = (a + b) / 200;
  if (o === 'h') m.position.set(mid, H / 2, c / 100); else m.position.set(c / 100, H / 2, mid);
  m.renderOrder = 5;
  hoverG.add(m);
}

// ---------- snapping ----------

const snapTo = (v, g) => Math.round(v / g) * g;

function snapOpening(px, pz, it) {
  let best = null;
  for (const w of walls) {
    if (w.b - w.a < it.w) continue;
    const pAlong = w.orient === 'h' ? px : pz, pPerp = w.orient === 'h' ? pz : px;
    const al = Math.min(w.b - it.w / 2, Math.max(w.a + it.w / 2, snapTo(pAlong, 5)));
    const dist = Math.hypot(pAlong - al, pPerp - w.c);
    if (!best || dist < best.dist) {
      // Doors swing toward the side the pointer is on.
      const side = pPerp >= w.c;
      best = {
        dist,
        x: w.orient === 'h' ? al : w.c,
        z: w.orient === 'h' ? w.c : al,
        rot: w.orient === 'h' ? (side ? 0 : 180) : (side ? 90 : 270),
      };
    }
  }
  return best;
}

// Pull furniture flush against a wall face when it gets close.
function snapToWalls(it, x, z) {
  const q = Math.round(it.rot / 90);
  if (Math.abs(it.rot - q * 90) > 0.01) return [x, z];
  const ex = (q % 2 ? it.d : it.w) / 2, ez = (q % 2 ? it.w : it.d) / 2;
  const T2 = state.wallT / 2, SN = 12;
  let sx = false, sz = false;
  for (const w of walls) {
    if (w.orient === 'v' && !sx && z + ez > w.a && z - ez < w.b) {
      if (Math.abs(x - ex - (w.c + T2)) < SN) { x = w.c + T2 + ex; sx = true; }
      else if (Math.abs(x + ex - (w.c - T2)) < SN) { x = w.c - T2 - ex; sx = true; }
    }
    if (w.orient === 'h' && !sz && x + ex > w.a && x - ex < w.b) {
      if (Math.abs(z - ez - (w.c + T2)) < SN) { z = w.c + T2 + ez; sz = true; }
      else if (Math.abs(z + ez - (w.c - T2)) < SN) { z = w.c - T2 - ez; sz = true; }
    }
  }
  return [x, z];
}

// Snap a coordinate to the grid, or to a nearby corner coordinate of another room.
function snapCoord(v, axis, exclude, free) {
  if (free) return Math.round(v);
  let best = snapTo(v, state.snap), bd = 8;
  for (const r of state.rooms) for (const p of r.pts) {
    const t = p[axis];
    if (exclude?.(t)) continue;
    if (Math.abs(t - v) < bd) { bd = Math.abs(t - v); best = t; }
  }
  return best;
}

// ---------- picking + dragging ----------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmpV = new THREE.Vector3();

function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function floorPoint() {
  const p = raycaster.ray.intersectPlane(floorPlane, tmpV);
  return p ? { x: p.x * 100, z: p.z * 100 } : null;
}
function isVisible(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function pick() {
  const hh = raycaster.intersectObjects(handlesG.children, false)[0];
  if (hh) return { kind: 'handle', ...hh.object.userData };
  const hits = raycaster.intersectObjects([...itemsG.children, ...wallsG.children], true);
  for (const h of hits) {
    if (!isVisible(h.object)) continue;
    let o = h.object;
    while (o && !o.userData.kind) o = o.parent;
    if (!o) continue;
    if (o.userData.kind === 'wall') {
      if (o.userData.faded) continue;
      return { kind: 'wall', data: o.userData, point: { x: h.point.x * 100, z: h.point.z * 100 } };
    }
    if (o.userData.kind === 'item') return { kind: 'item', id: o.userData.id };
  }
  return null;
}
function pickRoom() {
  const hits = raycaster.intersectObjects(floorsG.children.filter(o => o.isMesh), false);
  return hits[0]?.object.userData.id ?? null;
}

let drag = null;
let down = null;

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY };
  setRay(e);
  const p = floorPoint();
  if (!p) return;
  const hit = pick();
  if (hit?.kind === 'handle') {
    const ri = state.rooms.findIndex(r => r.id === hit.room);
    drag = { kind: 'corner', ri, k: hit.k, V: [...state.rooms[ri].pts[hit.k]], base: snapshot(), moved: false };
  } else if (hit?.kind === 'item') {
    select({ kind: 'item', id: hit.id });
    const it = getItem(hit.id);
    drag = { kind: 'item', id: hit.id, off: { x: it.x - p.x, z: it.z - p.z }, moved: false };
  } else if (hit?.kind === 'wall' && tab === 'rooms') {
    const d = hit.data;
    const al = d.orient === 'h' ? hit.point.x : hit.point.z;
    const [a, b] = wallPiece(d, al, e.shiftKey);
    drag = { kind: 'wall', o: d.orient, c: d.c, a, b, p0: d.orient === 'h' ? p.z : p.x, base: snapshot(), moved: false };
  } else if (tab === 'rooms') {
    const rid = pickRoom();
    if (!rid) return;
    select({ kind: 'room', id: rid });
    const r = getRoom(rid);
    const T2 = state.wallT / 2 + 1;
    const carried = state.items
      .filter(i => inPoly(i.x, i.z, r.pts) || edgeDist(i.x, i.z, r.pts) < T2)
      .map(i => ({ id: i.id, x: i.x, z: i.z }));
    drag = { kind: 'room', id: rid, start: r.pts.map(q => [...q]), p0: p, carried, moved: false };
  } else return;
  controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
}, { capture: true });

canvas.addEventListener('pointermove', e => {
  setRay(e);
  if (!drag) return hover(e);
  const p = floorPoint();
  if (!p) return;
  if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 3) return;
  drag.moved = true;
  if (drag.kind === 'item') dragItem(p, e.altKey);
  else if (drag.kind === 'room') dragRoom(p, e.altKey);
  else if (drag.kind === 'wall') dragWall(p, e.altKey);
  else if (drag.kind === 'corner') dragCorner(p, e.altKey);
});

function hover(e) {
  if (e.buttons) return;
  const hit = pick();
  if (hit?.kind === 'handle') { canvas.style.cursor = 'move'; showHover(); return; }
  if (hit?.kind === 'wall' && tab === 'rooms') {
    const d = hit.data;
    const [a, b] = wallPiece(d, d.orient === 'h' ? hit.point.x : hit.point.z, e.shiftKey);
    showHover(d.orient, d.c, a, b);
    canvas.style.cursor = d.orient === 'h' ? 'ns-resize' : 'ew-resize';
    return;
  }
  showHover();
  canvas.style.cursor = hit?.kind === 'item' ? 'grab' : '';
}

function endPointer(e) {
  if (drag) {
    const { moved, kind } = drag;
    drag = null;
    controls.enabled = true;
    showHover();
    if (moved) {
      commit();
      renderProps(); renderList(); renderRoomsTab();
      if (kind !== 'item') updateSun();
    } else if (kind === 'wall' && e.type === 'pointerup') select(null);
    down = null;
    return;
  }
  if (e.type === 'pointerup' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) select(null);
  down = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!drag) showHover(); });

function dragItem(p, free) {
  const it = getItem(drag.id);
  if (isOpening(it)) {
    const s = snapOpening(p.x, p.z, it);
    if (s) { it.x = s.x; it.z = s.z; it.rot = s.rot; }
    placeObj(itemObjs.get(it.id), it);
    rebuildWalls();
  } else {
    let x = p.x + drag.off.x, z = p.z + drag.off.z;
    if (!free) {
      x = snapTo(x, state.snap); z = snapTo(z, state.snap);
      [x, z] = snapToWalls(it, x, z);
    }
    it.x = x; it.z = z;
    placeObj(itemObjs.get(it.id), it);
  }
  updateOverlay();
}

function dragRoom(p, free) {
  const r = getRoom(drag.id);
  let dx = p.x - drag.p0.x, dz = p.z - drag.p0.z;
  if (!free) {
    dx = snapTo(dx, 10); dz = snapTo(dz, 10);
    // Snap the room's corners to the corners of the other rooms.
    const others = state.rooms.filter(o => o !== r).flatMap(o => o.pts);
    const best = (d, axis) => {
      let fix = Infinity;
      for (const q of drag.start) for (const o of others) {
        const f = o[axis] - (q[axis] + d);
        if (Math.abs(f) < Math.abs(fix)) fix = f;
      }
      return Math.abs(fix) < 20 ? d + fix : d;
    };
    dx = best(dx, 0); dz = best(dz, 1);
  }
  r.pts = drag.start.map(([x, z]) => [x + dx, z + dz]);
  for (const c of drag.carried) {
    const it = getItem(c.id);
    it.x = c.x + dx; it.z = c.z + dz;
  }
  rebuildRooms();
  rebuildWalls();
  for (const c of drag.carried) placeObj(itemObjs.get(c.id), getItem(c.id));
  updateOverlay();
}

function dragWall(p, free) {
  const raw = drag.c + ((drag.o === 'h' ? p.z : p.x) - drag.p0);
  const target = snapCoord(raw, drag.o === 'h' ? 1 : 0, t => near(t, drag.c), free);
  const res = moveWall(drag.base, drag.o, drag.c, drag.a, drag.b, target - drag.c);
  if (commitShape(res)) showHover(drag.o, target, drag.a, drag.b);
}

function dragCorner(p, free) {
  const { base, ri, k, V } = drag;
  const exclude = (axis) => t => near(t, V[axis]);
  const dx = snapCoord(p.x, 0, exclude(0), free) - V[0];
  const dz = snapCoord(p.z, 1, exclude(1), free) - V[1];
  const pts = base.rooms[ri], n = pts.length;
  const ea = edgeOf(pts[(k - 1 + n) % n], V), eb = edgeOf(V, pts[(k + 1) % n]);
  const eh = ea?.o === 'h' ? ea : eb, ev = ea?.o === 'v' ? ea : eb;
  if (!eh || !ev || eh.o !== 'h' || ev.o !== 'v') return;
  let res = base;
  if (dz) res = moveWall(res, 'h', eh.c, eh.lo, eh.hi, dz);
  if (res && dx) {
    // Find the vertical side through the (possibly moved) corner.
    const rp = res.rooms[ri], m = rp.length, z = V[1] + dz;
    let e = null;
    for (let i = 0; i < m && !e; i++) {
      const ed = edgeOf(rp[i], rp[(i + 1) % m]);
      if (ed?.o === 'v' && near(ed.c, V[0]) && z >= ed.lo - 0.5 && z <= ed.hi + 0.5) e = ed;
    }
    res = e ? moveWall(res, 'v', e.c, e.lo, e.hi, dx) : null;
  }
  commitShape(res);
}

// Drop from the catalog onto the floor.
viewport.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
viewport.addEventListener('drop', e => {
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain');
  if (!TYPES[type]) return;
  setRay(e);
  addItem(type, floorPoint());
});

// ---------- actions ----------

function select(sel) {
  selection = sel;
  updateOverlay();
  renderProps();
  document.querySelectorAll('[data-select]').forEach(el => el.classList.toggle('on', !!sel && el.dataset.select === sel.id));
}

function defaultSpot() {
  const sr = selection?.kind === 'room' && getRoom(selection.id);
  if (sr) return roomPole(sr);
  const t = { x: controls.target.x * 100, z: controls.target.z * 100 };
  if (roomAt(t)) return t;
  return state.rooms[0] ? roomPole(state.rooms[0]) : t;
}

function addItem(type, at) {
  const t = TYPES[type];
  const it = { id: newId(), type, x: 0, z: 0, rot: 0, w: t.w, d: t.d, h: t.h, elev: t.elev, color: t.color };
  if (t.opening) it.d = state.wallT;
  const p = at || defaultSpot();
  const s = t.opening && snapOpening(p.x, p.z, it);
  if (s) Object.assign(it, { x: s.x, z: s.z, rot: s.rot });
  else { it.x = snapTo(p.x, state.snap); it.z = snapTo(p.z, state.snap); }
  state.items.push(it);
  refreshItem(it);
  select({ kind: 'item', id: it.id });
  commit();
  renderList();
}

function deleteSelection() {
  if (!selection) return;
  if (selection.kind === 'item') {
    const it = getItem(selection.id);
    state.items = state.items.filter(i => i.id !== selection.id);
    selection = null;
    rebuildItems();
    if (it && isOpening(it)) rebuildWalls();
  } else {
    const r = getRoom(selection.id);
    if (!r || !confirm(`Eliminare la stanza "${r.name}"? I mobili restano dove sono.`)) return;
    state.rooms = state.rooms.filter(x => x !== r);
    selection = null;
    rebuildRooms();
    rebuildWalls();
    updateSun();
    renderRoomsTab();
  }
  updateOverlay();
  renderProps();
  renderList();
  commit();
}

function duplicateSelection() {
  if (selection?.kind !== 'item') return;
  const src = getItem(selection.id);
  const it = { ...src, id: newId() };
  if (isOpening(it)) {
    const off = it.w + 20;
    const s = openingOrient(it) === 'h' ? snapOpening(it.x + off, it.z, it) : snapOpening(it.x, it.z + off, it);
    if (s) Object.assign(it, { x: s.x, z: s.z, rot: s.rot });
  } else { it.x += 20; it.z += 20; }
  state.items.push(it);
  refreshItem(it);
  select({ kind: 'item', id: it.id });
  commit();
  renderList();
}

function rotateSelection(delta) {
  if (selection?.kind !== 'item') return;
  const it = getItem(selection.id);
  it.rot = (((it.rot + (isOpening(it) ? 180 : delta)) % 360) + 360) % 360;
  placeObj(itemObjs.get(it.id), it);
  updateOverlay();
  renderProps();
  commit();
}

function nudge(dx, dz) {
  if (selection?.kind !== 'item') return;
  const it = getItem(selection.id);
  if (isOpening(it)) {
    if (openingOrient(it) === 'h') it.x += dx || dz; else it.z += dz || dx;
    refreshItem(it);
  } else {
    it.x += dx; it.z += dz;
    placeObj(itemObjs.get(it.id), it);
    updateOverlay();
  }
  renderProps();
  commit();
}

function addRoom() {
  const b = bounds();
  const n = state.rooms.length + 1;
  const x = state.rooms.length ? Math.round(b.maxX * 100) : 0, z = state.rooms.length ? Math.round(b.minZ * 100) : 0;
  const r = { id: newId(), name: `Stanza ${n}`, floor: 'parquet', pts: rectPts(x, z, 300, 300) };
  state.rooms.push(r);
  rebuildRooms();
  rebuildWalls();
  updateSun();
  select({ kind: 'room', id: r.id });
  renderRoomsTab();
  commit();
}

function startProject(data, guided) {
  state = normalize(structuredClone(data));
  selection = null;
  view3d = null;
  rebuildAll();
  commit();
  if (guided) {
    setTab('rooms');
    setView('2d');
    view3d = null; // the next switch to 3D frames the new home
    $('#coach').hidden = false;
  } else {
    setView(camera === ortho ? '2d' : '3d');
    fitView();
  }
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- UI: catalog ----------

function renderCatalog(filter = '') {
  const f = filter.trim().toLowerCase();
  const html = CATALOG.map(c => {
    const items = c.items.filter(i => !f || i.name.toLowerCase().includes(f) || c.cat.toLowerCase().includes(f));
    if (!items.length) return '';
    return `<h4>${c.cat}</h4><div class="cards">${items.map(i => `
      <button class="card" draggable="true" data-add="${i.type}" title="Clicca per aggiungere, o trascina nella stanza">
        <img data-thumb="${i.type}" src="${THUMBS[i.type] || ''}" alt="">
        <span>${i.name}</span><small>${i.w}×${i.opening ? i.h : i.d} cm</small>
      </button>`).join('')}</div>`;
  }).join('');
  $('#catalog').innerHTML = html || '<p class="empty">Nessun risultato.</p>';
}

$('#catalog').addEventListener('click', e => {
  const b = e.target.closest('[data-add]');
  if (b) { addItem(b.dataset.add); closeSidebarOnMobile(); }
});
$('#catalog').addEventListener('dragstart', e => {
  const b = e.target.closest('[data-add]');
  if (b) e.dataTransfer.setData('text/plain', b.dataset.add);
});
$('#search').addEventListener('input', e => renderCatalog(e.target.value));

function makeThumbs() {
  const size = 128;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#9a9590', 2.2));
  const dl = new THREE.DirectionalLight('#ffffff', 1.6);
  dl.position.set(2, 4, 3);
  sc.add(dl);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  const dir = new THREE.Vector3(0.85, 0.7, 1.3).normalize();
  const list = Object.values(TYPES);
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < list.length && performance.now() - t0 < 14) {
      const t = list[i++];
      const g = buildModel(t);
      sc.add(g);
      const box = new THREE.Box3().setFromObject(g);
      const c = box.getCenter(new THREE.Vector3());
      const rad = box.getSize(new THREE.Vector3()).length() / 2;
      cam.position.copy(c).addScaledVector(dir, rad / Math.sin(THREE.MathUtils.degToRad(14)) * 0.92);
      cam.lookAt(c);
      r.render(sc, cam);
      THUMBS[t.type] = r.domElement.toDataURL();
      sc.remove(g);
      g.traverse(o => o.geometry?.dispose());
      document.querySelectorAll(`img[data-thumb="${t.type}"]`).forEach(img => { img.src = THUMBS[t.type]; });
    }
    if (i < list.length) requestAnimationFrame(step);
    else { r.dispose(); r.forceContextLoss(); }
  };
  step();
}

// ---------- UI: properties panel ----------

const numField = (k, label, v, unit = 'cm', step = 1) =>
  `<label class="field"><span>${label}</span><div class="unit"><input type="number" data-k="${k}" value="${Math.round(v * 10) / 10}" step="${step}"><em>${unit}</em></div></label>`;

function renderProps() {
  const el = $('#props');
  if (!selection) { el.hidden = true; return; }
  if (selection.kind === 'item') {
    const it = getItem(selection.id);
    if (!it) { el.hidden = true; return; }
    const t = TYPES[it.type];
    el.innerHTML = `
      <div class="props-head">
        <img data-thumb="${it.type}" src="${THUMBS[it.type] || ''}" alt="">
        <div><h3>${t.name}</h3><small>${t.cat}</small></div>
        <button class="x" data-act="close" title="Chiudi (Esc)">×</button>
      </div>
      <div class="fields">
        ${numField('w', 'Larghezza', it.w)}
        ${t.opening ? '' : numField('d', 'Profondità', it.d)}
        ${numField('h', 'Altezza', it.h)}
        ${isDoor(it) ? '' : numField('elev', 'Da terra', it.elev)}
        ${numField('x', 'Posizione X', it.x)}
        ${numField('z', 'Posizione Z', it.z)}
      </div>
      ${t.opening
        ? `<div class="field"><span>Verso</span><div class="row"><button data-rot="180">⇄ Inverti apertura</button></div></div>`
        : `<div class="field"><span>Rotazione</span><div class="row rot">
            <button data-rot="-90" title="Ruota 90° (Shift+R)">↺ 90°</button>
            <button data-rot="-15">−15°</button>
            <div class="unit"><input type="number" data-k="rot" value="${Math.round(it.rot)}" step="15"><em>°</em></div>
            <button data-rot="15">+15°</button>
            <button data-rot="90" title="Ruota 90° (R)">↻ 90°</button>
          </div></div>`}
      <div class="field"><span>Colore</span><div class="swatches">
        ${SWATCHES.map(c => `<button class="sw${c === it.color ? ' on' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
        <input type="color" data-k="color" value="${it.color}" title="Colore personalizzato">
      </div></div>
      <div class="actions">
        <button data-act="dup">Duplica <kbd>Ctrl D</kbd></button>
        <button data-act="del" class="danger">Elimina <kbd>Canc</kbd></button>
      </div>`;
  } else {
    const r = getRoom(selection.id);
    if (!r) { el.hidden = true; return; }
    const b = roomBox(r);
    el.innerHTML = `
      <div class="props-head">
        <div class="room-ico">▦</div>
        <div><h3>Stanza</h3><small>${areaM2(r)} m² · ${isRect(r) ? 'rettangolare' : `${r.pts.length} angoli`}</small></div>
        <button class="x" data-act="close" title="Chiudi (Esc)">×</button>
      </div>
      <label class="field"><span>Nome</span><input type="text" data-k="name" value="${esc(r.name)}"></label>
      <label class="field"><span>Pavimento</span><select data-k="floor">
        ${Object.entries(FLOORS).map(([k, v]) => `<option value="${k}"${k === r.floor ? ' selected' : ''}>${v}</option>`).join('')}
      </select></label>
      <div class="fields">
        ${isRect(r) ? numField('w', 'Larghezza', b.w) + numField('d', 'Profondità', b.d) : ''}
        ${numField('x', 'Posizione X', b.x)}
        ${numField('z', 'Posizione Z', b.z)}
      </div>
      <div class="howto">
        <div><i class="dot-h"></i><span>Trascina i <b>pallini</b> sugli angoli per allargare o stringere la stanza.</span></div>
        <div><i class="ico">↔</i><span>Nella scheda <b>Stanze</b> trascina un <b>muro</b> per spostarlo (con <kbd>Shift</kbd> tutto il muro).</span></div>
        <div><i class="ico">⌗</i><span>Clicca una <b>misura</b> sul lato per scriverla in cm.</span></div>
        <div><i class="ico">⊕</i><span>Crea una <b>rientranza</b> su un lato per fare stanze a L.</span></div>
      </div>
      <div class="actions">
        ${isRect(r) ? '' : '<button data-act="rect">Rendi rettangolare</button>'}
        <button data-act="del" class="danger">Elimina stanza</button>
      </div>`;
  }
  el.hidden = false;
}

function applyProp(k, raw, live = false) {
  if (selection?.kind === 'item') {
    const it = getItem(selection.id);
    if (k === 'color') it.color = raw;
    else {
      let v = parseFloat(raw);
      if (!isFinite(v)) return renderProps();
      if (['w', 'd', 'h'].includes(k)) v = Math.min(2000, Math.max(1, v));
      if (k === 'elev') v = Math.max(0, v);
      if (k === 'rot') v = ((v % 360) + 360) % 360;
      it[k] = v;
      if (isOpening(it) && (k === 'x' || k === 'z' || k === 'w')) {
        const s = snapOpening(it.x, it.z, it);
        if (s) Object.assign(it, { x: s.x, z: s.z, rot: openingOrient(s) === openingOrient(it) ? it.rot : s.rot });
      }
    }
    refreshItem(it);
    if (!live) { commit(); renderProps(); renderList(); }
  } else if (selection?.kind === 'room') {
    const r = getRoom(selection.id);
    const b = roomBox(r);
    if (k === 'name') r.name = raw.trim() || 'Stanza';
    else if (k === 'floor') r.floor = raw;
    else {
      const v = parseFloat(raw);
      if (!isFinite(v)) return renderProps();
      if (k === 'w') r.pts = rectPts(b.x, b.z, Math.min(5000, Math.max(50, v)), b.d);
      if (k === 'd') r.pts = rectPts(b.x, b.z, b.w, Math.min(5000, Math.max(50, v)));
      if (k === 'x') r.pts = r.pts.map(([x, z]) => [x + v - b.x, z]);
      if (k === 'z') r.pts = r.pts.map(([x, z]) => [x, z + v - b.z]);
    }
    rebuildRooms();
    rebuildWalls();
    updateSun();
    updateOverlay();
    commit();
    renderProps();
    renderRoomsTab();
  }
}

$('#props').addEventListener('change', e => {
  const k = e.target.dataset.k;
  if (k) applyProp(k, e.target.value);
});
$('#props').addEventListener('input', e => {
  if (e.target.dataset.k === 'color') applyProp('color', e.target.value, true);
});
$('#props').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.rot) rotateSelection(+b.dataset.rot);
  else if (b.dataset.color) applyProp('color', b.dataset.color);
  else if (b.dataset.act === 'close') select(null);
  else if (b.dataset.act === 'del') deleteSelection();
  else if (b.dataset.act === 'dup') duplicateSelection();
  else if (b.dataset.act === 'rect') {
    const r = getRoom(selection.id), bx = roomBox(r);
    r.pts = rectPts(bx.x, bx.z, bx.w, bx.d);
    rebuildGeometry();
    commit();
    afterShapeChange();
  }
});

// ---------- UI: rooms tab ----------

function renderRoomsTab() {
  const total = state.rooms.reduce((s, r) => s + polyArea(r.pts), 0) / 10000;
  $('#tab-rooms').innerHTML = `
    <div class="block">
      <h4>Stanze <small>${state.rooms.length} · ${total.toFixed(1).replace('.', ',')} m²</small></h4>
      <ul class="rows">${state.rooms.map(r => {
        const b = roomBox(r);
        return `<li data-select="${r.id}" class="${selection?.id === r.id ? 'on' : ''}">
          <i class="floor-dot f-${r.floor}"></i>
          <span><b>${esc(r.name)}</b><small>${isRect(r) ? `${fmtM(b.w)} × ${fmtM(b.d)} m` : 'forma a L / libera'} · ${areaM2(r)} m²</small></span>
        </li>`;
      }).join('')}</ul>
      <button class="wide" id="addRoomBtn">＋ Aggiungi stanza</button>
      <div class="howto">
        <div><i class="ico">↔</i><span>Trascina un <b>muro</b>: le stanze vicine si adattano. Con <kbd>Shift</kbd> sposti il muro intero.</span></div>
        <div><i class="dot-h"></i><span>Seleziona una stanza e trascina i <b>pallini</b> sugli angoli, o scrivi le <b>misure</b> dei lati.</span></div>
        <div><i class="ico">✥</i><span>Trascina un <b>pavimento</b> per spostare la stanza con i suoi mobili. <kbd>Alt</kbd> = senza aggancio.</span></div>
      </div>
    </div>
    <div class="block">
      <h4>Appartamento</h4>
      <div class="fields">
        ${numField('wallH', 'Altezza muri', state.wallH)}
        ${numField('wallT', 'Spessore muri', state.wallT)}
        ${numField('snap', 'Griglia', state.snap)}
      </div>
    </div>
    <div class="block">
      <h4>Ricomincia</h4>
      <div class="presets">
        <button data-act="wizard" class="primary-soft">✦ Crea la tua casa…</button>
        ${PRESETS.map(p => `<button data-preset="${p.id}">${p.name}</button>`).join('')}
      </div>
    </div>`;
}

$('#tab-rooms').addEventListener('click', e => {
  const li = e.target.closest('[data-select]');
  if (li) { select({ kind: 'room', id: li.dataset.select }); return; }
  if (e.target.closest('#addRoomBtn')) addRoom();
  if (e.target.closest('[data-act=wizard]')) wizard.open();
  const p = e.target.closest('[data-preset]');
  if (p) {
    const preset = PRESETS.find(x => x.id === p.dataset.preset);
    if (confirm(`Caricare "${preset.name}"? Il progetto attuale verrà sostituito (puoi annullare con Ctrl+Z).`)) startProject(preset.data, false);
  }
});
$('#tab-rooms').addEventListener('change', e => {
  const k = e.target.dataset.k;
  const v = parseFloat(e.target.value);
  if (!k || !isFinite(v)) return;
  if (k === 'wallH') state.wallH = Math.min(600, Math.max(60, v));
  if (k === 'wallT') {
    state.wallT = Math.min(60, Math.max(2, v));
    for (const it of state.items) if (isOpening(it)) it.d = state.wallT;
  }
  if (k === 'snap') state.snap = Math.min(50, Math.max(1, v));
  rebuildWalls();
  rebuildItems();
  updateOverlay();
  renderRoomsTab();
  commit();
});

// ---------- UI: list tab ----------

function renderList() {
  const order = Object.keys(TYPES);
  const items = [...state.items].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  $('#tab-list').innerHTML = `
    <div class="block">
      <h4>Riepilogo</h4>
      <div class="stats">
        <div><b>${state.rooms.length}</b><span>stanze</span></div>
        <div><b>${(state.rooms.reduce((s, r) => s + polyArea(r.pts), 0) / 10000).toFixed(1).replace('.', ',')}</b><span>m²</span></div>
        <div><b>${state.items.length}</b><span>elementi</span></div>
      </div>
    </div>
    <div class="block">
      <h4>Elementi nel progetto</h4>
      ${items.length ? `<ul class="rows">${items.map(it => {
        const t = TYPES[it.type];
        const room = roomAt(it);
        return `<li data-select="${it.id}" class="${selection?.id === it.id ? 'on' : ''}">
          <img data-thumb="${it.type}" src="${THUMBS[it.type] || ''}" alt="">
          <span><b>${t.name}</b><small>${Math.round(it.w)}×${Math.round(t.opening ? it.h : it.d)} cm${room ? ' · ' + esc(room.name) : ''}</small></span>
          <i class="dot" style="background:${it.color}"></i>
        </li>`;
      }).join('')}</ul>` : '<p class="empty">Ancora nessun mobile. Aggiungine uno dalla scheda Mobili.</p>'}
    </div>`;
}
$('#tab-list').addEventListener('click', e => {
  const li = e.target.closest('[data-select]');
  if (li) select({ kind: 'item', id: li.dataset.select });
});

// ---------- UI: top bar, tabs, keyboard ----------

function setTab(name) {
  tab = name;
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-' + name));
  document.body.classList.toggle('rooms-mode', name === 'rooms');
  showHover();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
$('#wallMode').addEventListener('change', e => {
  wallMode = e.target.value;
  rebuildWalls();
  rebuildItems();
  updateOverlay();
});
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#fitBtn').addEventListener('click', fitView);
$('#newBtn').addEventListener('click', () => wizard.open());
$('#projectName').addEventListener('change', e => { state.name = e.target.value.trim() || 'Il mio appartamento'; commit(); });
$('#coach').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  $('#coach').hidden = true;
  if (b.dataset.act === '3d') { setView('3d'); setTab('furniture'); }
});

const slug = () => state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'planner';
function download(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
$('#photoBtn').addEventListener('click', () => {
  overlayG.visible = handlesG.visible = false;
  renderer.render(scene, camera);
  download(canvas.toDataURL('image/png'), slug() + '.png');
  overlayG.visible = handlesG.visible = true;
});
$('#exportBtn').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  download(url, slug() + '.json');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#importInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    startProject(JSON.parse(await f.text()), false);
  } catch {
    alert('File non valido: serve un progetto esportato da questo planner (.json).');
  }
});

function closeSidebarOnMobile() { if (matchMedia('(max-width: 820px)').matches) document.body.classList.remove('sidebar-open'); }
$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));

window.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && k === 'y') { e.preventDefault(); redo(); }
  else if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelection(); }
  else if (k === 'r' && !mod) rotateSelection(e.shiftKey ? -90 : 90);
  else if (k === 'escape') select(null);
  else if (k.startsWith('arrow') && selection?.kind === 'item') {
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    nudge(k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0);
  }
});

// ---------- start ----------

const wizard = createWizard({
  onCreate: home => startProject(home, true),
  onPreset: id => startProject(PRESETS.find(p => p.id === id).data, false),
  onImport: () => $('#importInput').click(),
});

const saved = loadSaved();
state = normalize(saved || structuredClone(PRESETS[0].data));
makeControls();
new ResizeObserver(resize).observe(viewport);
resize();
renderCatalog();
rebuildAll();
fitView();
commit();
makeThumbs();
if (!saved) wizard.open();

renderer.setAnimationLoop(() => {
  controls.update();
  updateWallFade();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

// Handy for debugging from the browser console.
window.planner = { get state() { return state; }, get camera() { return camera; }, select, addItem, setView, setTab, undo, wizard, startProject, findConflicts };
