// Starting layouts. Units: cm. Rooms: x/z = top-left corner. Items: x/z = center,
// rot in degrees (0 = front faces +z). Missing item sizes come from the catalog.

const trilocale = {
  name: 'Trilocale di esempio',
  rooms: [
    { name: 'Soggiorno', x: 0, z: 0, w: 520, d: 420, floor: 'parquet' },
    { name: 'Camera', x: 520, z: 0, w: 360, d: 420, floor: 'parquet' },
    { name: 'Cucina', x: 0, z: 420, w: 300, d: 260, floor: 'tiles' },
    { name: 'Bagno', x: 300, z: 420, w: 220, d: 260, floor: 'gres' },
    { name: 'Studio', x: 520, z: 420, w: 360, d: 260, floor: 'walnut' },
  ],
  items: [
    // Soggiorno
    { type: 'door90', x: 420, z: 0, rot: 0 },
    { type: 'window', x: 150, z: 0, rot: 0, w: 140 },
    { type: 'tvStand', x: 25, z: 210, rot: 90 },
    { type: 'rug', x: 185, z: 210, rot: 90 },
    { type: 'coffeeTable', x: 180, z: 210, rot: 90 },
    { type: 'sofa3', x: 300, z: 210, rot: 270 },
    { type: 'lamp', x: 300, z: 365, rot: 0 },
    { type: 'table', x: 440, z: 180, rot: 0 },
    { type: 'chair', x: 410, z: 115, rot: 0 },
    { type: 'chair', x: 470, z: 115, rot: 0 },
    { type: 'chair', x: 410, z: 245, rot: 180 },
    { type: 'chair', x: 470, z: 245, rot: 180 },
    { type: 'plant', x: 485, z: 385, rot: 0 },
    { type: 'door', x: 520, z: 300, rot: 90 },
    // Camera
    { type: 'window', x: 700, z: 0, rot: 0 },
    { type: 'bed2', x: 772, z: 230, rot: 270 },
    { type: 'nightstand', x: 855, z: 125, rot: 270 },
    { type: 'nightstand', x: 855, z: 335, rot: 270 },
    { type: 'wardrobe', x: 555, z: 135, rot: 90 },
    { type: 'door', x: 600, z: 420, rot: 0 },
    // Cucina
    { type: 'door', x: 150, z: 420, rot: 0 },
    { type: 'window', x: 0, z: 550, rot: 90, w: 100 },
    { type: 'fridge', x: 35, z: 642, rot: 180 },
    { type: 'kitchenBase', x: 95, z: 644, rot: 180 },
    { type: 'sinkUnit', x: 165, z: 644, rot: 180 },
    { type: 'hobUnit', x: 235, z: 644, rot: 180 },
    { type: 'kitchenBase', x: 280, z: 644, rot: 180, w: 30 },
    { type: 'wallCabinet', x: 95, z: 657, rot: 180 },
    { type: 'wallCabinet', x: 165, z: 657, rot: 180, w: 80 },
    { type: 'wallCabinet', x: 235, z: 657, rot: 180 },
    // Bagno
    { type: 'door', x: 410, z: 420, rot: 0 },
    { type: 'window', x: 410, z: 680, rot: 180, w: 60, h: 80, elev: 120 },
    { type: 'shower', x: 470, z: 630, rot: 180 },
    { type: 'toilet', x: 345, z: 645, rot: 180 },
    { type: 'washbasin', x: 328, z: 520, rot: 90 },
    // Studio
    { type: 'window', x: 730, z: 680, rot: 180 },
    { type: 'desk', x: 730, z: 640, rot: 180 },
    { type: 'officeChair', x: 730, z: 570, rot: 0 },
    { type: 'bookshelf', x: 860, z: 520, rot: 270 },
    { type: 'armchair', x: 568, z: 620, rot: 90 },
  ],
};

const monolocale = {
  name: 'Monolocale di esempio',
  rooms: [
    { name: 'Open space', x: 0, z: 0, w: 620, d: 450, floor: 'parquet' },
    { name: 'Bagno', x: 620, z: 0, w: 210, d: 240, floor: 'tiles' },
    { name: 'Ingresso', x: 620, z: 240, w: 210, d: 210, floor: 'gres' },
  ],
  items: [
    { type: 'door90', x: 725, z: 450, rot: 180 },
    { type: 'door', x: 725, z: 240, rot: 180 },
    { type: 'door', x: 620, z: 345, rot: 270 },
    { type: 'window', x: 200, z: 0, rot: 0, w: 140 },
    { type: 'balcony', x: 0, z: 330, rot: 90 },
    { type: 'wardrobe', x: 35, z: 105, rot: 90 },
    { type: 'bed2', x: 300, z: 345, rot: 180 },
    { type: 'nightstand', x: 195, z: 425, rot: 180 },
    { type: 'nightstand', x: 405, z: 425, rot: 180 },
    { type: 'kitchenBase', x: 385, z: 36, rot: 0 },
    { type: 'sinkUnit', x: 455, z: 36, rot: 0 },
    { type: 'hobUnit', x: 525, z: 36, rot: 0 },
    { type: 'fridge', x: 585, z: 38, rot: 0 },
    { type: 'roundTable', x: 420, z: 150, rot: 0, w: 90, d: 90 },
    { type: 'chair', x: 345, z: 150, rot: 90 },
    { type: 'chair', x: 495, z: 150, rot: 270 },
    { type: 'sofa2', x: 200, z: 160, rot: 0 },
    { type: 'toilet', x: 645, z: 35, rot: 0 },
    { type: 'washbasin', x: 700, z: 28, rot: 0 },
    { type: 'shower', x: 780, z: 50, rot: 0 },
    { type: 'washer', x: 795, z: 190, rot: 270 },
  ],
};

const vuoto = {
  name: 'Nuovo progetto',
  rooms: [{ name: 'Stanza', x: 0, z: 0, w: 400, d: 350, floor: 'parquet' }],
  items: [{ type: 'door', x: 200, z: 350, rot: 180 }],
};

export const PRESETS = [
  { id: 'trilocale', name: 'Trilocale (~60 m²)', data: trilocale },
  { id: 'monolocale', name: 'Monolocale (~37 m²)', data: monolocale },
  { id: 'vuoto', name: 'Stanza vuota', data: vuoto },
];
