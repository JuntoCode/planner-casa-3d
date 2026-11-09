// Builds a starting floor plan from a few answers (bedrooms, bathrooms, ...).
// Layout: a "day" band at the front (living, kitchen), an optional corridor,
// and a "night" band at the back (bedrooms, bathrooms, extras). Units: cm.

export const DEFAULT_OPTIONS = {
  bedrooms: 2, baths: 1, kitchen: 'separate', studio: false, laundry: false, storage: false,
  corridor: true, terrace: false, size: 1, wallH: 270, furnish: true,
};

const NAMES = ['Monolocale', 'Bilocale', 'Trilocale', 'Quadrilocale', 'Pentalocale'];

export function homeName(o) {
  return NAMES[o.bedrooms] || `${o.bedrooms + 1} locali`;
}

export function backRoomCount(o) {
  return Math.max(1, o.bedrooms) + o.baths + (o.studio ? 1 : 0) + (o.laundry ? 1 : 0) + (o.storage ? 1 : 0);
}

export function generateHome(opts) {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const S = v => Math.round((v * o.size) / 10) * 10;

  // Night band rooms, left to right.
  const back = [];
  if (o.bedrooms === 0) back.push({ kind: 'sleep', name: 'Zona notte', w: S(320), floor: 'parquet' });
  for (let i = 0; i < o.bedrooms; i++) {
    back.push({
      kind: 'bed', double: i === 0, w: S(i === 0 ? 360 : 300), floor: 'parquet',
      name: i === 0 ? 'Camera matrimoniale' : o.bedrooms > 2 ? `Camera ${i + 1}` : 'Cameretta',
    });
  }
  for (let i = 0; i < o.baths; i++) {
    back.push({ kind: 'bath', main: i === 0, w: S(i === 0 ? 230 : 190), floor: i === 0 ? 'gres' : 'tiles', name: o.baths > 1 ? `Bagno ${i + 1}` : 'Bagno' });
  }
  if (o.studio) back.push({ kind: 'studio', name: 'Studio', w: S(280), floor: 'walnut' });
  if (o.laundry) back.push({ kind: 'laundry', name: 'Lavanderia', w: S(180), floor: 'tiles' });
  if (o.storage) back.push({ kind: 'storage', name: 'Ripostiglio', w: S(150), floor: 'concrete' });

  const open = o.kitchen === 'open';
  // Furniture keeps its real size, so rooms never shrink below what it needs.
  const D1 = Math.max(S(450), 400);
  const D2 = back.some(b => b.kind === 'bed' || b.kind === 'sleep') ? Math.max(S(380), 330) : S(270);
  const CORR = o.corridor ? 120 : 0;
  const kitW = open ? 0 : S(300);
  const livMin = open ? Math.max(S(700), 700) : Math.max(S(450), 430);

  // Day band: living, kitchen, then rooms that don't fit at the back.
  const front = [];
  const sum = list => list.reduce((s, r) => s + r.w, 0);
  const frontSum = () => livMin + kitW + sum(front);
  while (back.length > 2 && sum(back) > frontSum() + 250) front.unshift(back.pop());

  const W = Math.max(sum(back), frontSum());
  const grow = back.find(b => b.kind === 'bed' || b.kind === 'sleep') || back[0];
  grow.w += W - sum(back);
  const livW = W - kitW - sum(front);
  const zBack = D1 + CORR;

  const rooms = [];
  const items = [];
  const openings = [];
  const addRoom = (name, x, z, w, d, floor) => rooms.push({ name, x, z, w, d, floor });
  const put = (type, x, z, rot = 0, extra = {}) => items.push({ type, x: Math.round(x), z: Math.round(z), rot: ((rot % 360) + 360) % 360, ...extra });
  const putOpening = (type, x, z, rot, w, extra = {}) => {
    const orient = rot % 180 === 0 ? 'h' : 'v';
    const perp = orient === 'h' ? z : x, along = orient === 'h' ? x : z;
    const clash = openings.some(p => p.orient === orient && Math.abs(p.perp - perp) < 1 && Math.abs(p.along - along) < (p.w + w) / 2 + 10);
    if (clash) return;
    openings.push({ orient, perp, along, w });
    put(type, x, z, rot, { w, ...extra });
  };

  // ---- living (+ open kitchen)
  addRoom(open ? 'Soggiorno con cucina' : 'Soggiorno', 0, 0, livW, D1, 'parquet');
  const zc = D1 / 2;
  // ---- terrace in front of the living room, reached through a French window
  if (o.terrace) {
    const tw = Math.min(livW, S(480)), td = Math.max(S(180), 150);
    rooms.push({ name: 'Terrazzo', x: 0, z: -td, w: tw, d: td, floor: 'decking', terrace: true });
    putOpening('balcony', Math.min(tw / 2, livW - 90), 0, 180, 140);
    if (o.furnish) {
      put('roundTable', tw - 110, -td / 2, 0, { w: 80, d: 80 });
      put('chair', tw - 180, -td / 2, 90);
      put('chair', tw - 40, -td / 2, 270);
      put('plant', 35, -td + 35);
    }
  }
  putOpening('window', Math.min(150, livW / 2), 0, 0, 140);
  if (o.furnish) {
    put('tvStand', 25, zc, 90);
    put('rug', 185, zc, 90);
    put('coffeeTable', 180, zc, 90);
    put('sofa3', 300, zc, 270);
    if (zc + 170 < D1) put('lamp', 300, zc + 150);
  }
  if (open) {
    if (o.furnish) {
      kitchenRun(livW, 5, D1 - 110);
      put('table', livW - 200, zc, 90);
      put('chair', livW - 200, zc - 95, 0);
      put('chair', livW - 200, zc + 95, 180);
    }
  } else if (o.furnish && livW >= 560) {
    put('table', livW - 110, zc, 90);
    put('chair', livW - 110, zc - 95, 0);
    put('chair', livW - 110, zc + 95, 180);
  }
  if (o.furnish) put('plant', livW - 35, D1 - 35);

  // ---- separate kitchen
  if (!open) {
    const kx = livW;
    addRoom('Cucina', kx, 0, kitW, D1, 'tiles');
    putOpening('window', kx + kitW / 2 - 30, 0, 0, 100);
    if (CORR) putOpening('door', kx + 60, D1, 180, 80);
    else putOpening('door', kx, D1 - 70, 90, 80);
    if (o.furnish) {
      kitchenRun(kx + kitW, 5, D1 - 100);
      const tx = kx + (kitW - 67) / 2;
      put('roundTable', tx, zc + 30, 0, { w: 90, d: 90 });
      put('chair', tx, zc + 30 - 70, 0);
      put('chair', tx, zc + 30 + 70, 180);
    }
  }

  // ---- extra rooms in the day band (door toward the corridor / night band)
  let fx = livW + kitW;
  for (const r of front) {
    addRoom(r.name, fx, 0, r.w, D1, r.floor);
    furnishRoom(r, fx, D1, -1, D1, !CORR);
    fx += r.w;
  }

  // ---- corridor
  if (CORR) {
    addRoom('Corridoio', 0, D1, W, CORR, 'parquet');
    putOpening('arch', Math.min(120, livW / 2), D1, 0, 100);
    putOpening('door90', W, D1 + CORR / 2, 270, 90);
  } else {
    putOpening('door90', open ? Math.min(440, livW - 80) : livW - 80, 0, 0, 90);
  }
  putOpening('window', livW - 150, 0, 0, 120);

  // ---- night band
  let bx = 0;
  for (const r of back) {
    addRoom(r.name, bx, zBack, r.w, D2, r.floor);
    furnishRoom(r, bx, zBack, 1, D2, false);
    bx += r.w;
  }

  return { name: homeName(o), wallH: o.wallH, wallT: 10, snap: 5, rooms, items };

  // Kitchen units along a vertical wall at x = wallX, facing -x, from z0 to zMax.
  function kitchenRun(wallX, z0, zMax) {
    const units = [['fridge', 60], ['kitchenBase', 60], ['sinkUnit', 80], ['hobUnit', 60], ['kitchenBase', 60]];
    let z = z0;
    for (const [type, w] of units) {
      if (z + w > zMax) break;
      const d = type === 'fridge' ? 65 : 62;
      put(type, wallX - 5 - d / 2, z + w / 2, 270);
      if (type !== 'fridge') put(type === 'hobUnit' ? 'hoodCabinet' : 'wallCabinet', wallX - 5 - 17.5, z + w / 2, 270, { w });
      z += w;
    }
  }

  // Furnish a room in local coordinates: lx from the left, lz from the door wall
  // (0) to the outer wall (d). dir = +1 for the night band, -1 for the day band.
  function furnishRoom(r, x0, zDoor, dir, d, sideDoor) {
    const w = r.w;
    const P = (type, lx, lz, rot = 0, extra) => put(type, x0 + lx, zDoor + dir * lz, dir > 0 ? rot : 180 - rot, extra);
    const O = (type, lx, lz, rot, ow, extra) => putOpening(type, x0 + lx, zDoor + dir * lz, dir > 0 ? rot : (180 - rot + 360) % 360, ow, extra);

    if (r.kind === 'sleep') O('arch', w / 2, 0, 0, 160);
    else if (sideDoor) putOpening('door', x0, zDoor + dir * 70, 90, 80);
    else O('door', w - 55, 0, 0, 80);

    if (r.kind === 'bed' || r.kind === 'sleep') O('window', w / 2, d, 180, 120);
    if (r.kind === 'bath') O('vasistas', w / 2, d, 180, 80);
    if (r.kind === 'studio') O('window', w / 2, d, 180, 120);
    if (r.kind === 'laundry') O('vasistas', w / 2, d, 180, 80);
    if (!o.furnish) return;

    if (r.kind === 'bed' || r.kind === 'sleep') {
      const double = r.kind === 'sleep' || r.double;
      const bw = double ? 160 : 90;
      const c = Math.min(d / 2 + 20, d - 5 - bw / 2 - 50); // leave room for the nightstand
      P(double ? 'bed2' : 'bed1', 5 + 102.5, c, 90);
      P('nightstand', 25, c - bw / 2 - 25, 90);
      if (double) P('nightstand', 25, c + bw / 2 + 25, 90);
      const ww = Math.min(200, d - 130);
      if (w >= 290 && ww >= 100) P('wardrobe', w - 35, d - 5 - ww / 2, 270, { w: ww });
    } else if (r.kind === 'bath') {
      P('shower', 50, 50, 0);
      // Along the outer wall: WC, bidet (when it fits), washbasin, and the washer if there is room.
      P('toilet', 30, d - 35, 180);
      const bidet = w >= 185;
      if (bidet) P('bidet', 83, d - 32.5, 180);
      P('washbasin', bidet ? 142 : 89, d - 28, 180);
      if (r.main && w >= (bidet ? 245 : 220)) P('washer', w - 35, d - 35, 180);
    } else if (r.kind === 'studio') {
      P('desk', w / 2, d - 40, 180);
      P('officeChair', w / 2, d - 110, 0);
      P('bookshelf', 20, d / 2, 90);
    } else if (r.kind === 'laundry') {
      P('washer', 40, d - 35, 180);
      P('bookshelf', w - 20, d / 2, 270, { h: 180 });
    } else if (r.kind === 'storage') {
      P('bookshelf', w / 2, d - 20, 180, { w: Math.min(120, w - 40) });
    }
  }
}
