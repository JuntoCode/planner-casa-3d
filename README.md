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
- **Porte e finestre** (anche portefinestre, vetrate scorrevoli, porta a scomparsa, porta doppia a vetri,
  porta d'ingresso blindata, porta del garage basculante, veneziane): si agganciano ai muri e li tagliano;
  la porta mostra l'arco di apertura.
- **Mobili e oggetti** (oltre 230): soggiorno, camera, cucina, bagno, ufficio, più
  - **soggiorno**: divano angolare, madia, parete attrezzata TV, vetrina, libreria a cubi, mensole sfalsate,
    pensile, tavolino laterale, pouf, poltrona sacco, camino, tende, termosifone;
  - **cucina**: isola, sgabelli, lavastoviglie, colonna forno, pattumiera, portaspezie e barra portautensili;
    sul piano bollitore, tostapane, ceppo coltelli, portamestoli, scolapiatti, pentole, barattoli, tagliere;
  - **bagno**: pensile a specchio, portasciugamani, scaldasalviette, portarotolo, tappetino, cesto biancheria,
    scaletta portasciugamani, bilancia, set sapone e spazzolini sul lavabo;
  - **bambini**: letto a castello, lettino neonato, fasciatoio, cesta dei giochi, tenda indiana, cavallo a dondolo;
  - **camera**: anche armadio scorrevole a specchio, toeletta, baule;
  - **lavanderia e clima**: asciugatrice, stendino, asse da stiro, aspirapolvere, caldaia, condizionatore,
    ventilatore a soffitto e a piantana;
  - **sport e giochi**: tapis roulant, cyclette, tappetino yoga, manubri, biliardo, ping pong, freccette,
    console, bicicletta;
  - **scale**: dritta e a chiocciola;
  - **ufficio**: anche scrivania angolare, cassettiera con ruote, stampante, bacheca;
  - **ingresso**: scarpiera, panca portascarpe, consolle, appendiabiti a muro e a stelo, portaombrelli;
  - **da appoggiare**: libri, candele, cornice, vaso, fruttiera, cassa audio, giradischi, microonde, macchina del caffè;
  - **decorazioni**: quadri, poster, arazzo mandala, acchiappasogni, specchi, orologio, mensola con libri, vaso di fiori;
  - **tappeti**: persiano, berbero, kilim, passatoia, rotondi;
  - **luci**: lampadario, sospensioni, plafoniera, luci fairy; da terra: classica, ad arco, treppiede, a luce
    indiretta, a sfera, di carta, faro su treppiede, da lettura, a colonna; da tavolo: classica, verde da
    scrivania, snodata, a fungo, a sfera, con paralume plissé, lanterna; mistiche e tribali: lanterna marocchina,
    lampada di sale, lampada lava, geode di ametista, zucca intagliata, rattan, mandala, Tiffany,
    sfera di cristallo, totem tribale;
  - **piante**: monstera, sansevieria, palma, ficus, ulivo, felce, cactus, piante grasse, bonsai, pianta pendente;
  - **tecnologia e musica**: PC, portatile, TV a parete, chitarre a parete o su supporto, pianoforti, batteria;
  - **animali**: cucce per cane e gatto, ciotole, tiragraffi, lettiera, acquario;
  - **rivestimenti** a piastrelle per bagno e cucina.

  Quadri, specchi e TV si appendono da soli al muro più vicino; i lampadari si agganciano al soffitto.
  PC, portatile, lampade, libri e gli altri oggetti piccoli si posano da soli sul mobile adatto (il PC sulla
  scrivania, il microonde in cucina) e salgono sul piano su cui li trascini (`Alt` per lasciarli a terra);
  spostando un mobile si porta dietro quello che ha sopra. Un oggetto nuovo cerca un posto libero:
  a terra vicino al centro della stanza, a parete un tratto di muro sgombro (non sopra la doccia).
  Dimensioni e colore modificabili, rotazione, aggancio alla griglia e ai muri.
- **Giardino e patio**: lo strumento *Giardino* disegna una staccionata (o siepe) anche tutto intorno
  alla casa, *Patio* un cordolo per una zona pavimentata. In giardino: alberi, ulivo, cipresso,
  cespugli, aiuole, lavanda, orto, piscina, pergola, ombrellone, lettino, barbecue, panchina,
  lampione, casetta degli attrezzi, cuccia del cane, amaca, altalena, tappeto elastico, braciere, fontana, auto.
- **Piani**: casa su più livelli. Dal menu in alto o dalla scheda *Pianta* scegli il piano da modificare,
  ne aggiungi uno sopra (vuoto o con gli stessi muri e finestre di quello sotto), lo rinomini o lo elimini.
  In 3D vedi i piani sotto quello che modifichi, con il solaio; in pianta il piano sotto resta velato come
  traccia. Per la scala: metti una *Scala* al piano di sotto e al piano di sopra chiudi il buco con una
  ringhiera: diventa un vano scala aperto, con il buco anche nel soffitto di sotto. Camminando `PagSu` /
  `PagGiù` cambiano piano.
- **Pareti**: per ogni stanza colore e finitura (pittura, carte da parati a righe, damascata, botanica,
  art déco, mattoni a vista, boiserie, cemento, piastrelle); ogni lato del muro segue la sua stanza.
- **Pavimenti**: parquet, spina di pesce, marmo, gres, scacchiera, esagonette, cementine, mosaico,
  ardesia, graniglia, cotto; fuori prato, ghiaia, lastre di pietra, autobloccanti, doghe.
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
- **Telefono e tablet**: su schermi stretti la barra in basso apre Mobili, Pianta ed Elenco in un
  pannello che sale dal basso (trascina la maniglia per allargarlo o chiuderlo); le opzioni
  secondarie stanno nel menu `⋯`. Un mobile selezionato mostra pulsanti grandi per ruotare,
  duplicare ed eliminare; tocca il titolo per tutte le misure. La scena si ridisegna solo quando
  serve, per risparmiare batteria.
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
| **Touch**: selezionare | tocca il mobile, il muro o la stanza |
| **Touch**: spostare | trascina il mobile *già selezionato* (sul resto un dito gira la vista) |
| **Touch**: vista | un dito gira (3D) o sposta (pianta), due dita zoom e spostamento |
| **Touch**: centrare su un mobile | doppio tocco |
| **Touch**: disegnare muri | trascina per mirare, il punto va dove alzi il dito; `Fine` per smettere |

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
- `js/decor.js` – modelli di decorazioni, luci, piante, musica, animali e giardino
- `js/art.js` – quadri, poster, mandala, tappeti e piastrelle disegnati su canvas
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
