import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CATALOG, TYPES, SWATCHES, buildModel } from './catalog.js';
import { FLOORS, TILE_M, floorTexture } from './textures.js';
import { PRESETS } from './presets.js';
import { createWizard } from './wizard.js';
import * as G from './geometry.js';
import * as Plan from './plan.js';

// State values are in centimeters; the 3D scene works in meters (cm / 100).
// The plan is a graph of walls (see plan.js); rooms are found from it.

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORAGE_KEY = 'planner-casa-3d-v1';
const SEL = 0x2f6fde;
const BAD = 0xe5484d;
const THUMBS = {};

let state;
let rooms = []; // closed areas found in the plan, each with its settings (meta)
let selection = null; // { kind: 'item' | 'room' | 'wall', id }
let wallMode = 'auto';
let tab = 'furniture';
let tool = 'select';
const history = { stack: [], index: -1 };

// ---------- state helpers ----------

let uidCounter = 0;
const newId = () => (Date.now() + uidCounter++).toString(36) + Math.random().toString(36).slice(2, 5);
const getItem = id => state.items.find(i => i.id === id);
const getWall = id => state.walls.find(w => w.id === id);
const getRoom = id => rooms.find(r => r.id === id);
const isOpening = it => TYPES[it.type].opening;
const isDoor = it => ['door', 'arch'].includes(TYPES[it.type].build);
const fmtM = cm => (cm / 100).toFixed(2).replace('.', ',');
const m2 = a => (a / 10000).toFixed(1).replace('.', ',');
const wallTopOf = w => Math.min(Plan.wallHeight(state, w), wallMode === 'low' ? 45 : Infinity);

function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  const s = Array.isArray(d.walls) && Array.isArray(d.nodes)
    ? structuredClone(d)
    : Plan.fromRooms(d, t => !!TYPES[t]?.opening);
  const out = {
    name: String(s.name || d.name || 'Il mio appartamento'),
    wallH: +s.wallH || 270,
    wallT: +s.wallT || 10,
    snap: +s.snap || 5,
    nodes: s.nodes.filter(n => isFinite(n.x) && isFinite(n.z)).map(n => ({ id: String(n.id), x: +n.x, z: +n.z })),
    walls: [],
    rooms: (s.rooms || []).map(m => ({ ...Plan.newMeta(), ...m, type: Plan.ROOM_TYPES[m.type] ? m.type : 'other', floor: FLOORS[m.floor] ? m.floor : 'parquet' })),
    items: [],
  };
  const ids = new Set(out.nodes.map(n => n.id));
  out.walls = s.walls.filter(w => ids.has(w.a) && ids.has(w.b)).map(w => ({
    id: String(w.id), a: w.a, b: w.b, type: Plan.WALL_TYPES[w.type] ? w.type : 'wall',
    t: w.t == null ? null : +w.t, h: w.h == null ? null : +w.h, bulge: +w.bulge || 0,
  }));
  out.items = (s.items || []).filter(i => TYPES[i?.type]).map(i => {
    const t = TYPES[i.type];
    const it = {
      id: i.id || newId(), type: i.type, x: +i.x || 0, z: +i.z || 0,
      rot: (((+i.rot || 0) % 360) + 360) % 360,
      w: +i.w || t.w, d: +i.d || t.d, h: +i.h || t.h,
      elev: i.elev != null ? +i.elev : t.elev, color: i.color || t.color,
    };
    if (t.opening) Object.assign(it, { wall: i.wall, t: +i.t || 0, flip: !!i.flip });
    return it;
  }).filter(it => !TYPES[it.type].opening || out.walls.some(w => w.id === it.wall));
  Plan.cleanup(out);
  Plan.syncOpenings(out);
  return out;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}
function loadSaved() {
  try { const t = localStorage.getItem(STORAGE_KEY); return t ? JSON.parse(t) : null; } catch { return null; }
}

function refreshRooms(prune = false) {
  rooms = Plan.syncRooms(state, prune);
}

function commit() {
  refreshRooms(true);
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
  refreshRooms();
  if (selection && !(selection.kind === 'item' ? getItem(selection.id) : selection.kind === 'wall' ? getWall(selection.id) : getRoom(selection.id))) selection = null;
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
  if (!state.nodes.length) return { minX: 0, maxX: 4, minZ: 0, maxZ: 4, cx: 2, cz: 2, w: 4, d: 4 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const nm = Plan.nodeMap(state);
  for (const w of state.walls) for (const [x, z] of Plan.wallPathOf(state, w, nm)) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  if (!isFinite(minX)) return { minX: 0, maxX: 4, minZ: 0, maxZ: 4, cx: 2, cz: 2, w: 4, d: 4 };
  const b = { minX: minX / 100, maxX: maxX / 100, minZ: minZ / 100, maxZ: maxZ / 100 };
  b.w = b.maxX - b.minX; b.d = b.maxZ - b.minZ;
  b.cx = (b.minX + b.maxX) / 2; b.cz = (b.minZ + b.maxZ) / 2;
  return b;
}

const roomAt = p => rooms.find(r => G.inPoly(p.x, p.z, r.pts));

// ---------- three.js setup ----------

const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
const drawG = new THREE.Group();
scene.add(floorsG, wallsG, itemsG, overlayG, handlesG, hoverG, drawG);
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
    const s = Math.max(b.w, b.d, 3);
    controls.target.set(b.cx, 0, b.cz);
    persp.position.set(b.cx + s * 0.25, s * 0.95 + 1.5, b.cz + s * 0.95 + 1.5);
  } else {
    const a = viewport.clientWidth / Math.max(1, viewport.clientHeight);
    orthoHalf = Math.max(b.d / 2, b.w / 2 / a, 2) * 1.15 + 0.5;
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
  updateOverlay();
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
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (!keepMaterials && o.material) {
      for (const m of [].concat(o.material)) if (!m.userData.shared) { m.map?.dispose(); m.dispose(); }
    }
  });
  while (g.children.length) g.remove(g.children[0]);
}

const shapeOf = pts => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x / 100, -z / 100)));

// Extrude a footprint (cm, [x, z]) between two heights. Material 0 = top/bottom, 1 = sides.
function prism(pts, y0, y1) {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: Math.max(0.001, (y1 - y0) / 100), bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 / 100, 0);
  return g;
}

function rebuildRooms() {
  clearGroup(floorsG);
  for (const r of rooms) {
    const tex = floorTexture(r.meta.floor).clone();
    tex.repeat.set(1 / TILE_M, 1 / TILE_M);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(r.pts)), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.002;
    m.receiveShadow = true;
    m.userData = { kind: 'room', id: r.id };
    floorsG.add(m);

    const el = document.createElement('div');
    el.className = 'room-label' + (r.meta.autoName ? ' auto' : '');
    el.innerHTML = `<b>${esc(r.meta.name)}</b><span>${m2(r.area)} m²</span>`;
    const lbl = new CSS2DObject(el);
    const p = r.meta.anchor || G.pole(r.pts);
    lbl.position.set(p[0] / 100, 0.05, p[1] / 100);
    floorsG.add(lbl);
  }
}

// Footprint corners of every wall, mitred where walls meet.
function wallOutlines() {
  const nm = Plan.nodeMap(state);
  const inc = new Map(state.nodes.map(n => [n.id, []]));
  for (const w of state.walls) {
    if (w.type === 'divider') continue;
    for (const end of [w.a, w.b]) {
      const d = Plan.dirFrom(state, w, end, nm);
      inc.get(end).push({ w, d, ang: Math.atan2(d[1], d[0]) });
    }
  }
  for (const l of inc.values()) l.sort((a, b) => a.ang - b.ang);
  const half = w => Plan.wallThickness(state, w) / 2;
  const corner = (id, w) => {
    const list = inc.get(id);
    const i = list.findIndex(e => e.w === w);
    const e = list[i], N = Plan.P(nm.get(id)), h = half(w), n = G.left(e.d);
    let L = G.add(N, G.mul(n, h)), R = G.add(N, G.mul(n, -h));
    if (list.length > 1) {
      const ccw = list[(i + 1) % list.length], cw = list[(i - 1 + list.length) % list.length];
      const lim = 4 * Math.max(h, half(ccw.w), half(cw.w));
      const x1 = G.lineIntersect(L, e.d, G.add(N, G.mul(G.left(ccw.d), -half(ccw.w))), ccw.d);
      if (x1 && G.dist(x1, N) < lim) L = x1;
      const x2 = G.lineIntersect(R, e.d, G.add(N, G.mul(G.left(cw.d), half(cw.w))), cw.d);
      if (x2 && G.dist(x2, N) < lim) R = x2;
    }
    return { L, R };
  };
  const out = new Map();
  for (const w of state.walls) {
    const path = Plan.wallPathOf(state, w, nm);
    const h = half(w);
    if (w.type === 'divider') { out.set(w.id, { path }); continue; }
    const cA = corner(w.a, w), cB = corner(w.b, w);
    const L = G.offsetPath(path, h), R = G.offsetPath(path, -h);
    L[0] = cA.L; R[0] = cA.R;
    L[L.length - 1] = cB.R; R[R.length - 1] = cB.L;
    out.set(w.id, { path, L, R, h });
  }
  return out;
}

const wallMats = {
  side: new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.92 }),
  top: new THREE.MeshStandardMaterial({ color: '#4f565e', roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }),
  metal: new THREE.MeshStandardMaterial({ color: '#3b3f45', metalness: 0.6, roughness: 0.35 }),
  dash: new THREE.LineDashedMaterial({ color: 0x5b7fb8, dashSize: 0.12, gapSize: 0.08 }),
  pick: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
};
Object.values(wallMats).forEach(m => { m.userData.shared = true; });

function rebuildWalls() {
  clearGroup(wallsG);
  const outlines = wallOutlines();
  const nm = Plan.nodeMap(state);
  for (const w of state.walls) {
    const o = outlines.get(w.id);
    const g = new THREE.Group();
    const [A, B] = Plan.wallEnds(state, w, nm);
    g.userData = { kind: 'wall', id: w.id, A, B, type: w.type, faded: false };
    wallsG.add(g);

    if (w.type === 'divider') {
      const pts = o.path.map(([x, z]) => new THREE.Vector3(x / 100, 0.02, z / 100));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wallMats.dash);
      line.computeLineDistances();
      g.add(line);
      const L = G.offsetPath(o.path, 7), R = G.offsetPath(o.path, -7);
      g.add(new THREE.Mesh(prism([...L, ...R.reverse()], 0, 4), wallMats.pick));
      continue;
    }
    const H = wallTopOf(w);
    if (w.type === 'railing') {
      const gl = G.offsetPath(o.path, 1), gr = G.offsetPath(o.path, -1);
      const glass = new THREE.Mesh(prism([...gl, ...gr.reverse()], 0, H - 6), wallMats.glass);
      const rail = new THREE.Mesh(prism([...o.L, ...[...o.R].reverse()], H - 6, H), [wallMats.metal, wallMats.metal]);
      rail.castShadow = true;
      g.add(glass, rail);
      continue;
    }
    // Solid wall, made of pieces around its doors and windows.
    const mats = [new THREE.MeshStandardMaterial({ color: '#4f565e', roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.92 })];
    g.userData.mats = mats;
    const add = pts => {
      const m = new THREE.Mesh(pts.geo, mats);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    if (Plan.isCurved(w)) { add({ geo: prism([...o.L, ...[...o.R].reverse()], 0, H) }); continue; }
    const len = G.dist(A, B), d = G.norm(G.sub(B, A)), n = G.left(d);
    const at = (t, side) => {
      if (t <= 0.01) return side > 0 ? o.L[0] : o.R[0];
      if (t >= len - 0.01) return side > 0 ? o.L[o.L.length - 1] : o.R[o.R.length - 1];
      return G.add(A, G.add(G.mul(d, t), G.mul(n, side * o.h)));
    };
    const piece = (t0, t1, y0, y1) => {
      if (t1 - t0 < 0.5 || y1 - y0 < 0.5) return;
      add({ geo: prism([at(t0, 1), at(t1, 1), at(t1, -1), at(t0, -1)], y0, y1) });
    };
    const ops = state.items.filter(it => it.wall === w.id)
      .map(it => ({ s: Math.max(0, it.t - it.w / 2), e: Math.min(len, it.t + it.w / 2), y0: it.elev, y1: it.elev + it.h }))
      .sort((p, q) => p.s - q.s);
    let cur = 0;
    for (const op of ops) {
      if (op.s > cur) piece(cur, op.s, 0, H);
      const s = Math.max(cur, op.s);
      if (op.y0 > 0) piece(s, op.e, 0, Math.min(op.y0, H));
      if (op.y1 < H) piece(s, op.e, Math.max(op.y1, 0), H);
      cur = Math.max(cur, op.e);
    }
    piece(cur, len, 0, H);
  }
}

// IKEA-style cutaway: walls between the camera and the middle of the home fade out.
function updateWallFade() {
  const auto = wallMode === 'auto' && camera === persp;
  const b = bounds();
  const cam = [camera.position.x * 100, camera.position.z * 100];
  const mid = [b.cx * 100, b.cz * 100];
  for (const g of wallsG.children) {
    const { A, B, type, mats } = g.userData;
    if (!mats) continue;
    let fade = false;
    if (auto && type === 'wall') {
      const ab = G.sub(B, A);
      const sc = G.cross(ab, G.sub(cam, A)), sm = G.cross(ab, G.sub(mid, A));
      const len = G.dist(A, B) || 1;
      fade = Math.abs(sc) / len > 5 && (Math.sign(sc) !== Math.sign(sm) || Math.abs(sm) / len < 5);
    }
    if (fade === g.userData.faded) continue;
    g.userData.faded = fade;
    for (const m of mats) {
      m.transparent = fade;
      m.opacity = fade ? 0.13 : 1;
      m.depthWrite = !fade;
      m.needsUpdate = true;
    }
    for (const ch of g.children) ch.castShadow = !fade;
  }
}

function placeObj(o, it) {
  if (!o) return;
  o.position.set(it.x / 100, it.elev / 100, it.z / 100);
  o.rotation.y = THREE.MathUtils.degToRad(it.rot);
}

function makeItemObj(it) {
  if (isOpening(it)) {
    const w = getWall(it.wall);
    it.d = w ? Plan.wallThickness(state, w) : state.wallT;
  }
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

// After the walls changed: rooms, floors, walls, doors/windows, overlay.
function rebuildGeometry() {
  Plan.syncOpenings(state);
  refreshRooms();
  rebuildRooms();
  rebuildWalls();
  const alive = new Set(state.items.map(i => i.id));
  for (const [id, o] of itemObjs) if (!alive.has(id)) { itemsG.remove(o); itemObjs.delete(id); }
  for (const it of state.items) if (isOpening(it)) refreshItemQuiet(it);
  updateOverlay();
}
function refreshItemQuiet(it) {
  const old = itemObjs.get(it.id);
  if (old && old.userData.d === it.d) { placeObj(old, it); return; }
  if (old) { old.traverse(c => c.geometry?.dispose()); itemsG.remove(old); }
  const o = makeItemObj(it);
  o.userData.d = it.d;
  itemsG.add(o);
  itemObjs.set(it.id, o);
}

function rebuildAll() {
  Plan.syncOpenings(state);
  refreshRooms();
  rebuildRooms();
  rebuildWalls();
  rebuildItems();
  updateOverlay();
  updateSun();
  renderProps();
  renderPlanTab();
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

function solidSegments() {
  const nm = Plan.nodeMap(state);
  const segs = [];
  for (const w of state.walls) {
    if (w.type === 'divider') continue;
    const path = Plan.wallPathOf(state, w, nm), h = Plan.wallThickness(state, w) / 2;
    for (let i = 1; i < path.length; i++) segs.push([path[i - 1], path[i], h]);
  }
  return segs;
}

function findConflicts() {
  const bad = new Set();
  const list = state.items.filter(i => !isOpening(i) && !TYPES[i.type].noCollide);
  const polys = list.map(i => corners(i, 0.5));
  const segs = solidSegments();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (A.elev >= B.elev + B.h || B.elev >= A.elev + A.h) continue;
      if (overlap(polys[i], polys[j])) { bad.add(A.id); bad.add(B.id); }
    }
    const ok = polys[i].every(p => rooms.some(r => G.inPoly(p[0], p[1], r.pts)) && segs.every(([a, b, h]) => G.segDist(p, a, b).d >= h - 0.6));
    if (!ok) bad.add(list[i].id);
  }
  return bad;
}

const overlayMats = {
  bad: new THREE.MeshBasicMaterial({ color: BAD, transparent: true, opacity: 0.35, depthWrite: false }),
  sel: new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  wallSel: new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.55, depthWrite: false }),
  hover: new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.35, depthWrite: false }),
  node: new THREE.MeshBasicMaterial({ color: 0x4f565e, depthTest: false }),
  nodeSel: new THREE.MeshBasicMaterial({ color: SEL, depthTest: false }),
  nodeIn: new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
  curve: new THREE.MeshBasicMaterial({ color: 0xf08c2e, depthTest: false }),
  draw: new THREE.MeshBasicMaterial({ color: SEL, transparent: true, opacity: 0.45, depthWrite: false }),
  snapNode: new THREE.MeshBasicMaterial({ color: 0x2fa36b, depthTest: false }),
  snapWall: new THREE.MeshBasicMaterial({ color: 0xf08c2e, depthTest: false }),
  snapFree: new THREE.MeshBasicMaterial({ color: SEL, depthTest: false }),
};
Object.values(overlayMats).forEach(m => { m.userData.shared = true; });
const geoShared = g => { g.userData.shared = true; return g; };
const nodeGeo = geoShared(new THREE.SphereGeometry(0.075, 18, 10));
const nodeSelGeo = geoShared(new THREE.SphereGeometry(0.1, 20, 12));
const nodeInGeo = geoShared(new THREE.SphereGeometry(0.05, 14, 8));
const curveGeo = geoShared(new THREE.OctahedronGeometry(0.11));
const ringGeo = geoShared(new THREE.RingGeometry(0.07, 0.11, 24));

function footprint(it, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(it.w / 100, Math.max(it.d, 4) / 100), mat);
  m.rotation.set(-Math.PI / 2, 0, THREE.MathUtils.degToRad(it.rot));
  m.position.set(it.x / 100, 0.012, it.z / 100);
  m.renderOrder = 2;
  return m;
}

function wallFootprintGeo(w, extra = 0, y0 = 0, y1) {
  const nm = Plan.nodeMap(state);
  const path = Plan.wallPathOf(state, w, nm);
  const h = Math.max(Plan.wallThickness(state, w), 8) / 2 + extra;
  const L = G.offsetPath(path, h), R = G.offsetPath(path, -h);
  return prism([...L, ...R.reverse()], y0, y1 ?? wallTopOf(w) + 2);
}

function updateOverlay() {
  clearGroup(overlayG);
  clearGroup(handlesG);
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
      label(overlayG, isOpening(it) ? `${Math.round(it.w)} × ${Math.round(it.h)} cm` : `${Math.round(it.w)} × ${Math.round(it.d)} × ${Math.round(it.h)} cm`,
        [it.x, it.z], (it.elev + it.h) / 100 + 0.12, 'dim-label' + (bad ? ' bad' : ''));
    }
  }
  const showNodes = tab === 'plan' && tool === 'select';
  const hot = new Set();
  if (selection?.kind === 'room') {
    const r = getRoom(selection.id);
    if (r) {
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(r.pts)), overlayMats.sel);
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = 0.01;
      overlayG.add(fill);
      r.nodes.forEach(id => hot.add(id));
      for (const id of r.walls) { const w = getWall(id); if (w && w.type !== 'divider') lengthLabel(w, r); }
    }
  }
  if (selection?.kind === 'wall') {
    const w = getWall(selection.id);
    if (w) {
      overlayG.add(new THREE.Mesh(wallFootprintGeo(w, 2), overlayMats.wallSel));
      hot.add(w.a); hot.add(w.b);
      lengthLabel(w, null);
      if (showNodes && !state.items.some(it => it.wall === w.id)) {
        const mid = pathMid(Plan.wallPathOf(state, w));
        const c = new THREE.Mesh(curveGeo, overlayMats.curve);
        c.position.set(mid[0] / 100, handleY(), mid[1] / 100);
        c.renderOrder = 12;
        c.userData = { kind: 'curve', wall: w.id };
        handlesG.add(c);
      }
    }
  }
  if (showNodes || hot.size) {
    for (const n of state.nodes) {
      const on = hot.has(n.id);
      if (!showNodes && !on) continue;
      const h = new THREE.Mesh(on ? nodeSelGeo : nodeGeo, on ? overlayMats.nodeSel : overlayMats.node);
      h.position.set(n.x / 100, handleY(), n.z / 100);
      h.renderOrder = 10;
      h.userData = { kind: 'node', id: n.id };
      const inner = new THREE.Mesh(nodeInGeo, overlayMats.nodeIn);
      inner.renderOrder = 11;
      inner.raycast = () => {};
      h.add(inner);
      handlesG.add(h);
    }
  }

  const st = $('#status');
  st.hidden = conflicts.size === 0;
  st.textContent = conflicts.size === 1
    ? '⚠ 1 mobile si sovrappone ad altro o esce dai muri'
    : `⚠ ${conflicts.size} mobili si sovrappongono o escono dai muri`;
}

// Middle point of a wall path (2 points when straight, many when curved).
const pathMid = path => (path.length === 2 ? G.mul(G.add(path[0], path[1]), 0.5) : path[Math.floor(path.length / 2)]);

const handleY = () => (camera === ortho ? 6 : Math.min(state.wallH, wallMode === 'low' ? 45 : Infinity) / 100 + 0.04);

function label(group, text, [x, z], y, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  const l = new CSS2DObject(el);
  l.position.set(x / 100, y, z / 100);
  group.add(l);
  return l;
}

// Editable length of a wall, placed on the side of `room` (or its left side).
function lengthLabel(w, room) {
  const nm = Plan.nodeMap(state);
  const path = Plan.wallPathOf(state, w, nm);
  const len = Plan.wallLength(state, w, nm);
  if (len < 25) return;
  const mid = pathMid(path);
  const [A, B] = Plan.wallEnds(state, w, nm);
  const n = G.left(G.norm(G.sub(B, A)));
  let s = 1;
  if (room) s = G.inPoly(mid[0] + n[0] * 3, mid[1] + n[1] * 3, room.pts) ? 1 : -1;
  const pos = G.add(mid, G.mul(n, s * 32));
  const el = document.createElement('div');
  el.className = 'edge-label';
  const curved = Plan.isCurved(w);
  el.innerHTML = `<input type="number" min="20" step="5" value="${Math.round(len)}" ${curved ? 'disabled title="Lunghezza dell\'arco"' : 'title="Lunghezza del muro (cm)"'}><em>cm</em>`;
  const input = el.querySelector('input');
  input.addEventListener('change', () => {
    if (Plan.setWallLength(state, w.id, parseFloat(input.value))) { rebuildGeometry(); commit(); afterPlanChange(); }
  });
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') input.blur(); });
  const l = new CSS2DObject(el);
  l.position.set(pos[0] / 100, handleY() - 0.01, pos[1] / 100);
  overlayG.add(l);
}

function showHover(w) {
  clearGroup(hoverG);
  if (w) hoverG.add(new THREE.Mesh(wallFootprintGeo(w, 3), overlayMats.hover));
}

// ---------- snapping ----------

const snapTo = (v, g) => Math.round(v / g) * g;

function cmPerPx() {
  const h = canvas.clientHeight || 1;
  if (camera === ortho) return (((ortho.top - ortho.bottom) / ortho.zoom) * 100) / h;
  const d = camera.position.distanceTo(controls.target);
  return (2 * d * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)) * 100) / h;
}

// Where a drawn point lands: an existing corner, a wall, a 15° direction, or the grid.
function snapDraw(raw, from, free) {
  if (free) return { p: [Math.round(raw[0]), Math.round(raw[1])], kind: 'free' };
  const tol = 14 * cmPerPx();
  let node = null, nd = tol;
  for (const n of state.nodes) { const d = G.dist(raw, Plan.P(n)); if (d < nd) { nd = d; node = n; } }
  if (node) return { p: Plan.P(node), kind: 'node' };
  let wall = null;
  const nm = Plan.nodeMap(state);
  for (const w of state.walls) {
    const path = Plan.wallPathOf(state, w, nm);
    for (let i = 1; i < path.length; i++) {
      const r = G.segDist(raw, path[i - 1], path[i]);
      if (r.d < tol && (!wall || r.d < wall.d)) wall = { ...r, a: path[i - 1], b: path[i] };
    }
  }
  if (from) {
    const v = G.sub(raw, from), len = Math.hypot(v[0], v[1]);
    if (len > 1) {
      const ang = Math.atan2(v[1], v[0]), step = Math.PI / 12;
      const sa = Math.round(ang / step) * step;
      if (Math.abs(ang - sa) < THREE.MathUtils.degToRad(6)) {
        const dir = [Math.cos(sa), Math.sin(sa)];
        if (wall) {
          const x = G.lineIntersect(from, dir, wall.a, G.sub(wall.b, wall.a));
          if (x && G.dist(x, raw) < tol) return { p: x, kind: 'wall' };
        }
        if (!wall) return { p: G.add(from, G.mul(dir, snapTo(len, state.snap))), kind: 'angle' };
      }
    }
  }
  if (wall) return { p: wall.q, kind: 'wall' };
  const p = [snapTo(raw[0], state.snap), snapTo(raw[1], state.snap)];
  for (const n of state.nodes) {
    if (Math.abs(n.x - raw[0]) < tol) p[0] = n.x;
    if (Math.abs(n.z - raw[1]) < tol) p[1] = n.z;
  }
  return { p, kind: 'grid' };
}

// Pull furniture flush against a wall face when it gets close (any wall angle).
function snapToWalls(it, x, z) {
  const th = THREE.MathUtils.degToRad(it.rot);
  const ax = [Math.cos(th), -Math.sin(th)], az = [Math.sin(th), Math.cos(th)];
  const nm = Plan.nodeMap(state);
  let best = null;
  for (const w of state.walls) {
    if (w.type === 'divider' || Plan.isCurved(w)) continue;
    const [A, B] = Plan.wallEnds(state, w, nm);
    const d = G.norm(G.sub(B, A)), n = G.left(d), len = G.dist(A, B);
    const pa = Math.abs(G.dot(ax, d));
    if (pa > 0.01 && pa < 0.99) continue;
    const ext = Math.abs(G.dot(ax, n)) * it.w / 2 + Math.abs(G.dot(az, n)) * it.d / 2;
    const extD = Math.abs(G.dot(ax, d)) * it.w / 2 + Math.abs(G.dot(az, d)) * it.d / 2;
    const c = [x, z], s = G.dot(G.sub(c, A), n), u = G.dot(G.sub(c, A), d);
    if (u + extD < 0 || u - extD > len) continue;
    const target = Math.sign(s || 1) * (Plan.wallThickness(state, w) / 2 + ext);
    const corr = target - s;
    if (Math.abs(corr) < 12 && (!best || Math.abs(corr) < Math.abs(best.corr))) best = { corr, n };
  }
  if (best) { x += best.n[0] * best.corr; z += best.n[1] * best.corr; }
  return [x, z];
}

// ---------- picking ----------

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
  return p ? [p.x * 100, p.z * 100] : null;
}
function isVisible(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function pick() {
  const hh = raycaster.intersectObjects(handlesG.children, false)[0];
  if (hh) return { ...hh.object.userData };
  const hits = raycaster.intersectObjects([...itemsG.children, ...wallsG.children], true);
  for (const h of hits) {
    if (!isVisible(h.object)) continue;
    let o = h.object;
    while (o && !o.userData.kind) o = o.parent;
    if (!o) continue;
    if (o.userData.kind === 'wall') {
      if (o.userData.faded) continue;
      return { kind: 'wall', id: o.userData.id, point: [h.point.x * 100, h.point.z * 100] };
    }
    if (o.userData.kind === 'item') return { kind: 'item', id: o.userData.id };
  }
  return null;
}

// ---------- pointer: select / drag ----------

let drag = null;
let down = null;

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY };
  setRay(e);
  const p = floorPoint();
  if (!p) return;
  if (tool !== 'select') {
    drawDown(p, e);
  } else {
    const hit = pick();
    if (hit?.kind === 'node') {
      drag = { kind: 'node', id: hit.id, base: structuredClone(state), moved: false };
    } else if (hit?.kind === 'curve') {
      drag = { kind: 'curve', wall: hit.wall, base: structuredClone(state), moved: false };
    } else if (hit?.kind === 'item') {
      select({ kind: 'item', id: hit.id });
      const it = getItem(hit.id);
      drag = { kind: 'item', id: hit.id, off: [it.x - p[0], it.z - p[1]], moved: false };
    } else if (hit?.kind === 'wall' && tab === 'plan') {
      select({ kind: 'wall', id: hit.id });
      drag = { kind: 'wall', id: hit.id, p0: p, base: structuredClone(state), moved: false };
    } else if (tab === 'plan') {
      const r = roomAt({ x: p[0], z: p[1] });
      if (!r) return;
      select({ kind: 'room', id: r.id });
      drag = { kind: 'room', id: r.id, p0: p, base: structuredClone(state), moved: false };
    } else return;
  }
  controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
}, { capture: true });

canvas.addEventListener('pointermove', e => {
  setRay(e);
  const p = floorPoint();
  if (tool !== 'select') { if (p) drawMove(p, e); return; }
  if (!drag) return hover(e);
  if (!p) return;
  if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 3) return;
  drag.moved = true;
  const free = e.altKey;
  if (drag.kind === 'item') dragItem(p, free);
  else if (drag.kind === 'node') dragNode(p, free);
  else if (drag.kind === 'wall') dragWall(p, free);
  else if (drag.kind === 'curve') dragCurve(p, free);
  else if (drag.kind === 'room') dragRoom(p, free);
});

function hover(e) {
  if (e.buttons) return;
  const hit = pick();
  if (hit?.kind === 'node' || hit?.kind === 'curve') { canvas.style.cursor = 'move'; showHover(); return; }
  if (hit?.kind === 'wall' && tab === 'plan') {
    showHover(getWall(hit.id));
    canvas.style.cursor = 'move';
    return;
  }
  showHover();
  canvas.style.cursor = hit?.kind === 'item' ? 'grab' : '';
}

function endPointer(e) {
  if (tool !== 'select') { drawUp(e); controls.enabled = true; down = null; return; }
  if (drag) {
    const { moved, kind } = drag;
    drag = null;
    controls.enabled = true;
    showHover();
    if (moved) {
      if (kind !== 'item') { Plan.cleanup(state, kind === 'node' ? 2 : 0.5); rebuildGeometry(); updateSun(); }
      commit();
      renderProps(); renderList(); renderPlanTab();
      updateOverlay();
    }
    down = null;
    return;
  }
  if (e.type === 'pointerup' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) select(null);
  down = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!drag) showHover(); });
canvas.addEventListener('dblclick', () => { if (tool !== 'select') finishDraw(); });

function dragItem(p, free) {
  const it = getItem(drag.id);
  if (isOpening(it)) {
    const s = Plan.wallSlot(state, p, it.w, 150);
    if (s) Object.assign(it, { wall: s.wall, t: s.t, flip: s.flip });
    Plan.syncOpenings(state);
    refreshItemQuiet(it);
    rebuildWalls();
  } else {
    let x = p[0] + drag.off[0], z = p[1] + drag.off[1];
    if (!free) {
      x = snapTo(x, state.snap); z = snapTo(z, state.snap);
      [x, z] = snapToWalls(it, x, z);
    }
    it.x = x; it.z = z;
    placeObj(itemObjs.get(it.id), it);
  }
  updateOverlay();
}

function withBase(fn) {
  state = structuredClone(drag.base);
  fn(state);
  rebuildGeometry();
}

function dragNode(p, free) {
  const base = drag.base;
  const nm = Plan.nodeMap(base);
  const tol = 14 * cmPerPx();
  let q = free ? p : [snapTo(p[0], state.snap), snapTo(p[1], state.snap)];
  if (!free) {
    // Snap onto another corner, or line up with the corners it connects to.
    const other = base.nodes.find(n => n.id !== drag.id && G.dist(p, Plan.P(n)) < tol);
    if (other) q = Plan.P(other);
    else {
      const linked = base.walls.filter(w => w.a === drag.id || w.b === drag.id).map(w => nm.get(w.a === drag.id ? w.b : w.a));
      for (const n of linked) {
        if (Math.abs(n.x - p[0]) < tol) q[0] = n.x;
        if (Math.abs(n.z - p[1]) < tol) q[1] = n.z;
      }
    }
  }
  withBase(st => { const n = st.nodes.find(x => x.id === drag.id); n.x = q[0]; n.z = q[1]; });
}

function dragWall(p, free) {
  const base = drag.base;
  const w = base.walls.find(x => x.id === drag.id);
  const [A, B] = Plan.wallEnds(base, w);
  const n = G.left(G.norm(G.sub(B, A)));
  let delta = G.dot(G.sub(p, drag.p0), n);
  if (!free) {
    delta = snapTo(delta, state.snap);
    const tol = 10 * cmPerPx();
    for (const node of base.nodes) {
      if (node.id === w.a || node.id === w.b) continue;
      const s = G.dot(G.sub(Plan.P(node), A), n);
      if (Math.abs(s) > 1 && Math.abs(s - G.dot(G.sub(p, drag.p0), n)) < tol) { delta = s; break; }
    }
  }
  if (Plan.isCurved(w)) {
    withBase(st => {
      const nm = Plan.nodeMap(st);
      for (const id of [w.a, w.b]) { const nd = nm.get(id); nd.x += n[0] * delta; nd.z += n[1] * delta; }
    });
  } else withBase(st => Plan.moveWallOp(st, drag.id, delta));
}

function dragCurve(p, free) {
  const base = drag.base;
  const w = base.walls.find(x => x.id === drag.wall);
  const [A, B] = Plan.wallEnds(base, w);
  const n = G.left(G.norm(G.sub(B, A)));
  const chord = G.dist(A, B);
  let bulge = G.dot(G.sub(p, G.mul(G.add(A, B), 0.5)), n);
  if (!free) bulge = snapTo(bulge, 5);
  if (Math.abs(bulge) < 10) bulge = 0;
  bulge = Math.max(-chord / 2, Math.min(chord / 2, bulge));
  withBase(st => { st.walls.find(x => x.id === drag.wall).bulge = bulge; });
}

function dragRoom(p, free) {
  let dx = p[0] - drag.p0[0], dz = p[1] - drag.p0[1];
  if (!free) { dx = snapTo(dx, 10); dz = snapTo(dz, 10); }
  withBase(st => {
    const r = Plan.syncRooms(st).find(x => x.id === drag.id);
    if (r) Plan.moveRoom(st, r, dx, dz);
  });
  for (const it of state.items) if (!isOpening(it)) placeObj(itemObjs.get(it.id), it);
}

// Drop from the catalog onto the floor.
viewport.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
viewport.addEventListener('drop', e => {
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain');
  if (!TYPES[type]) return;
  setRay(e);
  const p = floorPoint();
  addItem(type, p && { x: p[0], z: p[1] });
});

// ---------- drawing tools ----------

const TOOLS = {
  select: { hint: '' },
  wall: { type: 'wall', hint: 'Clicca per iniziare, poi un clic per ogni angolo. Scrivi un numero + <kbd>Invio</kbd> per una lunghezza esatta. Si chiude da solo quando tocchi un muro; <kbd>Esc</kbd> o doppio clic per finire. <kbd>Alt</kbd> = senza aggancio.' },
  room: { hint: 'Trascina per disegnare una stanza rettangolare. Se tocca altri muri si collega a loro.' },
  divider: { type: 'divider', hint: 'Traccia una linea tra due muri per dividere una stanza senza costruire un muro, per esempio l\'<b>ingresso</b> dal soggiorno.' },
  railing: { type: 'railing', hint: 'Disegna la ringhiera di un <b>terrazzo</b> o balcone, partendo e finendo su un muro esterno della casa.' },
};
let draw = null; // { start, first, segs } for lines, { p0 } for rooms
let typed = '';
let lastSnap = null;

function setTool(t) {
  tool = t;
  draw = null;
  typed = '';
  clearGroup(drawG);
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  const hint = $('#drawHint');
  hint.innerHTML = TOOLS[t].hint;
  hint.hidden = !TOOLS[t].hint;
  canvas.style.cursor = t === 'select' ? '' : 'crosshair';
  if (t !== 'select') {
    if (tab !== 'plan') setTab('plan');
    if (camera !== ortho) setView('2d');
    select(null);
  }
  updateOverlay();
}

function drawDown(p, e) {
  if (tool === 'room') {
    draw = { p0: snapDraw(p, null, e.altKey).p };
    return;
  }
  const s = typedPoint() || snapDraw(p, draw?.start, e.altKey);
  placeDrawPoint(s);
}

function typedPoint() {
  if (!typed || !draw?.start || !lastSnap) return null;
  const L = parseFloat(typed.replace(',', '.'));
  if (!(L > 0)) return null;
  const dir = G.norm(G.sub(lastSnap.p, draw.start));
  return { p: G.add(draw.start, G.mul(dir, L)), kind: 'typed' };
}

function placeDrawPoint(s) {
  typed = '';
  if (!draw) { draw = { start: s.p, first: s.p, segs: 0 }; return; }
  if (G.dist(s.p, draw.start) < 2) { finishDraw(); return; }
  const existed = s.kind === 'node' || s.kind === 'wall';
  Plan.addSegment(state, draw.start, s.p, { type: TOOLS[tool].type }, 1);
  draw.segs++;
  rebuildGeometry();
  updateSun();
  commit();
  renderPlanTab(); renderList();
  // Stop when the line closes a shape or lands on an existing wall.
  if (G.dist(s.p, draw.first) < 2 || existed) { finishDraw(); return; }
  draw.start = s.p;
}

function finishDraw() {
  draw = null;
  typed = '';
  clearGroup(drawG);
}

function drawMove(p, e) {
  clearGroup(drawG);
  if (tool === 'room') {
    const s = snapDraw(p, null, e.altKey);
    marker(s);
    if (draw?.p0 && e.buttons) {
      const [x0, z0] = draw.p0, [x1, z1] = s.p;
      const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      for (let i = 0; i < 4; i++) previewSeg(pts[i], pts[(i + 1) % 4], 'wall');
      label(drawG, `${Math.round(Math.abs(x1 - x0))} × ${Math.round(Math.abs(z1 - z0))} cm`, [(x0 + x1) / 2, (z0 + z1) / 2], 0.3, 'dim-label');
      draw.p1 = s.p;
    }
    return;
  }
  const s = snapDraw(p, draw?.start, e.altKey);
  lastSnap = s;
  const t = typedPoint();
  const end = t || s;
  marker(end);
  if (draw?.start) {
    previewSeg(draw.start, end.p, TOOLS[tool].type);
    const len = G.dist(draw.start, end.p);
    const mid = G.mul(G.add(draw.start, end.p), 0.5);
    label(drawG, typed ? `${typed}▏cm` : `${Math.round(len)} cm`, mid, 0.3, 'dim-label' + (typed ? ' typing' : ''));
  }
}

function marker(s) {
  const m = new THREE.Mesh(ringGeo, s.kind === 'node' ? overlayMats.snapNode : s.kind === 'wall' ? overlayMats.snapWall : overlayMats.snapFree);
  m.rotation.x = -Math.PI / 2;
  m.position.set(s.p[0] / 100, 0.05, s.p[1] / 100);
  m.renderOrder = 20;
  drawG.add(m);
}

function previewSeg(a, b, type) {
  if (G.dist(a, b) < 1) return;
  const h = type === 'divider' ? 3 : type === 'railing' ? 3 : state.wallT / 2;
  const H = type === 'divider' ? 3 : type === 'railing' ? 100 : Math.min(state.wallH, wallMode === 'low' ? 45 : Infinity);
  const path = [a, b];
  const L = G.offsetPath(path, h), R = G.offsetPath(path, -h);
  drawG.add(new THREE.Mesh(prism([...L, ...R.reverse()], 0, H), overlayMats.draw));
}

function drawUp(e) {
  if (tool !== 'room' || !draw?.p0) return;
  const p1 = draw.p1;
  const [x0, z0] = draw.p0;
  draw = null;
  clearGroup(drawG);
  if (!p1 || Math.abs(p1[0] - x0) < 30 || Math.abs(p1[1] - z0) < 30) return;
  const pts = [[x0, z0], [p1[0], z0], [p1[0], p1[1]], [x0, p1[1]]];
  for (let i = 0; i < 4; i++) Plan.addSegment(state, pts[i], pts[(i + 1) % 4], { type: 'wall' }, 1);
  rebuildGeometry();
  updateSun();
  commit();
  renderPlanTab(); renderList();
}

// ---------- actions ----------

function select(sel) {
  selection = sel;
  updateOverlay();
  renderProps();
  document.querySelectorAll('[data-select]').forEach(el => el.classList.toggle('on', !!sel && el.dataset.select === sel.id));
}

function defaultSpot() {
  const sr = selection?.kind === 'room' && getRoom(selection.id);
  if (sr) { const p = sr.meta.anchor || G.pole(sr.pts); return { x: p[0], z: p[1] }; }
  const t = { x: controls.target.x * 100, z: controls.target.z * 100 };
  if (roomAt(t)) return t;
  const r = [...rooms].sort((a, b) => b.area - a.area)[0];
  if (r) { const p = r.meta.anchor || G.pole(r.pts); return { x: p[0], z: p[1] }; }
  return t;
}

function addItem(type, at) {
  const t = TYPES[type];
  const it = { id: newId(), type, x: 0, z: 0, rot: 0, w: t.w, d: t.d, h: t.h, elev: t.elev, color: t.color };
  const p = at || defaultSpot();
  if (t.opening) {
    const s = Plan.wallSlot(state, [p.x, p.z], it.w);
    if (!s) { toast('Disegna prima un muro dritto dove mettere porte e finestre.'); return; }
    Object.assign(it, { wall: s.wall, t: s.t, flip: s.flip });
    state.items.push(it);
    Plan.syncOpenings(state);
  } else {
    it.x = snapTo(p.x, state.snap); it.z = snapTo(p.z, state.snap);
    state.items.push(it);
  }
  refreshItem(it);
  select({ kind: 'item', id: it.id });
  refreshRooms();
  rebuildRooms();
  commit();
  renderList();
  renderPlanTab();
}

function deleteSelection() {
  if (!selection) return;
  if (selection.kind === 'item') {
    const it = getItem(selection.id);
    state.items = state.items.filter(i => i.id !== selection.id);
    selection = null;
    rebuildItems();
    if (it && isOpening(it)) rebuildWalls();
    refreshRooms();
    rebuildRooms();
  } else if (selection.kind === 'wall') {
    Plan.removeWall(state, selection.id);
    selection = null;
    rebuildGeometry();
  } else {
    const r = getRoom(selection.id);
    if (!r || !confirm(`Eliminare la stanza "${r.meta.name}"? Spariscono i muri che usa solo lei; i mobili restano.`)) return;
    Plan.deleteRoom(state, r, rooms);
    selection = null;
    rebuildGeometry();
  }
  updateSun();
  updateOverlay();
  renderProps();
  renderList();
  commit();
  renderPlanTab();
}

function duplicateSelection() {
  if (selection?.kind !== 'item') return;
  const src = getItem(selection.id);
  const it = { ...src, id: newId() };
  if (isOpening(it)) it.t += it.w + 20;
  else { it.x += 20; it.z += 20; }
  state.items.push(it);
  Plan.syncOpenings(state);
  refreshItem(it);
  select({ kind: 'item', id: it.id });
  commit();
  renderList();
}

function rotateSelection(delta) {
  if (selection?.kind !== 'item') return;
  const it = getItem(selection.id);
  if (isOpening(it)) { it.flip = !it.flip; Plan.syncOpenings(state); }
  else it.rot = (((it.rot + delta) % 360) + 360) % 360;
  placeObj(itemObjs.get(it.id), it);
  updateOverlay();
  renderProps();
  commit();
}

function nudge(dx, dz) {
  if (selection?.kind !== 'item') return;
  const it = getItem(selection.id);
  if (isOpening(it)) {
    it.t += dx || dz;
    Plan.syncOpenings(state);
    refreshItem(it);
  } else {
    it.x += dx; it.z += dz;
    placeObj(itemObjs.get(it.id), it);
    updateOverlay();
  }
  renderProps();
  commit();
}

function afterPlanChange() {
  updateSun();
  renderProps();
  renderPlanTab();
  renderList();
}

function startProject(data, guided) {
  state = normalize(structuredClone(data));
  selection = null;
  view3d = null;
  draw = null;
  rebuildAll();
  commit();
  rebuildRooms();
  renderPlanTab();
  if (guided) {
    setTab('plan');
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
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
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

const numField = (k, label, v, unit = 'cm', step = 1, extra = '') =>
  `<label class="field"><span>${label}</span><div class="unit"><input type="number" data-k="${k}" value="${Math.round(v * 10) / 10}" step="${step}" ${extra}><em>${unit}</em></div></label>`;

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
        ${t.opening ? numField('t', 'Dall\'angolo', it.t - it.w / 2) : numField('x', 'Posizione X', it.x) + numField('z', 'Posizione Z', it.z)}
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
  } else if (selection.kind === 'wall') {
    const w = getWall(selection.id);
    if (!w) { el.hidden = true; return; }
    const len = Plan.wallLength(state, w);
    const nm = Plan.nodeMap(state);
    const chord = G.dist(...Plan.wallEnds(state, w, nm));
    const hasOps = state.items.some(it => it.wall === w.id);
    el.innerHTML = `
      <div class="props-head">
        <div class="room-ico">${w.type === 'railing' ? '⫼' : w.type === 'divider' ? '┆' : '▮'}</div>
        <div><h3>${Plan.WALL_TYPES[w.type]}${Plan.isCurved(w) ? ' curvo' : ''}</h3><small>${Math.round(len)} cm</small></div>
        <button class="x" data-act="close" title="Chiudi (Esc)">×</button>
      </div>
      <div class="field"><span>Tipo</span><div class="seg wide-seg">
        ${Object.entries(Plan.WALL_TYPES).map(([k, v]) => `<button data-wtype="${k}" class="${k === w.type ? 'on' : ''}">${v}</button>`).join('')}
      </div></div>
      <div class="fields">
        ${numField('len', 'Lunghezza', len, 'cm', 5, Plan.isCurved(w) ? 'disabled' : '')}
        ${w.type === 'divider' ? '' : numField('t', 'Spessore', Plan.wallThickness(state, w))}
        ${w.type === 'divider' ? '' : numField('h', 'Altezza', Plan.wallHeight(state, w))}
      </div>
      <div class="field"><span>Curvatura ${hasOps ? '<small>(togli porte e finestre per curvarlo)</small>' : ''}</span>
        <div class="row curve-row">
          <input type="range" data-k="bulge" min="${-Math.round(chord / 2)}" max="${Math.round(chord / 2)}" step="5" value="${Math.round(w.bulge || 0)}" ${hasOps ? 'disabled' : ''}>
          <div class="unit"><input type="number" data-k="bulge" step="5" value="${Math.round(w.bulge || 0)}" ${hasOps ? 'disabled' : ''}><em>cm</em></div>
        </div>
      </div>
      <p class="hint">Trascina il muro per spostarlo, i pallini per gli angoli, il rombo arancione per curvarlo.</p>
      <div class="actions">
        <button data-act="split">Dividi a metà</button>
        <button data-act="del" class="danger">Elimina muro</button>
      </div>`;
  } else {
    const r = getRoom(selection.id);
    if (!r) { el.hidden = true; return; }
    const m = r.meta;
    el.innerHTML = `
      <div class="props-head">
        <div class="room-ico">▦</div>
        <div><h3>${esc(m.name)}</h3><small>${m2(r.area)} m² · perimetro ${fmtM(G.perimeter(r.pts))} m</small></div>
        <button class="x" data-act="close" title="Chiudi (Esc)">×</button>
      </div>
      <label class="field"><span>Tipo di stanza ${m.autoType ? '<small>(riconosciuto in automatico)</small>' : ''}</span><select data-k="type">
        <option value="auto"${m.autoType ? ' selected' : ''}>Automatico</option>
        ${Object.entries(Plan.ROOM_TYPES).map(([k, v]) => `<option value="${k}"${!m.autoType && k === m.type ? ' selected' : ''}>${v.label}</option>`).join('')}
      </select></label>
      <label class="field"><span>Nome</span><input type="text" data-k="name" value="${esc(m.name)}"></label>
      <label class="field"><span>Pavimento</span><select data-k="floor">
        ${Object.entries(FLOORS).map(([k, v]) => `<option value="${k}"${k === m.floor ? ' selected' : ''}>${v}</option>`).join('')}
      </select></label>
      <p class="hint">Trascina il pavimento per spostare la stanza, i muri o i pallini per cambiarne la forma. Clicca una misura per scriverla.</p>
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
      if (k === 't') { it.t = v + it.w / 2; } else it[k] = v;
      if (isOpening(it)) Plan.syncOpenings(state);
    }
    refreshItem(it);
    if (!live) { commit(); renderProps(); renderList(); }
  } else if (selection?.kind === 'wall') {
    const w = getWall(selection.id);
    const v = parseFloat(raw);
    if (k === 'len') { if (!Plan.setWallLength(state, w.id, v)) return renderProps(); }
    else if (k === 't') w.t = isFinite(v) ? Math.min(80, Math.max(1, v)) : null;
    else if (k === 'h') w.h = isFinite(v) ? Math.min(600, Math.max(10, v)) : null;
    else if (k === 'bulge') w.bulge = isFinite(v) && Math.abs(v) >= 5 ? v : 0;
    rebuildGeometry();
    if (!live) { commit(); afterPlanChange(); }
  } else if (selection?.kind === 'room') {
    const m = getRoom(selection.id).meta;
    if (k === 'name') { m.name = raw.trim() || 'Stanza'; m.autoName = !raw.trim(); }
    if (k === 'floor') { m.floor = raw; m.autoFloor = false; }
    if (k === 'type') {
      if (raw === 'auto') { m.autoType = true; }
      else { m.type = raw; m.autoType = false; }
      m.autoName = true;
    }
    refreshRooms();
    rebuildRooms();
    commit();
    renderProps();
    renderPlanTab();
  }
}

$('#props').addEventListener('change', e => {
  const k = e.target.dataset.k;
  if (k) applyProp(k, e.target.value);
});
$('#props').addEventListener('input', e => {
  const k = e.target.dataset.k;
  if (k === 'color') applyProp('color', e.target.value, true);
  if (k === 'bulge') {
    applyProp('bulge', e.target.value, true);
    $('#props').querySelectorAll('[data-k=bulge]').forEach(i => { if (i !== e.target) i.value = e.target.value; });
  }
});
$('#props').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.rot) rotateSelection(+b.dataset.rot);
  else if (b.dataset.color) applyProp('color', b.dataset.color);
  else if (b.dataset.wtype) {
    const w = getWall(selection.id);
    w.type = b.dataset.wtype;
    w.t = null; w.h = null;
    if (w.type !== 'wall') state.items = state.items.filter(it => it.wall !== w.id);
    rebuildItems();
    rebuildGeometry();
    commit();
    afterPlanChange();
  } else if (b.dataset.act === 'close') select(null);
  else if (b.dataset.act === 'del') deleteSelection();
  else if (b.dataset.act === 'dup') duplicateSelection();
  else if (b.dataset.act === 'split') {
    const w = getWall(selection.id);
    Plan.splitWall(state, w.id, pathMid(Plan.wallPathOf(state, w)));
    rebuildGeometry();
    commit();
    afterPlanChange();
  }
});

// ---------- UI: plan tab ----------

function renderPlanTab() {
  const total = rooms.filter(r => !['terrace', 'balcony'].includes(r.meta.type)).reduce((s, r) => s + r.area, 0);
  const outside = rooms.filter(r => ['terrace', 'balcony'].includes(r.meta.type)).reduce((s, r) => s + r.area, 0);
  $('#tab-plan').innerHTML = `
    <div class="block">
      <h4>Disegna</h4>
      <div class="tool-grid">
        ${[['wall', '✎', 'Muro'], ['room', '▭', 'Stanza'], ['divider', '┆', 'Divisorio'], ['railing', '⫼', 'Ringhiera']].map(([t, i, n]) =>
          `<button data-tool="${t}" class="${tool === t ? 'on' : ''}"><i>${i}</i>${n}</button>`).join('')}
      </div>
      <div class="howto">
        <div><i class="ico">✎</i><span>Disegna i <b>muri</b> come su un foglio: le stanze chiuse vengono riconosciute da sole (bagno, camera, ingresso…).</span></div>
        <div><i class="dot-h"></i><span>Con <b>Seleziona</b> trascina muri e angoli; il <b>rombo arancione</b> curva il muro selezionato.</span></div>
        <div><i class="ico">┆</i><span>Il <b>divisorio</b> separa due zone senza muro, ad esempio l'ingresso.</span></div>
      </div>
    </div>
    <div class="block">
      <h4>Stanze <small>${rooms.length} · ${m2(total)} m²${outside ? ` + ${m2(outside)} m² esterni` : ''}</small></h4>
      ${rooms.length ? `<ul class="rows">${rooms.map(r => `
        <li data-select="${r.id}" class="${selection?.id === r.id ? 'on' : ''}">
          <i class="floor-dot f-${r.meta.floor}"></i>
          <span><b>${esc(r.meta.name)}</b><small>${Plan.ROOM_TYPES[r.meta.type]?.label || ''}${r.meta.autoType ? ' (auto)' : ''} · ${m2(r.area)} m²</small></span>
        </li>`).join('')}</ul>` : '<p class="empty">Nessuna stanza: disegna dei muri che chiudono uno spazio.</p>'}
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
        <button data-act="blank">Foglio bianco (disegno da zero)</button>
        ${PRESETS.filter(p => p.id !== 'vuoto').map(p => `<button data-preset="${p.id}">${p.name}</button>`).join('')}
      </div>
    </div>`;
}

$('#tab-plan').addEventListener('click', e => {
  const li = e.target.closest('[data-select]');
  if (li) { setTool('select'); select({ kind: 'room', id: li.dataset.select }); return; }
  const tb = e.target.closest('[data-tool]');
  if (tb) { setTool(tool === tb.dataset.tool ? 'select' : tb.dataset.tool); renderPlanTab(); return; }
  if (e.target.closest('[data-act=wizard]')) wizard.open();
  if (e.target.closest('[data-act=blank]') && confirm('Cominciare da un foglio bianco? Il progetto attuale verrà sostituito (puoi annullare con Ctrl+Z).')) {
    startProject({ name: 'Nuovo progetto', nodes: [], walls: [], rooms: [], items: [] }, false);
    setTool('wall');
  }
  const p = e.target.closest('[data-preset]');
  if (p) {
    const preset = PRESETS.find(x => x.id === p.dataset.preset);
    if (confirm(`Caricare "${preset.name}"? Il progetto attuale verrà sostituito (puoi annullare con Ctrl+Z).`)) startProject(preset.data, false);
  }
});
$('#tab-plan').addEventListener('change', e => {
  const k = e.target.dataset.k;
  const v = parseFloat(e.target.value);
  if (!k || !isFinite(v)) return;
  if (k === 'wallH') state.wallH = Math.min(600, Math.max(60, v));
  if (k === 'wallT') state.wallT = Math.min(60, Math.max(2, v));
  if (k === 'snap') state.snap = Math.min(50, Math.max(1, v));
  rebuildItems();
  rebuildGeometry();
  commit();
  renderPlanTab();
});

// ---------- UI: list tab ----------

function renderList() {
  const order = Object.keys(TYPES);
  const items = [...state.items].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  $('#tab-list').innerHTML = `
    <div class="block">
      <h4>Riepilogo</h4>
      <div class="stats">
        <div><b>${rooms.length}</b><span>stanze</span></div>
        <div><b>${m2(rooms.reduce((s, r) => s + r.area, 0))}</b><span>m²</span></div>
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
          <span><b>${t.name}</b><small>${Math.round(it.w)}×${Math.round(t.opening ? it.h : it.d)} cm${room ? ' · ' + esc(room.meta.name) : ''}</small></span>
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
  document.body.classList.toggle('rooms-mode', name === 'plan');
  if (name !== 'plan' && tool !== 'select') setTool('select');
  showHover();
  updateOverlay();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
document.querySelectorAll('#tools button').forEach(b => b.addEventListener('click', () => { setTool(b.dataset.tool); renderPlanTab(); }));

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
  if (b.dataset.act === '3d') { setTool('select'); setView('3d'); setTab('furniture'); }
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
  if (e.target.closest?.('input, select, textarea, dialog')) return;
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (tool !== 'select') {
    if (/^[0-9.,]$/.test(e.key) && draw?.start) { typed += e.key; e.preventDefault(); refreshDrawPreview(); return; }
    if (k === 'backspace' && typed) { typed = typed.slice(0, -1); e.preventDefault(); refreshDrawPreview(); return; }
    if (k === 'enter') { const t = typedPoint(); if (t) placeDrawPoint(t); else finishDraw(); e.preventDefault(); return; }
    if (k === 'escape') { if (draw) finishDraw(); else setTool('select'); renderPlanTab(); return; }
  }
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
let lastMoveEvent = null;
canvas.addEventListener('pointermove', e => { lastMoveEvent = e; });
function refreshDrawPreview() {
  if (!lastMoveEvent) return;
  setRay(lastMoveEvent);
  const p = floorPoint();
  if (p) drawMove(p, lastMoveEvent);
}

// ---------- start ----------

const wizard = createWizard({
  onCreate: home => startProject(home, true),
  onPreset: id => {
    if (id === 'blank') { startProject({ name: 'Nuovo progetto', nodes: [], walls: [], rooms: [], items: [] }, false); setTool('wall'); return; }
    startProject(PRESETS.find(p => p.id === id).data, false);
  },
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
rebuildRooms();
renderPlanTab();
makeThumbs();
if (!saved) wizard.open();

renderer.setAnimationLoop(() => {
  controls.update();
  updateWallFade();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

// Handy for debugging from the browser console.
window.planner = {
  get state() { return state; }, get rooms() { return rooms; }, get camera() { return camera; },
  select, addItem, setView, setTab, setTool, undo, wizard, startProject, findConflicts,
};
