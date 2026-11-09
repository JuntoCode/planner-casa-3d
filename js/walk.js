import * as G from './geometry.js';

// First-person walk: mouse/touch to look, WASD/arrows (or the left half of a
// touch screen) to move. Walls and furniture stop you; open doors let you through.
// E / F, a click (once the mouse is captured) or a tap calls onUse to open or close what you look at.
// Positions are in cm on the floor plan; the camera works in meters.

const EYE = 1.6;        // eye height, m
const RADIUS = 25;      // body radius, cm
const SPEED = 140;      // cm/s walking
const RUN = 300;        // cm/s with Shift
const TURN = 1.8;       // rad/s with the left/right arrows
const LOOK = 0.0024;    // rad per pixel of mouse movement

export function createWalker({ canvas, camera, colliders, onExit, onUse, baseY = () => 0, onFloor }) {
  let active = false;
  let pos = [0, 0];
  let yaw = 0, pitch = 0;
  let solid = { segs: [], boxes: [] };
  const keys = new Set();
  const touches = new Map(); // pointerId -> { kind: 'move' | 'look', x0, y0, x, y }
  let mouseLook = false;
  let lockFailed = false; // no pointer lock (e.g. inside a frame): plain clicks use things
  let down = null;        // where a click or tap started, to tell it from a drag

  function apply() {
    camera.position.set(pos[0] / 100, baseY() + EYE, pos[1] / 100);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  // Push the body out of walls (segments with a half thickness) and furniture boxes.
  function resolve() {
    for (let pass = 0; pass < 3; pass++) {
      for (const [a, b, h] of solid.segs) {
        const r = G.segDist(pos, a, b);
        const min = RADIUS + h;
        if (r.d >= min) continue;
        const n = r.d > 0.01 ? G.mul(G.sub(pos, r.q), 1 / r.d) : G.left(G.norm(G.sub(b, a)));
        pos = G.add(r.q, G.mul(n, min));
      }
      for (const bx of solid.boxes) {
        const th = (bx.rot * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
        const dx = pos[0] - bx.x, dz = pos[1] - bx.z;
        const lx = c * dx - s * dz, lz = s * dx + c * dz; // into the box frame
        const hw = bx.w / 2, hd = bx.d / 2;
        const qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hd, Math.min(hd, lz));
        let px = lx - qx, pz = lz - qz;
        const d = Math.hypot(px, pz);
        if (d >= RADIUS) continue;
        if (d > 0.01) { px = (px / d) * (RADIUS - d); pz = (pz / d) * (RADIUS - d); }
        else {
          // Centre inside the box: leave by the nearest side.
          const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz);
          if (ex < ez) { px = Math.sign(lx || 1) * (ex + RADIUS); pz = 0; } else { pz = Math.sign(lz || 1) * (ez + RADIUS); px = 0; }
        }
        pos = [pos[0] + c * px + s * pz, pos[1] - s * px + c * pz]; // back to the plan frame
      }
    }
  }

  function update(dt) {
    if (!active) return;
    dt = Math.min(dt, 0.05);
    let f = 0, s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD')) s += 1;
    if (keys.has('KeyA')) s -= 1;
    if (keys.has('ArrowLeft')) yaw += TURN * dt;
    if (keys.has('ArrowRight')) yaw -= TURN * dt;
    for (const t of touches.values()) {
      if (t.kind !== 'move') continue;
      const mx = (t.x - t.x0) / 60, mz = (t.y - t.y0) / 60;
      s += Math.max(-1, Math.min(1, mx));
      f -= Math.max(-1, Math.min(1, mz));
    }
    const len = Math.hypot(f, s);
    if (len > 0.05) {
      const k = Math.min(1, len) / len;
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : SPEED;
      const fwd = [-Math.sin(yaw), -Math.cos(yaw)], right = [Math.cos(yaw), -Math.sin(yaw)];
      const step = speed * dt * k;
      pos = G.add(pos, G.add(G.mul(fwd, f * step), G.mul(right, s * step)));
      resolve();
    }
    apply();
  }

  function look(dx, dy) {
    yaw -= dx * LOOK;
    pitch = Math.max(-1.35, Math.min(1.35, pitch - dy * LOOK));
  }

  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
  function onKeyDown(e) {
    if (!active || e.target.closest?.('input, select, textarea, dialog')) return;
    if (e.code === 'Escape') { if (!document.pointerLockElement) onExit(); return; }
    if (e.code === 'KeyE' || e.code === 'KeyF') { e.preventDefault(); if (!e.repeat) onUse?.(); return; }
    if (e.code === 'PageUp' || e.code === 'PageDown') { e.preventDefault(); if (!e.repeat) onFloor?.(e.code === 'PageUp' ? 1 : -1); return; }
    if (MOVE_KEYS.includes(e.code)) { keys.add(e.code); e.preventDefault(); }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onBlur() { keys.clear(); touches.clear(); }

  function onPointerDown(e) {
    if (!active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (e.pointerType === 'touch') {
      const r = canvas.getBoundingClientRect();
      const kind = e.clientX - r.left < r.width / 2 ? 'move' : 'look';
      touches.set(e.pointerId, { kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    // Mouse: lock the pointer for free look; dragging also works if locking is blocked.
    mouseLook = true;
    if (document.pointerLockElement === canvas) { onUse?.(); return; }
    if (!lockFailed) canvas.requestPointerLock?.()?.catch?.(() => { lockFailed = true; });
  }
  function onPointerMove(e) {
    if (!active) return;
    const t = touches.get(e.pointerId);
    if (t) {
      if (t.kind === 'look') look((e.clientX - t.x) * 1.6, (e.clientY - t.y) * 1.6);
      t.x = e.clientX; t.y = e.clientY;
      return;
    }
    if (document.pointerLockElement === canvas || (mouseLook && e.buttons)) look(e.movementX, e.movementY);
  }
  function onPointerUp(e) {
    // A short tap, or a click while the mouse cannot be captured, uses what is under it.
    const tap = down && performance.now() - down.t < 350 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12;
    if (active && tap && (e.pointerType === 'touch' || (lockFailed && !document.pointerLockElement))) onUse?.(e.clientX, e.clientY);
    down = null;
    touches.delete(e.pointerId);
    if (e.pointerType !== 'touch') mouseLook = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('pointerlockchange', () => {
    document.body.classList.toggle('walk-locked', document.pointerLockElement === canvas);
  });

  return {
    get active() { return active; },
    get position() { return pos; },
    start(x, z, startYaw = 0) {
      active = true;
      solid = colliders();
      pos = [x, z];
      yaw = startYaw;
      pitch = -0.08;
      resolve();
      apply();
    },
    refresh() { if (active) { solid = colliders(); resolve(); apply(); } },
    stop() {
      active = false;
      keys.clear();
      touches.clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
    update,
  };
}
