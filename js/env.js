import * as THREE from 'three';
import { groundTexture, facadeTexture } from './textures.js';

// What you see outside the home: countryside, city or a plain neutral studio.
// Everything is generated (no assets) and placed around the home's bounds,
// with a fixed seed so it doesn't jump around between rebuilds.

export const ENVIRONMENTS = {
  country: 'Campagna',
  city: 'Città',
  neutral: 'Neutro',
};

const SKIES = {
  country: { top: '#4f8fd6', horizon: '#dcebf5', ground: '#6d8f4c' },
  city: { top: '#6f9bcf', horizon: '#e4e8ec', ground: '#8f8a83' },
};

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function createEnvironment(scene, ground, grid) {
  const props = new THREE.Group(); // trees, buildings, hills: hidden in the floor plan
  scene.add(props);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(280, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
        void main() { float h = clamp(normalize(vPos).y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);

  const neutralGround = ground.material;
  let kind = null, key = '';
  const owned = []; // geometries/materials to free on rebuild

  function clear() {
    while (props.children.length) props.remove(props.children[0]);
    owned.forEach(o => o.dispose());
    owned.length = 0;
  }
  const keep = o => { owned.push(o); return o; };

  // Low-poly trees at the given [x, z] spots; `scale` shrinks them for streets.
  function trees(r, spots, scale = 1) {
    const count = spots.length;
    const trunk = keep(new THREE.CylinderGeometry(0.12, 0.18, 1, 6));
    trunk.translate(0, 0.5, 0);
    const crown = keep(new THREE.IcosahedronGeometry(1, 0));
    const trunks = new THREE.InstancedMesh(trunk, keep(new THREE.MeshStandardMaterial({ color: '#6b4f3a', roughness: 1 })), count);
    const crowns = new THREE.InstancedMesh(crown, keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true })), count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    let n = 0;
    for (const [x, z] of spots) {
      const h = (2.2 + r() * 3.5) * scale, w = (1.2 + r() * 1.6) * scale;
      m.compose(p.set(x, 0, z), q.identity(), s.set(1, h, 1));
      trunks.setMatrixAt(n, m);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6);
      m.compose(p.set(x, h + w * 0.6, z), q, s.set(w, w * (1.1 + r() * 0.5), w));
      crowns.setMatrixAt(n, m);
      crowns.setColorAt(n, c.set('#4f7a3a').offsetHSL((r() - 0.5) * 0.06, (r() - 0.5) * 0.15, (r() - 0.5) * 0.12));
      n++;
    }
    trunks.count = crowns.count = n;
    props.add(trunks, crowns);
  }

  function buildCountry(b) {
    const r = rng(7);
    const center = { x: b.cx, z: b.cz };
    // Keep a clear garden around the home so trees don't block the 3D view.
    const R = Math.max(b.w, b.d) * 1.1 + 12;
    const spots = [];
    for (let i = 0; i < 170; i++) {
      const a = r() * Math.PI * 2, d = R + r() * 80;
      spots.push([center.x + Math.cos(a) * d, center.z + Math.sin(a) * d]);
    }
    trees(r, spots);
    // Distant green hills.
    const hillMat = keep(new THREE.MeshStandardMaterial({ color: '#7d9d5c', roughness: 1 }));
    const hillGeo = keep(new THREE.SphereGeometry(1, 24, 12));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.4, d = 170 + r() * 50;
      const hill = new THREE.Mesh(hillGeo, hillMat);
      hill.scale.set(40 + r() * 40, 10 + r() * 16, 30 + r() * 30);
      hill.position.set(b.cx + Math.cos(a) * d, -4, b.cz + Math.sin(a) * d);
      props.add(hill);
    }
    // A gravel path from the front of the home.
    const path = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.2, 30)), keep(new THREE.MeshStandardMaterial({ color: '#c9bfae', roughness: 1 })));
    path.rotation.x = -Math.PI / 2;
    path.position.set(b.cx, 0.003, b.minZ - 15);
    path.receiveShadow = true;
    props.add(path);
  }

  function buildCity(b) {
    const r = rng(11);
    const roadZ = b.minZ - 9;
    // Street in front of the home, with sidewalks.
    const asphalt = groundTexture('asphalt').clone();
    asphalt.repeat.set(60, 2);
    asphalt.needsUpdate = true;
    keep(asphalt);
    const road = new THREE.Mesh(keep(new THREE.PlaneGeometry(400, 9)), keep(new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 })));
    road.rotation.x = -Math.PI / 2;
    road.position.set(b.cx, 0.004, roadZ);
    road.receiveShadow = true;
    const lines = new THREE.Mesh(keep(new THREE.PlaneGeometry(400, 0.15)), keep(new THREE.MeshBasicMaterial({ color: '#e8e4d8' })));
    lines.rotation.x = -Math.PI / 2;
    lines.position.set(b.cx, 0.006, roadZ);
    props.add(road, lines);

    // Blocks of buildings around, leaving room for the home and the street.
    const walls = ['#d8cfc2', '#c9b7a3', '#e3dcd2', '#b8bec4', '#cfa98a'];
    const glass = ['#5d7385', '#6f8796', '#4f6474'];
    const mats = walls.map((w, i) => keep(new THREE.MeshStandardMaterial({ map: facadeTexture(w, glass[i % 3], i + 3), roughness: 0.9 })));
    const box = keep(new THREE.BoxGeometry(1, 1, 1));
    const clearX = b.w / 2 + 8, clearZ = b.d / 2 + 8;
    for (let gx = -6; gx <= 6; gx++) {
      for (let gz = -6; gz <= 6; gz++) {
        const x = b.cx + gx * 19 + (r() - 0.5) * 3, z = b.cz + gz * 19 + (r() - 0.5) * 3;
        if (Math.abs(x - b.cx) < clearX + 8 && Math.abs(z - b.cz) < clearZ + 8) continue; // the home's plot
        if (Math.abs(z - roadZ) < 13) continue; // the street
        const w = 11 + r() * 5, d = 11 + r() * 5, h = 9 + r() * 28;
        const geo = keep(box.clone());
        scaleFacadeUVs(geo, w, h, d);
        const m = new THREE.Mesh(geo, mats[Math.floor(r() * mats.length)]);
        m.scale.set(w, h, d);
        m.position.set(x, h / 2, z);
        props.add(m);
      }
    }
    // Small trees in a row along the far sidewalk.
    const row = [];
    for (let i = -9; i <= 9; i++) row.push([b.cx + i * 11, roadZ - 6.5]);
    trees(r, row, 0.75);
  }

  // One texture tile = one 3.2 m × 3 m window bay; roofs get a plain wall color.
  function scaleFacadeUVs(geo, w, h, d) {
    const uv = geo.attributes.uv;
    for (let face = 0; face < 6; face++) {
      for (let k = 0; k < 4; k++) {
        const i = face * 4 + k;
        if (face === 2 || face === 3) { uv.setXY(i, 0.03, 0.03); continue; }
        const span = face < 2 ? d : w;
        uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(span / 3.2)), uv.getY(i) * Math.max(1, Math.round(h / 3)));
      }
    }
    uv.needsUpdate = true;
  }

  function apply(nextKind, b, planView) {
    const nextKey = `${nextKind}|${Math.round(b.cx)}|${Math.round(b.cz)}|${Math.round(b.w)}|${Math.round(b.d)}`;
    if (nextKey !== key) {
      key = nextKey;
      kind = nextKind;
      clear();
      if (kind === 'country') buildCountry(b);
      if (kind === 'city') buildCity(b);
      if (kind === 'neutral') {
        ground.material = neutralGround;
      } else {
        const tex = groundTexture(kind === 'city' ? 'paving' : 'grass').clone();
        tex.repeat.set(kind === 'city' ? 220 : 160, kind === 'city' ? 220 : 160);
        tex.needsUpdate = true;
        ground.material = keep(new THREE.MeshStandardMaterial({ map: keep(tex), roughness: 1 }));
      }
      const s = SKIES[kind];
      sky.visible = !!s;
      if (s) {
        sky.material.uniforms.top.value.set(s.top);
        sky.material.uniforms.horizon.value.set(s.horizon);
        scene.background = new THREE.Color(s.horizon);
        scene.fog = new THREE.Fog(s.horizon, 70, 260);
      } else {
        scene.background = new THREE.Color('#e7eaee');
        scene.fog = null;
      }
    }
    sky.position.set(b.cx, 0, b.cz);
    grid.visible = kind === 'neutral';
    props.visible = !planView;
  }

  return { apply };
}
