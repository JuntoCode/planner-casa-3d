import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CATALOG, TYPES, SWATCHES, buildModel } from './catalog.js';
import { FLOORS, TILE_M, floorTexture } from './textures.js';
import { PRESETS } from './presets.js';

// All state values are in centimeters; the 3D scene works in meters (cm / 100).

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

// ---------- state helpers ----------

let uidCounter = 0;
const newId = () => (Date.now() + uidCounter++).toString(36) + Math.random().toString(36).slice(2, 5);
const getItem = id => state.items.find(i => i.id === id);
const getRoom = id => state.rooms.find(r => r.id === id);
const isOpening = it => TYPES[it.type].opening;
const isDoor = it => TYPES[it.type].build === 'door';

function normalize(s) {
  s = s && typeof s === 'object' ? s : {};
  const out = {
    name: String(s.name || 'Il mio appartamento'),
    wallH: +s.wallH || 270,
    wallT: +s.wallT || 10,
    snap: +s.snap || 5,
    rooms: (Array.isArray(s.rooms) ? s.rooms : []).map(r => ({
      id: r.id || newId(), name: String(r.name || 'Stanza'),
      x: +r.x || 0, z: +r.z || 0, w: Math.max(50, +r.w || 300), d: Math.max(50, +r.d || 300),
      floor: FLOORS[r.floor] ? r.floor : 'parquet',
    })),
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
  for (const it of out.items) if (isOpening(it)) it.d = out.wallT;
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
  for (const r of state.rooms) {
    minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.w);
    minZ = Math.min(minZ, r.z); maxZ = Math.max(maxZ, r.z + r.d);
  }
  const b = { minX: minX / 100, maxX: maxX / 100, minZ: minZ / 100, maxZ: maxZ / 100 };
  b.w = b.maxX - b.minX; b.d = b.maxZ - b.minZ;
  b.cx = (b.minX + b.maxX) / 2; b.cz = (b.minZ + b.maxZ) / 2;
  return b;
}

const roomAt = p => state.rooms.find(r => p.x >= r.x && p.x <= r.x + r.w && p.z >= r.z && p.z <= r.z + r.d);

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
scene.add(floorsG, wallsG, itemsG, overlayG);
const itemObjs = new Map();

const persp = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
let orthoHalf = 5;
let camera = persp;
let controls;
let target3d = null;

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
    orthoHalf = Math.max(b.d / 2, b.w / 2 / a) * 1.12 + 0.4;
    ortho.zoom = 1;
    updateOrtho();
    ortho.position.set(b.cx, 50, b.cz + 0.001);
    controls.target.set(b.cx, 0, b.cz);
  }
  controls.update();
}

function setView(v) {
  if (camera === persp) target3d = { pos: persp.position.clone(), target: controls.target.clone() };
  camera = v === '2d' ? ortho : persp;
  makeControls();
  if (v === '3d' && target3d) {
    persp.position.copy(target3d.pos);
    controls.target.copy(target3d.target);
    controls.update();
  } else fitView();
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  document.body.classList.toggle('plan', v === '2d');
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

function rebuildRooms() {
  clearGroup(floorsG);
  for (const r of state.rooms) {
    const w = r.w / 100, d = r.d / 100;
    const tex = floorTexture(r.floor).clone();
    tex.repeat.set(w / TILE_M, d / TILE_M);
    tex.offset.set(r.x / 100 / TILE_M, r.z / 100 / TILE_M);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((r.x + r.w / 2) / 100, 0.002, (r.z + r.d / 2) / 100);
    m.receiveShadow = true;
    m.userData = { kind: 'room', id: r.id };
    floorsG.add(m);

    const el = document.createElement('div');
    el.className = 'room-label';
    el.innerHTML = `<b>${esc(r.name)}</b><span>${fmtM(r.w)} × ${fmtM(r.d)} m · ${(r.w * r.d / 10000).toFixed(1).replace('.', ',')} m²</span>`;
    const lbl = new CSS2DObject(el);
    lbl.position.set((r.x + r.w / 2) / 100, 0.05, (r.z + r.d / 2) / 100);
    floorsG.add(lbl);
  }
}
const fmtM = cm => (cm / 100).toFixed(2).replace('.', ',');

// Merge room edges into wall segments so shared walls are built once.
function computeWalls() {
  const lines = new Map();
  const add = (orient, c, a, b) => {
    const k = orient + ':' + Math.round(c * 10);
    if (!lines.has(k)) lines.set(k, { orient, c, segs: [] });
    lines.get(k).segs.push([Math.min(a, b), Math.max(a, b)]);
  };
  for (const r of state.rooms) {
    add('h', r.z, r.x, r.x + r.w); add('h', r.z + r.d, r.x, r.x + r.w);
    add('v', r.x, r.z, r.z + r.d); add('v', r.x + r.w, r.z, r.z + r.d);
  }
  const out = [];
  for (const L of lines.values()) {
    L.segs.sort((p, q) => p[0] - q[0]);
    let cur = null;
    for (const s of L.segs) {
      if (cur && s[0] <= cur[1] + 0.5) cur[1] = Math.max(cur[1], s[1]);
      else { if (cur) out.push({ orient: L.orient, c: L.c, a: cur[0], b: cur[1] }); cur = [...s]; }
    }
    if (cur) out.push({ orient: L.orient, c: L.c, a: cur[0], b: cur[1] });
  }
  return out;
}

const openingOrient = it => (Math.round(it.rot / 90) % 2 === 0 ? 'h' : 'v');
function onWall(it, w) {
  if (openingOrient(it) !== w.orient) return false;
  const perp = w.orient === 'h' ? it.z : it.x;
  const along = w.orient === 'h' ? it.x : it.z;
  return Math.abs(perp - w.c) < 1 && along >= w.a - 1 && along <= w.b + 1;
}

function rebuildWalls() {
  clearGroup(wallsG);
  walls = computeWalls();
  const T = state.wallT;
  const H = wallMode === 'low' ? Math.min(state.wallH, 45) : state.wallH;
  const openings = state.items.filter(isOpening);
  for (const w of walls) {
    const side = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.92 });
    const top = new THREE.MeshStandardMaterial({ color: '#4f565e', roughness: 0.9 });
    const mats = [side, side, top, side, side, side];
    const ops = openings.filter(o => onWall(o, w)).map(o => {
      const along = w.orient === 'h' ? o.x : o.z;
      return { s: Math.max(w.a, along - o.w / 2), e: Math.min(w.b, along + o.w / 2), y0: o.elev, y1: o.elev + o.h };
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
    g.userData = { kind: 'wall', orient: w.orient, c: w.c, mats: [side, top], faded: false };
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
    const inside = polys[i].every(([x, z]) => state.rooms.some(r =>
      x >= r.x + T2 - 0.6 && x <= r.x + r.w - T2 + 0.6 && z >= r.z + T2 - 0.6 && z <= r.z + r.d - T2 + 0.6));
    if (!inside) bad.add(list[i].id);
  }
  return bad;
}

const overlayMats = {
  bad: new THREE.MeshBasicMaterial({ color: BAD, transparent: true, opacity: 0.35, depthWrite: false }),
  sel: new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.22, depthWrite: false }),
};

function footprint(it, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(it.w / 100, Math.max(it.d, 4) / 100), mat);
  m.rotation.set(-Math.PI / 2, 0, THREE.MathUtils.degToRad(it.rot));
  m.position.set(it.x / 100, 0.012, it.z / 100);
  m.renderOrder = 2;
  return m;
}

function updateOverlay() {
  overlayG.traverse(o => { o.geometry?.dispose(); if (o.material?.isLineBasicMaterial) o.material.dispose(); });
  while (overlayG.children.length) overlayG.remove(overlayG.children[0]);
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
    if (r) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w / 100, r.d / 100), overlayMats.sel);
      m.rotation.x = -Math.PI / 2;
      m.position.set((r.x + r.w / 2) / 100, 0.01, (r.z + r.d / 2) / 100);
      overlayG.add(m);
    }
  }
  const st = $('#status');
  st.hidden = conflicts.size === 0;
  st.textContent = conflicts.size === 1
    ? '⚠ 1 mobile si sovrappone ad altro o esce dai muri'
    : `⚠ ${conflicts.size} mobili si sovrappongono o escono dai muri`;
}

// ---------- snapping ----------

const snapTo = (v, g) => Math.round(v / g) * g;

function snapOpening(px, pz, it) {
  let best = null;
  for (const w of walls) {
    if (w.b - w.a < it.w) continue;
    const pAlong = w.orient === 'h' ? px : pz, pPerp = w.orient === 'h' ? pz : px;
    const along = Math.min(w.b - it.w / 2, Math.max(w.a + it.w / 2, snapTo(pAlong, 5)));
    const dist = Math.hypot(pAlong - along, pPerp - w.c);
    if (!best || dist < best.dist) {
      // Doors swing toward the side the pointer is on.
      const side = pPerp >= w.c;
      best = {
        dist,
        x: w.orient === 'h' ? along : w.c,
        z: w.orient === 'h' ? w.c : along,
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
function pickItem() {
  const hits = raycaster.intersectObjects([...itemsG.children, ...wallsG.children], true);
  for (const h of hits) {
    if (!isVisible(h.object)) continue;
    let o = h.object;
    while (o && !o.userData.kind) o = o.parent;
    if (!o) continue;
    if (o.userData.kind === 'wall') { if (o.userData.faded) continue; return null; }
    if (o.userData.kind === 'item') return o.userData.id;
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
  const id = pickItem();
  if (id) {
    select({ kind: 'item', id });
    const it = getItem(id);
    drag = { kind: 'item', id, off: { x: it.x - p.x, z: it.z - p.z }, moved: false };
  } else if (tab === 'rooms') {
    const rid = pickRoom();
    if (!rid) return;
    select({ kind: 'room', id: rid });
    const r = getRoom(rid);
    const T2 = state.wallT / 2 + 1;
    const carried = state.items
      .filter(i => i.x >= r.x - T2 && i.x <= r.x + r.w + T2 && i.z >= r.z - T2 && i.z <= r.z + r.d + T2)
      .map(i => ({ id: i.id, x: i.x, z: i.z }));
    drag = { kind: 'room', id: rid, start: { x: r.x, z: r.z }, p0: p, carried, moved: false };
  } else return;
  controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
}, { capture: true });

canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  setRay(e);
  const p = floorPoint();
  if (!p) return;
  if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 3) return;
  drag.moved = true;
  if (drag.kind === 'item') dragItem(p, e.altKey);
  else dragRoom(p, e.altKey);
});

function endPointer(e) {
  if (drag) {
    const moved = drag.moved;
    drag = null;
    controls.enabled = true;
    if (moved) { commit(); renderProps(); renderList(); renderRoomsTab(); }
    down = null;
    return;
  }
  if (e.type === 'pointerup' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) select(null);
  down = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

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
  let nx = drag.start.x + (p.x - drag.p0.x);
  let nz = drag.start.z + (p.z - drag.p0.z);
  if (!free) {
    nx = snapTo(nx, 10); nz = snapTo(nz, 10);
    // Snap to the edges of the other rooms.
    const best = (v, size, edges) => {
      let d = Infinity;
      for (const e of edges) for (const a of [v, v + size]) if (Math.abs(e - a) < Math.abs(d)) d = e - a;
      return Math.abs(d) < 20 ? v + d : v;
    };
    const others = state.rooms.filter(o => o !== r);
    nx = best(nx, r.w, others.flatMap(o => [o.x, o.x + o.w]));
    nz = best(nz, r.d, others.flatMap(o => [o.z, o.z + o.d]));
  }
  const dx = nx - drag.start.x, dz = nz - drag.start.z;
  r.x = nx; r.z = nz;
  for (const c of drag.carried) {
    const it = getItem(c.id);
    it.x = c.x + dx; it.z = c.z + dz;
  }
  rebuildRooms();
  rebuildWalls();
  rebuildItems();
  updateOverlay();
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
  if (sr) return { x: sr.x + sr.w / 2, z: sr.z + sr.d / 2 };
  const t = { x: controls.target.x * 100, z: controls.target.z * 100 };
  if (roomAt(t)) return t;
  const r = state.rooms[0];
  return r ? { x: r.x + r.w / 2, z: r.z + r.d / 2 } : t;
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
  const r = { id: newId(), name: `Stanza ${n}`, x: state.rooms.length ? Math.round(b.maxX * 100) : 0, z: state.rooms.length ? Math.round(b.minZ * 100) : 0, w: 300, d: 300, floor: 'parquet' };
  state.rooms.push(r);
  rebuildRooms();
  rebuildWalls();
  updateSun();
  select({ kind: 'room', id: r.id });
  renderRoomsTab();
  commit();
}

function loadPreset(id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Caricare "${p.name}"? Il progetto attuale verrà sostituito (puoi annullare con Ctrl+Z).`)) return;
  state = normalize(structuredClone(p.data));
  selection = null;
  rebuildAll();
  commit();
  fitView();
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
    el.innerHTML = `
      <div class="props-head">
        <div class="room-ico">▦</div>
        <div><h3>Stanza</h3><small>${(r.w * r.d / 10000).toFixed(1).replace('.', ',')} m²</small></div>
        <button class="x" data-act="close" title="Chiudi (Esc)">×</button>
      </div>
      <label class="field"><span>Nome</span><input type="text" data-k="name" value="${esc(r.name)}"></label>
      <div class="fields">
        ${numField('w', 'Larghezza', r.w)}
        ${numField('d', 'Profondità', r.d)}
        ${numField('x', 'Posizione X', r.x)}
        ${numField('z', 'Posizione Z', r.z)}
      </div>
      <label class="field"><span>Pavimento</span><select data-k="floor">
        ${Object.entries(FLOORS).map(([k, v]) => `<option value="${k}"${k === r.floor ? ' selected' : ''}>${v}</option>`).join('')}
      </select></label>
      <p class="hint">Nella scheda <b>Stanze</b> puoi trascinare il pavimento per spostarla: i mobili dentro la seguono.</p>
      <div class="actions"><button data-act="del" class="danger">Elimina stanza</button></div>`;
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
    if (k === 'name') r.name = raw.trim() || 'Stanza';
    else if (k === 'floor') r.floor = raw;
    else {
      const v = parseFloat(raw);
      if (!isFinite(v)) return renderProps();
      r[k] = k === 'w' || k === 'd' ? Math.min(5000, Math.max(50, v)) : v;
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
});

// ---------- UI: rooms tab ----------

function renderRoomsTab() {
  const total = state.rooms.reduce((s, r) => s + r.w * r.d, 0) / 10000;
  $('#tab-rooms').innerHTML = `
    <div class="block">
      <h4>Appartamento</h4>
      <div class="fields">
        ${numField('wallH', 'Altezza muri', state.wallH)}
        ${numField('wallT', 'Spessore muri', state.wallT)}
        ${numField('snap', 'Griglia', state.snap)}
      </div>
    </div>
    <div class="block">
      <h4>Stanze <small>${state.rooms.length} · ${total.toFixed(1).replace('.', ',')} m²</small></h4>
      <ul class="rows">${state.rooms.map(r => `
        <li data-select="${r.id}" class="${selection?.id === r.id ? 'on' : ''}">
          <i class="floor-dot f-${r.floor}"></i>
          <span><b>${esc(r.name)}</b><small>${fmtM(r.w)} × ${fmtM(r.d)} m · ${FLOORS[r.floor]}</small></span>
        </li>`).join('')}</ul>
      <button class="wide" id="addRoomBtn">＋ Aggiungi stanza</button>
      <p class="hint">Con questa scheda aperta trascina un pavimento per spostare la stanza: si aggancia ai bordi delle altre. Tieni premuto <kbd>Alt</kbd> per muoverla liberamente.</p>
    </div>
    <div class="block">
      <h4>Parti da un modello</h4>
      <div class="presets">${PRESETS.map(p => `<button data-preset="${p.id}">${p.name}</button>`).join('')}</div>
    </div>`;
}

$('#tab-rooms').addEventListener('click', e => {
  const li = e.target.closest('[data-select]');
  if (li) { select({ kind: 'room', id: li.dataset.select }); return; }
  if (e.target.closest('#addRoomBtn')) addRoom();
  const p = e.target.closest('[data-preset]');
  if (p) loadPreset(p.dataset.preset);
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
  const counts = {};
  for (const it of state.items) counts[TYPES[it.type].cat] = (counts[TYPES[it.type].cat] || 0) + 1;
  $('#tab-list').innerHTML = `
    <div class="block">
      <h4>Riepilogo</h4>
      <div class="stats">
        <div><b>${state.rooms.length}</b><span>stanze</span></div>
        <div><b>${(state.rooms.reduce((s, r) => s + r.w * r.d, 0) / 10000).toFixed(1).replace('.', ',')}</b><span>m²</span></div>
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

document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-' + tab));
  document.body.classList.toggle('rooms-mode', tab === 'rooms');
}));

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
$('#projectName').addEventListener('change', e => { state.name = e.target.value.trim() || 'Il mio appartamento'; commit(); });

const slug = () => state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'planner';
function download(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
$('#photoBtn').addEventListener('click', () => {
  overlayG.visible = false;
  renderer.render(scene, camera);
  download(canvas.toDataURL('image/png'), slug() + '.png');
  overlayG.visible = true;
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
    state = normalize(JSON.parse(await f.text()));
    selection = null;
    rebuildAll();
    commit();
    fitView();
  } catch {
    alert('File non valido: serve un progetto esportato da questo planner (.json).');
  }
});

function closeSidebarOnMobile() { if (matchMedia('(max-width: 820px)').matches) document.body.classList.remove('sidebar-open'); }
$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));

window.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea')) return;
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

state = normalize(loadSaved() || structuredClone(PRESETS[0].data));
makeControls();
new ResizeObserver(resize).observe(viewport);
resize();
renderCatalog();
rebuildAll();
fitView();
commit();
makeThumbs();

renderer.setAnimationLoop(() => {
  controls.update();
  updateWallFade();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

// Handy for debugging from the browser console.
window.planner = { get state() { return state; }, get camera() { return camera; }, select, addItem, setView, undo };
