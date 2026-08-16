'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './client';
import type { GamePlayer, GameSession } from './types';

export interface LiveSessionState {
  session: GameSession | null;
  players: GamePlayer[];
  isLoading: boolean;
  /** confirmado inexistente/encerrado pelo servidor */
  isMissing: boolean;
  /** conexão em tempo real ativa; false = usando fallback de polling */
  isRealtime: boolean;
  /** houve pelo menos uma falha recente de conexão */
  isReconnecting: boolean;
}

const POLL_INTERVAL_MS = 2500;

/**
 * Assina o estado do jogo ao vivo (sessão + jogadores) por PIN.
 *
 * Estratégia de resiliência (pensada para Wi-Fi de escola/empresa):
 *  1. Tenta Realtime (WebSocket) do Supabase.
 *  2. Se o canal não fica "SUBSCRIBED" ou cai, liga um POLLING via HTTP
 *     (SELECT a cada 2,5s) que sempre passa por proxies restritivos.
 *  3. Ao voltar o Realtime, o polling é desligado.
 * Assim o jogador nunca "congela" numa questão: mesmo sem WebSocket, o
 * estado continua atualizando pelo polling.
 */
export function useLiveSession(pin: string | null | undefined): LiveSessionState {
  const supabase = getSupabaseBrowserClient();

  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!pin);
  const [isMissing, setIsMissing] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!pin) return;
    const { data: s, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('pin', pin)
      .maybeSingle();

    if (error) {
      setIsReconnecting(true);
      return;
    }

    if (!s) {
      setSession(null);
      setIsMissing(true);
      setIsLoading(false);
      return;
    }

    setSession(s as GameSession);
    sessionIdRef.current = (s as GameSession).id;
    setIsMissing(false);
    setIsReconnecting(false);

    const { data: p } = await supabase
      .from('game_players')
      .select('*')
      .eq('session_id', (s as GameSession).id);
    if (p) setPlayers(p as GamePlayer[]);
    setIsLoading(false);
  }, [pin, supabase]);

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    setIsRealtime(false);
    fetchState();
    pollTimer.current = setInterval(fetchState, POLL_INTERVAL_MS);
  }, [fetchState]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!pin) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    // Carga inicial imediata (não espera o WebSocket)
    fetchState();

    const channel = supabase
      .channel(`session:${pin}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `pin=eq.${pin}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSession(null);
            setIsMissing(true);
          } else {
            setSession(payload.new as GameSession);
            sessionIdRef.current = (payload.new as GameSession).id;
            setIsMissing(false);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players' },
        (payload) => {
          const row = (payload.new ?? payload.old) as GamePlayer;
          if (!sessionIdRef.current || row.session_id !== sessionIdRef.current) return;
          setPlayers((prev) => {
            if (payload.eventType === 'DELETE') return prev.filter((x) => x.id !== row.id);
            const next = prev.filter((x) => x.id !== (payload.new as GamePlayer).id);
            return [...next, payload.new as GamePlayer];
          });
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setIsRealtime(true);
          setIsReconnecting(false);
          stopPolling(); // Realtime ok → dispensa o polling
          fetchState();  // ressincroniza o que possa ter mudado durante a conexão
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsReconnecting(true);
          startPolling(); // WebSocket falhou/bloqueado → garante updates por HTTP
        }
      });

    channelRef.current = channel;

    // Se em 4s o Realtime não subiu (proxy bloqueando), já liga o polling
    const guard = setTimeout(() => {
      if (!cancelled && !channelRef.current) return;
      setIsRealtime((rt) => {
        if (!rt) startPolling();
        return rt;
      });
    }, 4000);

    // Ressincroniza ao voltar o foco / reconectar a rede
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchState();
    };
    const onOnline = () => fetchState();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearTimeout(guard);
      stopPolling();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [pin, supabase, fetchState, startPolling, stopPolling]);

  return { session, players, isLoading, isMissing, isRealtime, isReconnecting };
}
