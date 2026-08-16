'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Trophy, Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const { ensureOrganization } = useSupabaseAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast({
        variant: 'destructive',
        title: 'Supabase não configurado',
        description: 'Defina as variáveis NEXT_PUBLIC_SUPABASE_* em .env.local.',
      });
      return;
    }
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;

      if (data.session) {
        // Confirmação de e-mail desligada: já entra e ganha o workspace
        await ensureOrganization(name);
        router.push('/host');
      } else {
        // Confirmação de e-mail ligada: pede verificação
        setNeedsConfirm(true);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no Cadastro',
        description: error.message || 'Não foi possível criar sua conta.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (needsConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-md text-center p-8 space-y-6 shadow-2xl">
          <MailCheck className="w-20 h-20 text-primary mx-auto animate-bounce-slow" />
          <div className="space-y-2">
            <CardTitle className="text-3xl font-headline">Confirme seu e-mail</CardTitle>
            <CardDescription className="text-lg">
              Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, faça login para acessar seu painel.
            </CardDescription>
          </div>
          <Button asChild className="w-full h-12">
            <Link href="/login">Ir para Login</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto bg-primary p-3 rounded-2xl w-fit shadow-lg">
            <Trophy className="text-white w-8 h-8" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-headline">Torne-se um Host</CardTitle>
            <CardDescription>Crie sua conta e seu workspace em segundos</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full font-bold h-12" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Criar conta'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="text-primary font-bold hover:underline">
                Faça login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
