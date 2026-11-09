# Planner Casa 3D

Configuratore 3D per arredare casa nel browser: disegni le stanze con le misure reali,
aggiungi porte e finestre, poi trascini i mobili dove vuoi. Fatto con [Three.js](https://threejs.org/),
senza build: HTML, CSS e JavaScript modules.

## Funzioni

- **Crea la tua casa**: menu guidato (camere, bagni, cucina separata o a vista, studio, lavanderia,
  ripostiglio, corridoio, dimensioni) con anteprima della piantina; può già arredarla.
- **Disegno a mano libera** (scheda *Pianta* o barra a sinistra): muri dritti, obliqui o curvi,
  stanze rettangolari al volo, **divisori** senza muro (es. separare l'ingresso) e **ringhiere**
  per terrazzi e balconi. Mentre disegni puoi scrivere la lunghezza esatta + Invio.
- **Stanze riconosciute da sole**: ogni spazio chiuso diventa una stanza; tipo, nome e pavimento
  vengono dedotti da forma, porte e arredi (bagno, camera, cucina, ingresso, corridoio, terrazzo…)
  e si possono sempre cambiare a mano.
- **Modifica**: trascina muri (le stanze vicine si adattano), angoli, il rombo arancione per curvare
  un muro; scrivi le misure dei lati; dividi o elimina un muro.
- **Porte e finestre** (anche portefinestre e vetrate scorrevoli): si agganciano ai muri e li tagliano;
  la porta mostra l'arco di apertura.
- **Mobili** (~30 elementi tra soggiorno, camera, cucina, bagno, ufficio): dimensioni e colore
  modificabili, rotazione, aggancio alla griglia e ai muri.
- **Finiture e stili**: legni (rovere, frassino, ciliegio, noce, wengé) e 18 colori; stili con un clic
  (Legno naturale, Minimal, Scandinavo, Classico, Industriale, Colorato) che ricolorano tutti i mobili.
- **Ringhiere**: vetro, sbarre, legno o muretto. In cucina anche pensile con cappa e cappa a camino.
- **Fuori casa**: campagna (prato, alberi, colline), città (strada, palazzi) o neutro. In città la casa
  può essere indipendente o un appartamento al 1°, 3°, 6° o 10° piano di un palazzo.
- **Controlli**: sovrapposizioni e mobili fuori dai muri vengono segnalati in rosso.
- **Viste**: 3D con muri che si nascondono verso la camera, pianta 2D dall'alto, muri alti/bassi.
- **Cammina**: visita in prima persona con i soffitti; mouse + `WASD`/frecce (`Shift` per
  correre), su telefono trascina a sinistra per camminare e a destra per guardarti intorno.
  Porte e finestre partono chiuse: guardale e premi `E` (o clic, o tocca) per aprirle e chiuderle.
  Le porte girano sui cardini, le finestre aprono le ante verso l'interno, il vasistas si inclina
  e la vetrata scorre. Muri, mobili e porte chiuse non si attraversano.
- **Progetto**: salvataggio automatico nel browser, annulla/ripeti, esporta/importa JSON, foto PNG.
- Modelli di partenza: trilocale, monolocale, stanza vuota.

## Comandi

| Azione | Comando |
| --- | --- |
| Spostare un mobile | trascinalo |
| Ruotare | `R` (90°), `Shift+R` (−90°) |
| Spostare di 1 / 10 cm | frecce / `Shift` + frecce |
| Duplicare / eliminare | `Ctrl+D` / `Canc` |
| Annulla / ripeti | `Ctrl+Z` / `Ctrl+Y` |
| Movimento libero (senza aggancio) | tieni premuto `Alt` mentre trascini |
| Vista 3D | sinistro ruota, destro sposta, rotella zoom |

## Avvio in locale

Serve un piccolo server statico (i moduli ES non funzionano da `file://`):

```bash
python -m http.server 8123
```

Poi apri <http://localhost:8123>.

## Struttura

- `index.html` – layout e import map di Three.js (CDN jsDelivr, versione 0.170.0)
- `js/main.js` – scena, stanze, muri, trascinamento, interfaccia
- `js/catalog.js` – catalogo e modelli 3D dei mobili costruiti con primitive
- `js/textures.js` – texture dei pavimenti generate su canvas
- `js/presets.js` – appartamenti di esempio
- `js/plan.js` – modello a grafo di muri: disegno, riconoscimento stanze e tipo, conversione vecchi progetti
- `js/geometry.js` – geometria 2D (archi, intersezioni, poligoni)
- `js/walk.js` – modalità Cammina (prima persona, collisioni)
- `js/env.js` – ambiente esterno (campagna, città, neutro)
- `tests/plan.test.mjs` – test del modello: `node tests/plan.test.mjs`
- `js/generator.js` – genera la piantina dalle risposte del menu guidato
- `js/wizard.js` – menu "Crea la tua casa" con anteprima
- `css/style.css` – stile
