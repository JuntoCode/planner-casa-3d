// 2D geometry on the floor plane. Points are [x, z] in centimeters.

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const norm = a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
// Left normal of a direction (90° counter-clockwise in atan2(z, x) terms).
export const left = d => [-d[1], d[0]];

export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
export const area = pts => Math.abs(signedArea(pts));

export function perimeter(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
  return s;
}

export function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Inside a room: its outline but not its holes (a garden around the house has the house as a hole).
export const inRoom = (x, z, r) => inPoly(x, z, r.pts) && !(r.holes || []).some(h => inPoly(x, z, h));

// Distance from p to segment a-b, with the parameter t (0..1) of the closest point.
export function segDist(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab) || 1;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  const q = add(a, mul(ab, t));
  return { d: dist(p, q), t, q };
}

export function edgeDist(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) best = Math.min(best, segDist([x, z], pts[i], pts[(i + 1) % pts.length]).d);
  return best;
}

// Proper crossing of segments p1-p2 and p3-p4 (not touching at the ends).
export function segIntersect(p1, p2, p3, p4, eps = 1e-6) {
  const r = sub(p2, p1), s = sub(p4, p3);
  const den = cross(r, s);
  if (Math.abs(den) < eps) return null;
  const qp = sub(p3, p1);
  const t = cross(qp, s) / den, u = cross(qp, r) / den;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  return { t, u, p: add(p1, mul(r, t)) };
}

// Intersection of two infinite lines (point + direction).
export function lineIntersect(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

// The point deepest inside a polygon (and outside its holes): where a label goes.
export function pole(pts, holes = []) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  let best = null, bd = -1;
  const N = 18;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = x0 + ((i + 0.5) / N) * (x1 - x0), z = z0 + ((j + 0.5) / N) * (z1 - z0);
    if (!inPoly(x, z, pts) || holes.some(h => inPoly(x, z, h))) continue;
    const d = Math.min(edgeDist(x, z, pts), ...holes.map(h => edgeDist(x, z, h)));
    if (d > bd) { bd = d; best = [x, z]; }
  }
  return best || [(x0 + x1) / 2, (z0 + z1) / 2];
}

// Remove repeated points and zero-width spikes (a dangling wall walked out and back).
export function cleanPoly(pts) {
  const p = pts.slice();
  for (let changed = true; changed && p.length > 2;) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      if (dist(a, b) < 0.5) { p.splice(i, 1); changed = true; break; }
      if (dist(a, c) < 0.5) { p.splice(i, 1); changed = true; break; }
    }
  }
  return p;
}

// ---- curved walls: an arc from A to B whose middle sits `bulge` cm to the left of the chord.

export function arcInfo(A, B, bulge) {
  const c = dist(A, B);
  if (Math.abs(bulge) < 0.5 || c < 1) return null;
  const s = bulge;
  const r = (c * c / 4 + s * s) / (2 * Math.abs(s));
  const d = norm(sub(B, A)), n = left(d);
  const M = mul(add(A, B), 0.5);
  const C = add(M, mul(n, s - Math.sign(s) * r));
  const a0 = Math.atan2(A[1] - C[1], A[0] - C[0]);
  const a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
  const top = add(M, mul(n, s));
  const am = Math.atan2(top[1] - C[1], top[0] - C[0]);
  // Choose the sweep direction that passes through the arc's middle point.
  const norm2pi = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let sweep = norm2pi(a1 - a0);
  if (norm2pi(am - a0) > sweep) sweep -= 2 * Math.PI;
  return { C, r, a0, sweep, length: Math.abs(sweep) * r };
}

export function wallPath(A, B, bulge = 0, step = 8) {
  const arc = arcInfo(A, B, bulge);
  if (!arc) return [A, B];
  const n = Math.max(8, Math.ceil(arc.length / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = arc.a0 + (arc.sweep * i) / n;
    out.push([arc.C[0] + Math.cos(a) * arc.r, arc.C[1] + Math.sin(a) * arc.r]);
  }
  out[0] = [...A];
  out[n] = [...B];
  return out;
}

export function pathLength(path) {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += dist(path[i - 1], path[i]);
  return s;
}

// Offset a polyline sideways (positive = left). Joints use the averaged normal.
export function offsetPath(path, off) {
  return path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    return add(p, mul(left(norm(sub(b, a))), off));
  });
}

// Bulge that makes an arc from A to B pass through point P (circle through 3 points).
export function bulgeThrough(A, B, P) {
  const d = norm(sub(B, A)), n = left(d);
  const c = dist(A, B);
  const u = dot(sub(P, A), d), v = dot(sub(P, A), n);
  if (Math.abs(v) < 1) return 0;
  // Circle through (0,0), (c,0), (u,v) in chord coordinates: centre (c/2, k).
  // The chord splits the circle in two arcs; P is on the one on its own side,
  // whose middle point is (c/2, k ± r).
  const k = (u * u + v * v - c * u) / (2 * v);
  const r = Math.hypot(c / 2, k);
  return v > 0 ? k + r : k - r;
}
