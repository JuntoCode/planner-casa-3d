// Checks of the wall-graph model (plan.js). Run: node tests/plan.test.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = process.argv[2] || path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const P = await import(pathToFileURL(path.join(dir, 'js/plan.js')).href);
const Gen = await import(pathToFileURL(path.join(dir, 'js/generator.js')).href);
const G = await import(pathToFileURL(path.join(dir, 'js/geometry.js')).href);

const OPEN = new Set(['door', 'door90', 'arch', 'window', 'balcony']);
let fails = 0;
const check = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name} ${extra}`); };
const names = rooms => rooms.map(r => `${r.meta.name}(${(r.area / 1e4).toFixed(1)})`).join(', ');

// 1. generated home converts to a graph with the same rooms
const home = Gen.generateHome({ bedrooms: 2, baths: 1 });
const st = P.fromRooms(home, t => OPEN.has(t));
let rooms = P.syncRooms(st, true);
check('rooms from generated home', rooms.length === home.rooms.length, names(rooms));
const openings = st.items.filter(i => i.wall).length;
const expected = home.items.filter(i => OPEN.has(i.type)).length;
check('openings attached to walls', openings === expected, `${openings}/${expected}`);
P.syncOpenings(st);
const door = st.items.find(i => i.type === 'door90');
const src = home.items.find(i => i.type === 'door90');
check('opening position kept', Math.abs(door.x - src.x) < 1 && Math.abs(door.z - src.z) < 1 && door.rot === src.rot, JSON.stringify([door.x, door.z, door.rot, src.x, src.z, src.rot]));

// 2. a wall across the living room splits it in two
const before = rooms.length;
P.addSegment(st, [200, 0], [200, 450], { type: 'divider' });
rooms = P.syncRooms(st, true);
check('divider splits a room', rooms.length === before + 1, names(rooms));

// 3. a free-standing rectangle drawn elsewhere becomes a new room
const corners = [[1200, 0], [1500, 0], [1500, 250], [1200, 250]];
for (let i = 0; i < 4; i++) P.addSegment(st, corners[i], corners[(i + 1) % 4]);
rooms = P.syncRooms(st, true);
const fresh = rooms.find(r => G.inPoly(1350, 125, r.pts));
check('new rectangle is a room', !!fresh, fresh && `${fresh.meta.name} ${fresh.meta.type}`);

// 4. curving its outer wall keeps the room and grows it
const w = st.walls.find(x => { const [A, B] = P.wallEnds(st, x); return A[0] === 1500 && B[0] === 1500; });
const a0 = fresh.area;
w.bulge = A_sign(st, w) * 80;
rooms = P.syncRooms(st, true);
const curved = rooms.find(r => G.inPoly(1350, 125, r.pts));
check('curved wall keeps room', !!curved && curved.area > a0, curved && `${(a0 / 1e4).toFixed(2)} -> ${(curved.area / 1e4).toFixed(2)} m²`);
function A_sign(st, w) { // bulge outward (+x)
  const [A, B] = P.wallEnds(st, w);
  const n = G.left(G.norm(G.sub(B, A)));
  return n[0] > 0 ? 1 : -1;
}

// 5. splitting the curved wall keeps the same shape
const n0 = rooms.length, area0 = curved.area;
const mid = G.wallPath(...P.wallEnds(st, w), w.bulge)[10];
P.splitWall(st, w.id, mid);
rooms = P.syncRooms(st, true);
const after = rooms.find(r => G.inPoly(1350, 125, r.pts));
check('split curved wall keeps area', rooms.length === n0 && Math.abs(after.area - area0) / area0 < 0.02, `${(area0 / 1e4).toFixed(2)} vs ${(after.area / 1e4).toFixed(2)}`);

// 6. moving a wall segment that continues straight keeps everything square
const st2 = P.fromRooms(home, t => OPEN.has(t));
let r2 = P.syncRooms(st2, true);
const bed = r2.find(r => r.meta.name === 'Camera matrimoniale');
const nm = P.nodeMap(st2);
const top = st2.walls.find(x => bed.walls.includes(x.id) && (() => { const [A, B] = P.wallEnds(st2, x, nm); return Math.abs(A[1] - B[1]) < 1 && Math.abs(A[1] - bed.pts.reduce((m, p) => Math.min(m, p[1]), 1e9)) < 1; })());
const [A, B] = P.wallEnds(st2, top);
const delta = (G.left(G.norm(G.sub(B, A)))[1] > 0 ? 1 : -1) * 40; // push it 40 cm into the bedroom
P.moveWallOp(st2, top.id, delta);
r2 = P.syncRooms(st2, true);
const bed2 = r2.find(r => r.meta.name === 'Camera matrimoniale');
const allSquare = st2.walls.every(x => { const [a, b] = P.wallEnds(st2, x); return Math.abs(a[0] - b[0]) < 0.5 || Math.abs(a[1] - b[1]) < 0.5; });
check('wall move keeps rooms', r2.length === home.rooms.length, names(r2));
check('wall move keeps walls square', allSquare);
check('bedroom got smaller', bed2.area < bed.area, `${(bed.area / 1e4).toFixed(1)} -> ${(bed2.area / 1e4).toFixed(1)}`);

// 7. railings: generated terrace
const t = P.fromRooms({ rooms: [{ name: 'Soggiorno', x: 0, z: 0, w: 400, d: 400 }, { name: 'Terrazzo', x: 0, z: -200, w: 400, d: 200, terrace: true }] }, () => false);
const rails = t.walls.filter(x => x.type === 'railing').length;
check('terrace outer sides are railings', rails === 3, `${rails}`);
const tr = P.syncRooms(t, true);
check('terrace detected', tr.some(r => r.meta.type === 'terrace'), names(tr));

// 8. auto type guess for drawn rooms
const s3 = { wallH: 270, wallT: 10, nodes: [], walls: [], rooms: [], items: [] };
const box = (x, z, w, d) => { const c = [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]; for (let i = 0; i < 4; i++) P.addSegment(s3, c[i], c[(i + 1) % 4]); };
box(0, 0, 600, 450); box(600, 0, 120, 450); box(720, 0, 200, 150);
s3.items.push({ id: 'x', type: 'toilet', x: 800, z: 300, rot: 0, w: 38, d: 60, h: 80 });
const r3 = P.syncRooms(s3, true);
check('types guessed', r3.length === 3, names(r3) + ' | ' + r3.map(r => r.meta.type).join(','));

console.log(fails ? `${fails} FAILED` : 'all good');
