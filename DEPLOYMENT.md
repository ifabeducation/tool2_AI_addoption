# Deploy su Vercel

## 1. Importa il repository

1. Vai su [vercel.com/new](https://vercel.com/new)
2. Seleziona il repo GitHub `Gaiagi-t/ifab-workshop-ai-adoption`
3. Nella sezione "Environment Variables" del wizard di import, aggiungi già ora:
   - `OPENAI_API_KEY` = la tua chiave OpenAI
   - `FACILITATOR_PASSWORD` = la password che userai per accedere come facilitatore
4. Clicca **Deploy**

A questo punto l'app è online ma le route che usano Redis (sessione, join, sblocco step) falliranno finché non colleghi un database: è normale, si sistema al passo 2.

## 2. Collega un database Redis (senza serve un account Upstash separato)

Vercel offre Redis come integrazione Marketplace (è Upstash "dietro le quinte", ma gestito interamente dal dashboard Vercel):

1. Nel progetto appena creato, vai sul tab **Storage**
2. **Create Database** → scegli **Redis** (in alcuni account compare come "Upstash for Redis" nel Marketplace)
3. Segui il wizard (piano gratuito) e collega il database al progetto quando richiesto
4. Vercel imposta automaticamente le environment variable necessarie (tipicamente `KV_REST_API_URL` e `KV_REST_API_TOKEN`, a volte con prefisso diverso a seconda dell'integrazione — controlla in Settings → Environment Variables che i nomi corrispondano; il codice legge sia `KV_REST_API_URL`/`KV_REST_API_TOKEN` sia `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`)
5. Vercel triggera in automatico un redeploy con le nuove variabili attive; se non parte da solo, fallo manualmente da **Deployments → Redeploy**

## 3. Verifica

Apri l'URL assegnato da Vercel (es. `https://ifab-workshop-ai-adoption.vercel.app`):

1. Vai su `/facilitator/login`, accedi con un nome e la `FACILITATOR_PASSWORD` impostata
2. Viene creata una sessione con un codice a 6 caratteri
3. Da un altro browser/tab in incognito, vai su `/join`, inserisci quel codice e un nome
4. Apri il link partecipante, inserisci codice + nome e carica un PDF `Use Case Submission` esportato dal workshop precedente
5. Verifica che il partecipante arrivi direttamente a **Valutazione e priorità** e che il portfolio facilitatore mostri il PDF importato
6. Assegna i quattro punteggi dal portfolio: il risultato deve comparire al partecipante entro ~5 secondi
5. Prova la chat dell'agente AI in una sottosezione

Se qualcosa non risponde, controlla i log in Vercel → Deployments → (ultimo deploy) → Functions, per capire se manca una env var.

## Sviluppo locale con le stesse variabili di Vercel

Con la Vercel CLI (`npm install -g vercel`), dopo `vercel login` e `vercel link` (una tantum, dalla cartella del progetto), puoi scaricare le stesse variabili configurate online:

```bash
vercel env pull .env.local
```

In alternativa copia manualmente i valori da Vercel → Settings → Environment Variables dentro il tuo `.env.local`.

## Costi indicativi

- **OpenAI (gpt-4o-mini)**: pochi centesimi per l'intero workshop con una decina di partecipanti
- **Vercel + Redis (piano gratuito)**: sufficiente per un workshop dal vivo con poche decine di partecipanti
