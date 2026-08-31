# Workshop AI Adoption — IFAB Foundation

Web app per la fase **Valutazione e priorità**. Il partecipante importa il PDF Use Case prodotto nel workshop precedente, compila personalmente la valutazione Impact/Effort/Risk/Reuse, scrive le proprie considerazioni e soltanto dopo riceve i consigli dell'IA.

## Flusso attuale

1. Il facilitatore crea una sessione e condivide il codice a 6 caratteri.
2. Il partecipante apre `/join`, inserisce codice e nome e carica il PDF Use Case precedente (massimo 4 MB).
3. `POST /api/session/[code]/import-pdf` invia temporaneamente il documento a OpenAI, estrae i campi della scheda e salva in Redis soltanto i dati strutturati. Il PDF originale non viene conservato.
4. Il partecipante entra direttamente nell'unica fase visibile: **5 · Valutazione e priorità**.
5. Il partecipante assegna un valore da 1 a 5 a Impact, Effort, Risk e Reuse e può motivare ogni scelta. Formula, fascia e quadrante sono calcolati automaticamente.
6. Dopo la conferma vede criteri, spiegazioni ed emoji. Impact e Reuse migliorano salendo; Effort e Risk migliorano scendendo.
7. Prima di scrivere la propria considerazione, il partecipante deve completare il **Technology Feasibility Assessment**: un passaggio obbligatorio, sempre visibile (non un pulsante da aprire). Un AI Solution Architect conversazionale — a voce o scrivendo, con domande brevi, mirate e adattive (5-8, non un questionario fisso), con risposte rapide selezionabili o "Non lo so" — parte dal problema reale (output atteso, dati disponibili, regolarità del processo, autonomia richiesta) e non dalla tecnologia, per capire quale delle 8 famiglie (ML Classification/Regression/Clustering/Recommendation, Generative AI, RPA, AI Agent, Decision Support) è davvero adatta. Non propone di default GenAI o AI Agent. Il risultato — tecnologia, motivazioni, fattibilità, prerequisiti presenti/da verificare, rischio tecnico, approccio MVP — è calcolato in modo deterministico da `recommendTechnology`, mai dal modello. Solo dopo aver ottenuto un risultato si sblocca il campo delle considerazioni, che può essere precompilato con un clic dal risultato dell'assistente.
8. Prima dei consigli IA deve inserire una propria considerazione. `POST /api/session/[code]/priority-reflection` salva prima la considerazione e solo dopo genera i consigli strutturati.
9. Il partecipante può esportare in PDF valutazione, motivazioni, considerazione e consigli.

Il facilitatore non sblocca fasi e non assegna punteggi. La dashboard mostra in sola lettura il portfolio aggregato, lo stato di avanzamento e la matrice Impact × Effort.

I vecchi moduli relativi agli Step 1–4 restano nel repository esclusivamente per compatibilità con dati e sessioni storiche, ma non sono più raggiungibili dalle interfacce partecipante o facilitatore.

## Framework di priorità

Configurazione e criteri sono centralizzati in `src/config/priorityFramework.ts`; formule e classificazioni pure in `src/lib/priorityScoring.ts`.

```text
Priority Score = (Impact × 2) + Reuse - Effort - Risk + 7   # 0–20

15–20  Alta
 8–14  Media
 0–7   Bassa
```

I quadranti usano **Impact ≥ 4** ed **Effort ≤ 2**: Quick Win, Strategic Bet, Fill-in e Money Pit. `Risk = 5` attiva il veto; se il caso influenza decisioni su persone e `Risk > 3`, è richiesta una review etica.

Se il partecipante modifica la valutazione o importa un nuovo PDF, considerazione e consigli precedenti vengono eliminati per evitare incoerenze.

## Persistenza e API

- Redis conserva sessioni, partecipanti, schede importate, autovalutazioni, considerazioni e consigli per 48 ore.
- `POST /api/session/[code]/priority` salva l'autovalutazione del partecipante.
- `POST /api/session/[code]/priority-reflection` applica obbligatoriamente la sequenza considerazione → consigli IA.
- `GET /api/session/[code]/aggregate` alimenta il portfolio read-only del facilitatore.
- Il polling aggiorna entrambe le viste ogni 4 secondi.

## Setup locale

Prerequisiti: Node.js 18+, OpenAI API key e database Upstash Redis.

```bash
npm install
cp .env.local.example .env.local
# OPENAI_API_KEY, FACILITATOR_PASSWORD, KV_REST_API_URL, KV_REST_API_TOKEN
npm run dev
```

Apri `http://localhost:3000`.

Il modello del chatbot (Technology Feasibility Assessment) è `gpt-5` di default; per usarne uno diverso senza toccare il codice imposta la variabile d'ambiente opzionale `CHATBOT_MODEL` (es. `CHATBOT_MODEL=gpt-5-mini`).

`npm test` esegue i test (Vitest) sulla logica pura del chatbot: riconoscimento di "non lo so", percorso adattivo delle domande, motore di raccomandazione.

- Facilitatore: `/facilitator/login`
- Partecipante: `/join`

## Deploy

Il repository è collegato a Vercel tramite GitHub: ogni push su `main` avvia il deploy di produzione. Vedi anche [DEPLOYMENT.md](./DEPLOYMENT.md).

## File principali

```text
src/
├── app/join/page.tsx                              # ingresso e upload PDF
├── app/session/[code]/page.tsx                    # unica fase partecipante
├── app/facilitator/[code]/page.tsx                # portfolio read-only
├── app/api/session/[code]/import-pdf/route.ts     # estrazione del PDF
├── app/api/session/[code]/priority/route.ts       # autovalutazione
├── app/api/session/[code]/priority-reflection/route.ts
├── components/Step5Priority.tsx                   # valutazione, riflessione e consigli
├── components/TechSelectorChat.tsx                # Technology Feasibility Assessment (chat vocale/testuale)
├── components/PriorityPortfolio.tsx               # portfolio facilitatore
├── config/priorityFramework.ts                    # criteri, scale 1-5 e soglie di Impact/Effort/Risk/Reuse
├── config/techSelector.ts                         # famiglie tecnologiche, dimensioni adattive, motore di raccomandazione
└── lib/priorityScoring.ts                         # funzioni pure
```
