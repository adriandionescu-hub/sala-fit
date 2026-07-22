# SALA FIT

Aplicație PWA pentru program A/B/C, urmărirea seriilor, sincronizare cloud și analiză Motan AI.

## Versiunea 1.2.0 — API preview

- trecere sigură A → B → C → A înainte de deschiderea ferestrei de partajare;
- marcarea automată a exercițiilor completate;
- două seturi reprezentate ca `X / Set 2 / Set 3`;
- instalare pe telefon și funcționare offline;
- coadă locală pentru ședințe când telefonul nu are internet;
- salvare în Vercel Blob privat prin `/api/events`;
- analiză structurată prin OpenAI Responses API la `/api/coach`;
- cheia OpenAI rămâne exclusiv pe server;
- notificare și aplicare a versiunilor noi fără mutarea manuală a fișierului HTML.

Configurarea serverului este descrisă în [`API_SETUP.md`](./API_SETUP.md).

Datele rămân pe telefon până când API-ul este configurat și sincronizarea este confirmată.
