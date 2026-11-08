import { DEFAULT_OPTIONS, generateHome, homeName, backRoomCount } from './generator.js';

// "Crea la tua casa": a few questions -> a generated floor plan with a live preview.

const FLOOR_FILL = {
  parquet: '#e2c9a6', walnut: '#a9846a', tiles: '#eceae5', gres: '#d9d4cc', concrete: '#cfccc7', carpet: '#b7c0c9',
  decking: '#b5a593', cotto: '#d39a80',
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function planSvg(home) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const r of home.rooms) {
    minX = Math.min(minX, r.x); minZ = Math.min(minZ, r.z);
    maxX = Math.max(maxX, r.x + r.w); maxZ = Math.max(maxZ, r.z + r.d);
  }
  const pad = 30, fs = Math.max(maxX - minX, maxZ - minZ) / 34;
  const rooms = home.rooms.map(r => `<rect x="${r.x}" y="${r.z}" width="${r.w}" height="${r.d}" fill="${FLOOR_FILL[r.floor] || '#ddd'}"/>`).join('');
  // Terraces first, so the house walls are drawn over their shared side.
  const walls = [...home.rooms].sort((a, b) => !!b.terrace - !!a.terrace).map(r => r.terrace
    ? `<rect x="${r.x}" y="${r.z}" width="${r.w}" height="${r.d}" fill="none" stroke="#7a8794" stroke-width="4" stroke-dasharray="14 8"/>`
    : `<rect x="${r.x}" y="${r.z}" width="${r.w}" height="${r.d}" fill="none" stroke="#4f565e" stroke-width="10"/>`).join('');
  const DOORS = ['door', 'door90', 'arch', 'balcony', 'balcony1', 'slider'];
  const WINDOWS = ['window', 'windowSmall', 'vasistas', 'vasistasWide'];
  const gaps = home.items.filter(i => DOORS.includes(i.type) || WINDOWS.includes(i.type)).map(i => {
    const w = i.w || (i.type === 'door90' ? 90 : 80);
    const h = i.rot % 180 === 0;
    const [x1, y1, x2, y2] = h ? [i.x - w / 2, i.z, i.x + w / 2, i.z] : [i.x, i.z - w / 2, i.x, i.z + w / 2];
    const win = WINDOWS.includes(i.type);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${win ? '#9fd0ea' : '#ffffff'}" stroke-width="${win ? 6 : 12}"/>`;
  }).join('');
  const labels = home.rooms.map(r => {
    const small = r.w < fs * 7 || r.d < fs * 3;
    return `<text x="${r.x + r.w / 2}" y="${r.z + r.d / 2}" font-size="${small ? fs * 0.75 : fs}" text-anchor="middle">
      <tspan font-weight="600">${esc(r.name)}</tspan><tspan x="${r.x + r.w / 2}" dy="1.25em" fill="#6b7380">${(r.w * r.d / 10000).toFixed(1).replace('.', ',')} m²</tspan></text>`;
  }).join('');
  return `<svg viewBox="${minX - pad} ${minZ - pad} ${maxX - minX + 2 * pad} ${maxZ - minZ + 2 * pad}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif" fill="#1d2430">${rooms}${walls}${gaps}${labels}</svg>`;
}

const stepper = (k, label, sub) => `
  <div class="wz-row"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
    <div class="stepper" data-k="${k}"><button type="button" data-d="-1" aria-label="Meno">−</button><b></b><button type="button" data-d="1" aria-label="Più">+</button></div>
  </div>`;
const toggle = (k, label, sub) => `
  <label class="wz-row"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
    <span class="switch"><input type="checkbox" data-k="${k}"><i></i></span>
  </label>`;

export function createWizard({ onCreate, onPreset, onImport }) {
  const o = { ...DEFAULT_OPTIONS };
  let corridorTouched = false;
  const limits = { bedrooms: [0, 4], baths: [1, 3] };

  const dlg = document.createElement('dialog');
  dlg.className = 'wizard';
  dlg.innerHTML = `
    <div class="wz">
      <header>
        <div><h2>Crea la tua casa</h2>
        <p>Rispondi a qualche domanda: preparo la piantina, poi la sistemi trascinando muri e angoli.</p></div>
        <button type="button" class="x" data-act="close" title="Chiudi">×</button>
      </header>
      <div class="wz-body">
        <div class="wz-form">
          ${stepper('bedrooms', 'Camere da letto', '0 = monolocale')}
          ${stepper('baths', 'Bagni')}
          <div class="wz-row"><span>Cucina</span>
            <div class="seg" data-k="kitchen"><button type="button" data-v="separate">Separata</button><button type="button" data-v="open">A vista</button></div>
          </div>
          <div class="wz-row col"><span>Altre stanze</span>
            <div class="chips">
              <label><input type="checkbox" data-k="studio"><span>Studio</span></label>
              <label><input type="checkbox" data-k="laundry"><span>Lavanderia</span></label>
              <label><input type="checkbox" data-k="storage"><span>Ripostiglio</span></label>
            </div>
          </div>
          ${toggle('corridor', 'Corridoio', 'tra zona giorno e zona notte')}
          ${toggle('terrace', 'Terrazzo', 'davanti al soggiorno, con portafinestra')}
          <div class="wz-row col"><span>Dimensioni <small class="inline" data-out="size"></small></span>
            <input type="range" min="0.8" max="1.3" step="0.05" data-k="size">
          </div>
          <div class="wz-row"><span>Altezza soffitto</span>
            <div class="unit"><input type="number" min="200" max="500" step="5" data-k="wallH"><em>cm</em></div>
          </div>
          ${toggle('furnish', 'Arreda con mobili di base', 'li puoi spostare o eliminare dopo')}
        </div>
        <div class="wz-preview">
          <div class="wz-svg"></div>
          <div class="wz-sum"></div>
          <p class="hint">Misure indicative: dopo la creazione trascini i muri, sposti gli angoli o scrivi le misure esatte di ogni lato.</p>
        </div>
      </div>
      <footer>
        <div class="wz-alt"><span>Oppure</span>
          <button type="button" data-preset="trilocale">Esempio arredato</button>
          <button type="button" data-preset="blank">✎ Disegna da zero</button>
          <button type="button" data-act="import">Importa progetto</button>
        </div>
        <button type="button" class="primary" data-act="create">Crea la casa →</button>
      </footer>
    </div>`;
  document.body.appendChild(dlg);

  const q = s => dlg.querySelector(s);

  function sync() {
    for (const st of dlg.querySelectorAll('.stepper')) {
      const k = st.dataset.k;
      st.querySelector('b').textContent = o[k];
      st.querySelector('[data-d="-1"]').disabled = o[k] <= limits[k][0];
      st.querySelector('[data-d="1"]').disabled = o[k] >= limits[k][1];
    }
    dlg.querySelectorAll('[data-k="kitchen"] button').forEach(b => b.classList.toggle('on', b.dataset.v === o.kitchen));
    dlg.querySelectorAll('input[type=checkbox][data-k]').forEach(i => { i.checked = !!o[i.dataset.k]; });
    q('[data-k=size]').value = o.size;
    q('[data-k=wallH]').value = o.wallH;
    q('[data-out=size]').textContent = o.size < 0.9 ? 'compatte' : o.size <= 1.1 ? 'standard' : 'ampie';
    const home = generateHome(o);
    const sumArea = list => list.reduce((s, r) => s + r.w * r.d, 0) / 10000;
    const inside = home.rooms.filter(r => !r.terrace), outside = home.rooms.filter(r => r.terrace);
    q('.wz-svg').innerHTML = planSvg(home);
    q('.wz-sum').innerHTML = `<b>${homeName(o)}</b> · ${inside.length} ambienti · ${sumArea(inside).toFixed(0)} m² calpestabili`
      + (outside.length ? ` + ${sumArea(outside).toFixed(0)} m² di terrazzo` : '');
  }

  dlg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const st = b.closest('.stepper');
    if (st) {
      const k = st.dataset.k;
      o[k] = Math.min(limits[k][1], Math.max(limits[k][0], o[k] + +b.dataset.d));
    } else if (b.closest('[data-k=kitchen]')) o.kitchen = b.dataset.v;
    else if (b.dataset.act === 'close') return dlg.close();
    else if (b.dataset.act === 'create') { dlg.close(); return onCreate(generateHome(o)); }
    else if (b.dataset.act === 'import') { dlg.close(); return onImport(); }
    else if (b.dataset.preset) { dlg.close(); return onPreset(b.dataset.preset); }
    else return;
    if (!corridorTouched) o.corridor = backRoomCount(o) >= 3;
    sync();
  });
  dlg.addEventListener('input', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    if (e.target.type === 'checkbox') {
      o[k] = e.target.checked;
      if (k === 'corridor') corridorTouched = true;
      else if (!corridorTouched) o.corridor = backRoomCount(o) >= 3;
    } else if (k === 'size') o.size = +e.target.value;
    else if (k === 'wallH') {
      const v = +e.target.value;
      if (v >= 200 && v <= 500) o.wallH = v;
      return;
    }
    sync();
  });
  // Close when clicking the backdrop.
  dlg.addEventListener('mousedown', e => { if (e.target === dlg) dlg.close(); });

  return {
    open() {
      sync();
      dlg.showModal();
      q('[data-act=create]').focus();
    },
  };
}
