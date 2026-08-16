'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './client';

export interface Membership {
  orgId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending' | 'suspended';
}

interface AuthState {
  user: User | null;
  session: Session | null;
  membership: Membership | null;
  /** true durante a checagem inicial de sessão */
  isLoading: boolean;
  signOut: () => Promise<void>;
  /** garante que o usuário tenha um workspace (chamado no onboarding) */
  ensureOrganization: (name?: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  // Enquanto o Supabase não estiver configurado, o provider vira um no-op e o
  // app continua funcionando no Firebase (transição sem quebrar nada).
  const supabase = configured ? getSupabaseBrowserClient() : null;
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMembership = useCallback(
    async (uid: string | undefined) => {
      if (!supabase || !uid) {
        setMembership(null);
        return;
      }
      const { data } = await supabase
        .from('org_members')
        .select('org_id, role, status')
        .eq('user_id', uid)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      setMembership(
        data ? { orgId: data.org_id, role: data.role, status: data.status } : null
      );
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadMembership(data.session?.user?.id);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      await loadMembership(newSession?.user?.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadMembership]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setMembership(null);
  }, [supabase]);

  const ensureOrganization = useCallback(
    async (name?: string) => {
      if (!supabase) return null;
      const { data, error } = await supabase.rpc('get_or_create_personal_org', {
        p_name: name ?? null,
      });
      if (error) {
        console.error('ensureOrganization:', error.message);
        return null;
      }
      await loadMembership(user?.id);
      return data as string;
    },
    [supabase, user?.id, loadMembership]
  );

  return (
    <AuthContext.Provider
      value={{ user, session, membership, isLoading, signOut, ensureOrganization }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook de autenticação Supabase (substitui o useUser do Firebase). */
export function useSupabaseAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSupabaseAuth deve ser usado dentro de SupabaseAuthProvider');
  return ctx;
}
