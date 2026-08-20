import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Client Redis condiviso (Upstash / Vercel KV) usato come store di stato
 * per la durata dell'evento. Non serve persistenza oltre il workshop: le
 * chiavi hanno comunque un TTL per evitare accumulo indefinito nel free tier.
 */
export function getRedis(): Redis {
  if (client) return client;

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Redis non configurato: imposta KV_REST_API_URL e KV_REST_API_TOKEN (o UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) in .env.local"
    );
  }

  client = new Redis({ url, token });
  return client;
}

// TTL delle chiavi di sessione: 2 giorni, sufficiente per un workshop dal vivo
// (anche a cavallo di due giornate) senza richiedere storicizzazione a lungo termine.
export const SESSION_TTL_SECONDS = 60 * 60 * 48;
