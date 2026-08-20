# Workshop AI Adoption — IFAB Foundation

App interattiva per la fase finale del workshop AI Adoption. Il partecipante carica il PDF **Use Case Submission** prodotto nel workshop precedente e accede direttamente alla valutazione e priorità; il facilitatore/AI Board assegna i punteggi e pubblica l'esito.

## Percorso attuale — import PDF e Blocco 3

1. Il facilitatore crea una sessione e condivide il codice a 6 caratteri.
2. Il partecipante apre `/join`, inserisce codice e nome e seleziona il PDF Use Case precedente (massimo 4 MB).
3. La route `POST /api/session/[code]/import-pdf` invia temporaneamente il PDF al modello OpenAI, estrae e normalizza i campi della scheda e salva in Redis solo i dati strutturati. Il PDF originale non viene conservato.
4. Gli Step 1–4 vengono saltati e il partecipante arriva direttamente allo Step 5, in attesa della valutazione dell'AI Board.
5. Il facilitatore trova il caso importato nel portfolio, assegna Impact, Effort, Risk e Reuse e salva la valutazione. Il partecipante riceve l'esito tramite polling e può esportarlo in PDF.

Un nuovo import dello stesso partecipante sostituisce la scheda precedente e invalida l'eventuale valutazione già presente, evitando che i punteggi restino associati al documento sbagliato. Le submission create con il percorso storico restano leggibili e modificabili per compatibilità.

## Percorso storico compatibile (Step 1-5)

Gli Step 1-3 sono il Blocco 1 (scheda di attrito); lo Step 4 raccoglie il caso d'uso e sostituisce il vecchio Blocco 2.

- **Step 1 — Scheda di attrito**: 21 domande sì/no in elenco unico (i quattro blocchi restano interni). Su ogni sì si apre un nome facoltativo per l'attività e lo **slider Impatto 1-10**, senza valore preimpostato: va mosso. Tornando al no, i campi si chiudono e il dato viene scartato. Contatore risposte in alto, avviso non bloccante oltre 8 sì, messaggio dedicato se non c'è nessun sì. La **domanda 21** (eccezioni gestite con criteri non documentati) è una spia: non apre lo slider, non concorre alle candidate, alza solo il flag `criteriTaciti`.
- **Step 2 — Caratteristiche delle tre candidate**: le tre attività con impatto più alto (a parità vince quella dichiarata prima), una scheda alla volta con navigazione avanti/indietro. Un solo slider per scheda, deciso dal blocco della domanda di origine (costanza del formato · disponibilità dei dati · template e fonti · esplicitezza dei criteri). Nessun punteggio o anteprima; concludendo lo step le risposte si bloccano e le candidate vengono congelate.
- **Step 3 — Esito**: **matrice Impatto × Prontezza in SVG inline** con i quattro quadranti nominati e le candidate posizionate, poi una scheda per candidata in ordine di punteggio con la riga di motivazione che spiega la posizione. Export PDF.
- **Step 4 — Use Case**: un unico step per il caso d'uso. Non c'è un modulo da compilare: l'agente conduce un'intervista che parte dalla domanda generica su com'è oggi il processo e qual è il problema, e da quello che il partecipante racconta ricava i campi della scheda. Alla fine la scheda compare precompilata, da confermare o correggere, con export PDF. Vedi [Step 4 — Use Case: intervista e scheda](#step-4--use-case-intervista-e-scheda).
- **Step 5 — Valutazione e priorità**: il facilitatore/AI Board valuta ogni Use Case sulle dimensioni Impact, Effort, Risk e Reuse. Il partecipante non può modificare i punteggi: quando lo step viene sbloccato vede l'esito finale in sola lettura e può esportarlo in PDF.

Calcolo (in `src/lib/frizioneScoring.ts`, unico punto di verità, usato anche dalla dashboard):

```
prontezza = blocco "sposti" ? max(0, 10 - |valore - 5.5| × 2) : valore   // campana: l'ottimo è al centro
punteggio = impatto × prontezza                                          // prodotto, non somma: 0-100
```

I casi limite si valutano in ordine e cambiano la lettura della posizione (non il punteggio): formato costante (≤2 su "sposti"), formato sempre diverso (≥9), valore ≤3 sugli altri blocchi. I due estremi di "sposti" ricevono lo stesso punteggio per effetto della campana ma **messaggi opposti**. Se `criteriTaciti` è vero compare la nota esplicita sulla formalizzazione dei criteri.

Domande, ancoraggi, tecnologie e messaggi vivono in `src/config/block1Frizione.ts`.

Nel percorso storico il facilitatore può ancora sbloccare ogni step dalla dashboard; i partecipanti vedono lo sblocco entro pochi secondi (polling).

## Blocco 3 — Valutazione e priorità

La dashboard del facilitatore contiene un portfolio di tutti gli Use Case iniziati, un editor di valutazione per ciascun partecipante e la matrice **Impact × Effort**. I quattro punteggi sono interi da 1 a 5 e vengono salvati in Redis nella submission del partecipante; score, classe e quadrante sono sempre ricalcolati, quindi non possono diventare incoerenti con i punteggi sorgente.

```text
Priority Score = (Impact × 2) + Reuse - Effort - Risk + 7   # intervallo 0–20

15–20  Alta   — fast-track
 8–14  Media  — review standard
 0–7   Bassa  — backlog
```

I quadranti usano le soglie **Impact ≥ 4** e **Effort ≤ 2**: Quick Win, Strategic Bet, Fill-in e Money Pit. `Risk = 5` attiva il veto e richiede una valutazione Legal/Compliance prima dell'approvazione. Se il caso influenza decisioni su persone specifiche e `Risk > 3`, viene inoltre richiesta una valutazione etica esplicita.

Configurazione, criteri e soglie vivono in `src/config/priorityFramework.ts`; le funzioni pure di calcolo e classificazione in `src/lib/priorityScoring.ts`. La scrittura passa esclusivamente dalla route autenticata `POST /api/session/[code]/priority`. Lo Step 5 del partecipante legge gli stessi dati e non espone controlli di modifica.

## Step 4 — Use Case: intervista e scheda

Lo Step 4 e la scheda Use Case sono **un unico step**: la scheda (che ricalca il template `Workshop1_Template_Use_Case_Submission_1_page.docx`) non si compila a mano campo per campo, si compila conversando. Il facilitatore sblocca lo step quando il gruppo è pronto.

**Fase 1 — intervista.** L'agente parte dalla domanda generica dello Step 4 (com'è oggi il processo, chi è coinvolto, dove si inceppa, cosa costa) e da lì chiede solo quello che non ha ancora sentito. Le domande sono raggruppate per **argomento**: un argomento raccoglie tutti i campi che si possono ottenere con una domanda sola, così bastano ~11 domande per 28 campi. Una barra in alto mostra gli argomenti coperti.

- A ogni turno l'agente risponde in **JSON**: il messaggio per il partecipante, i campi che ha ricavato e gli argomenti che considera chiusi. I campi passano da `sanitizeInterviewFields` (id inesistenti, valori vuoti e opzioni non previste vengono scartati): nella scheda non può finire un valore che il form non sa mostrare.
- **Gli argomenti ancora aperti li decide il server**, dai `closedGroups` accumulati nella submission, non il modello: l'avanzamento (e quindi il passaggio alla scheda) non dipende da quanto il modello ricorda della conversazione. Se il partecipante non sa rispondere, l'argomento si chiude comunque con "Da verificare" nei campi di testo.
- Se una risposta contiene informazioni di argomenti successivi, l'agente compila anche quei campi e non li richiede.
- Argomenti, domande suggerite, catalogo dei campi e prompt vivono in `src/config/block2Form.ts`: modificare lì testi, opzioni o raggruppamenti aggiorna form, intervista e conteggi, senza toccare componenti o API.

**Fase 2 — scheda da confermare.** Finita l'intervista (o in qualsiasi momento, con "Vai alla scheda") si apre la scheda con la stessa struttura del template — 1.0 Problema/opportunità di business · 1.1 Soluzione proposta · 1.2 Obiettivi strategici · 1.3 Dati e contesto · 1.4 Impatto atteso · 1.5 Metriche di successo · 1.6 Valutazione etica preliminare · 1.7 Rischi, complessità e resistenze — con le informazioni raccolte già organizzate nei campi.

- Ogni campo resta **modificabile a mano**; si conferma con "Confermo la scheda". La bozza si autosalva come negli altri step.
- "Torna alla conversazione" e "Chiedi all'assistente" (per sezione) riportano alla chat con la domanda già scritta: si completa raccontando, invece di scrivere campo per campo.
- In fondo alla scheda, **"Scarica PDF"**: il PDF si compone con le primitive testuali di jsPDF (`src/lib/useCasePdf.ts`), non fotografando il DOM, così va su più pagine e il testo resta selezionabile.
- La fase raggiunta (`interviewDone`) vive lato server: il rientro riapre la scheda invece di ricominciare la conversazione.
- La dashboard del facilitatore mostra ✅ per le schede confermate, `n/N` per quelle in bozza, e un pulsante **PDF per ogni partecipante** che scarica la sua scheda dai dati salvati (non serve che la pagina del partecipante sia aperta).

## Interazione vocale

Ogni chat (l'intervista dello Step 4 e gli assistenti degli Step 1 e 2) ha un **pulsante col microfono**: si parla e il testo riconosciuto si accoda al campo di risposta, dove si rilegge e si corregge prima di inviare — in una sala con più voci l'invio automatico sarebbe un guaio. Accanto al titolo della chat c'è anche l'interruttore per farsi **leggere ad alta voce** le risposte dell'agente (spento per default).

Tutto passa dalle API del browser (Web Speech, `src/components/VoiceInput.tsx`): nessun servizio esterno, nessun audio che lascia il dispositivo. Su Chrome ed Edge funziona; dove il riconoscimento non c'è (Firefox) il pulsante non compare invece di dare errore al clic.

## Pulsante "test"

In alto in ogni pagina c'è un piccolo pulsante **test** che compila i campi di quella pagina con dati di esempio (`src/lib/testData.ts`), per provare il tool o verificare un deploy senza digitare tutto:

| Pagina | Che cosa fa |
| --- | --- |
| home | apre `/join` con il nome di esempio già inserito |
| ingresso partecipante | nome di esempio, più l'ultimo codice sessione visto su quel browser (il codice non si può inventare) |
| login facilitatore | nome di esempio (la password resta da inserire) |
| dashboard facilitatore | sblocca tutti gli step |
| vista partecipante | compila lo step che si sta guardando: Step 1, Step 2, Step 1+2 per vedere l'esito nello Step 3, o la scheda Use Case già piena |

I dati di esempio sono coerenti fra gli step: lo Step 2 lavora sulle candidate generate dallo Step 1 e la scheda Use Case racconta la stessa attività.

## Riprendere una sessione interrotta

Tutto lo stato vive lato server (Redis, TTL 48h): chiudere il browser, ricaricare la pagina o cambiare dispositivo non fa perdere il lavoro.

**Partecipante**
- L'identità (codice sessione + participantId + nome) resta nel `localStorage`: riaprendo l'app compare in home la card **"Riprendi"**, e su `/join` il pulsante **"Rientra nella sessione"** — senza ridigitare nulla.
- Da un altro dispositivo (o dopo aver svuotato il browser) basta rientrare su `/join` con lo **stesso codice e lo stesso nome**: il match sul nome normalizzato ricollega alla stessa submission.
- Tutti gli step **si autosalvano** dopo ~1 secondo di inattività (e all'uscita dallo step), quindi anche la bozza non ancora confermata viene ripristinata.
- Viene ripristinato anche il **punto in cui ci si era interrotti** (Step 1-3 o Step 4 Use Case, e per lo Step 4 anche la fase: intervista o scheda), salvato lato server a ogni cambio step.
- Se la sessione è scaduta o il partecipante non risulta più registrato, si viene riportati a `/join` con un avviso, invece di restare su una pagina in caricamento.

**Facilitatore**
- Il cookie di autenticazione dura 12h: rientrando su `/facilitator/login` con il cookie valido si salta la password.
- Dopo l'accesso viene mostrato l'**elenco delle sessioni ancora attive** (codice, orario, numero di partecipanti) per riprendere quella in corso; la sessione usata l'ultima volta su quel browser è marcata "ultima usata". Una nuova sessione si crea solo esplicitamente (o automaticamente se non ce n'è nessuna attiva).
- Se il codice aperto non è più valido, la dashboard propone il ritorno al selettore delle sessioni.
- Ogni sessione si può **eliminare** (icona cestino nel selettore, pulsante "Elimina" nella dashboard, con conferma in due passaggi): rimuove meta, partecipanti e submission. I partecipanti eventualmente collegati vengono riportati a `/join` al polling successivo.

## Setup locale

### Prerequisiti
- Node.js 18+
- Una chiave OpenAI API (per gli agenti)
- Un database Upstash Redis gratuito (https://console.upstash.com) — usato come store di stato condiviso per la durata dell'evento

### Installazione

```bash
npm install
cp .env.local.example .env.local
# compila OPENAI_API_KEY, FACILITATOR_PASSWORD, KV_REST_API_URL, KV_REST_API_TOKEN
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

- **Facilitatore**: vai su `/facilitator/login`, inserisci nome + `FACILITATOR_PASSWORD`. Al primo accesso viene creata una sessione con un codice a 6 caratteri da condividere con i partecipanti.
- **Partecipanti**: vanno su `/join` (o sul link copiato dal facilitatore), inseriscono codice sessione + nome e caricano il PDF Use Case del workshop precedente.

## Deploy su Vercel

Vedi [DEPLOYMENT.md](./DEPLOYMENT.md) per la guida passo-passo (import del repo, collegamento di un database Redis dal tab Storage di Vercel senza bisogno di un account Upstash separato, verifica end-to-end).

## Struttura del progetto

```
src/
├── app/
│   ├── page.tsx                      # landing (scelta partecipante/facilitatore)
│   ├── join/page.tsx                 # ingresso partecipante e upload PDF Use Case
│   ├── facilitator/login/page.tsx    # login facilitatore
│   ├── facilitator/[code]/page.tsx   # dashboard, valutazione AI Board e portfolio
│   ├── session/[code]/page.tsx       # vista partecipante (step 1-5; valutazione finale read-only)
│   └── api/                          # route handler (auth, sessione, agente AI)
│       ├── session/list              # sessioni attive: rientro del facilitatore
│       ├── session/[code]/resume     # rientro del partecipante con identità salvata
│       └── session/[code]/import-pdf # estrazione PDF e accesso diretto al Blocco 3
├── components/                       # Step1Frizione, Step2Caratteristiche, Step3Esito,
│                                     # MatriceImpattoProntezza (SVG),
│                                     # UseCaseStep (Step 4: intervista + scheda),
│                                     # UseCaseInterview (la chat che compila la scheda),
│                                     # AgentChat, AssistantPanel (pannello fisso a destra),
│                                     # VoiceInput (microfono e lettura), TestFillButton, ResumeCard
├── config/block1Frizione.ts          # Blocco 1: 21 domande, ancoraggi, tecnologie, messaggi, prompt
├── config/block2Form.ts              # Step 4: sezioni e campi della scheda, argomenti e prompt dell'intervista
├── config/priorityFramework.ts       # Blocco 3: criteri, formula, soglie, quadranti e regole di rischio
└── lib/                              # tipi, frizioneScoring (calcolo esito), client Redis,
                                      # helper sessione, auth, client API, participantStorage,
                                      # pdfImport, priorityScoring, export PDF e testData
```

## Estendere ai blocchi successivi

L'architettura (sessione + step unlock + assistente AI per step + output) è pensata per essere riusata per i blocchi successivi (Prioritizzazione, Design, Qualità), aggiungendo nuove chiavi a `UnlockedSteps`, nuovi file di config analoghi a `block1Flow.ts`/`block2Form.ts` e nuovi componenti Step, senza toccare il modello di sessione/autenticazione.

Nota: la whitelist degli step in `/api/session/[code]/unlock` deriva da `DEFAULT_UNLOCKED_STEPS`, quindi una nuova chiave è sbloccabile senza altre modifiche. Le sessioni già esistenti vengono normalizzate con i nuovi step bloccati per default, preservando tutti gli sblocchi e i dati precedenti.
