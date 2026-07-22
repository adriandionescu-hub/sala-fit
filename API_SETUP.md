# SALA FIT API v1

## Ce face

- salvează evenimentele SALA FIT în Vercel Blob privat;
- păstrează o coadă offline pe telefon și reîncearcă automat;
- trimite ședința finalizată către Motan AI;
- cheia OpenAI rămâne numai pe server.

## Publicare pe Vercel

1. Importă repo-ul GitHub `adriandionescu-hub/sala-fit` în Vercel.
2. Adaugă variabilele din `.env.example` în Project Settings → Environment Variables.
3. Creează un Blob Store privat și conectează-l proiectului.
4. Publică ramura `feature/api-v1` ca Preview.
5. În aplicația SALA FIT, la Setări API, introdu URL-ul Preview și cheia `SALA_FIT_CLIENT_KEY`.
6. După test, unește PR-ul în `main`; Vercel va publica automat producția.

Nu introduce niciodată cheia `OPENAI_API_KEY` în browser, GitHub Pages sau localStorage.
