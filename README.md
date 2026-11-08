# Planner Casa 3D

Configuratore 3D per arredare casa nel browser: disegni le stanze con le misure reali,
aggiungi porte e finestre, poi trascini i mobili dove vuoi. Fatto con [Three.js](https://threejs.org/),
senza build: HTML, CSS e JavaScript modules.

## Funzioni

- **Crea la tua casa**: menu guidato (camere, bagni, cucina separata o a vista, studio, lavanderia,
  ripostiglio, corridoio, dimensioni) con anteprima della piantina; può già arredarla.
- **Stanze**: rettangolari o a forma libera (a L, a U…), pavimento a scelta. Si modificano trascinando
  un muro (le stanze vicine si adattano), i pallini sugli angoli, scrivendo la misura di ogni lato
  o creando una rientranza con ⊕. Le stanze si trascinano e i mobili dentro le seguono.
  I muri condivisi vengono uniti in automatico.
- **Porte e finestre**: si agganciano ai muri e li tagliano; la porta mostra l'arco di apertura.
- **Mobili** (~30 elementi tra soggiorno, camera, cucina, bagno, ufficio): dimensioni e colore
  modificabili, rotazione, aggancio alla griglia e ai muri.
- **Controlli**: sovrapposizioni e mobili fuori dai muri vengono segnalati in rosso.
- **Viste**: 3D con muri che si nascondono verso la camera, pianta 2D dall'alto, muri alti/bassi.
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
- `js/generator.js` – genera la piantina dalle risposte del menu guidato
- `js/wizard.js` – menu "Crea la tua casa" con anteprima
- `css/style.css` – stile
