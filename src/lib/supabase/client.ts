'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Cliente Supabase para o browser (singleton).
 *
 * Realtime configurado com um heartbeat curto para detectar rápido quando a
 * conexão cai (redes de escola/empresa com proxy). O hook `useLiveSession`
 * complementa com um fallback de polling quando o WebSocket é bloqueado.
 */
let client: SupabaseClient<Database> | null = null;

/** True quando as variáveis de ambiente do Supabase estão presentes. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local'
    );
  }

  client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      // heartbeat mais frequente => detecta queda de conexão mais cedo
      heartbeatIntervalMs: 15000,
      params: { eventsPerSecond: 10 },
    },
  });

  return client;
}
