'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, ArrowRight } from 'lucide-react';

/**
 * Painel de aprovação de hosts foi descontinuado.
 *
 * No novo modelo self-serve (Supabase), cada host ganha automaticamente seu
 * próprio workspace ao se cadastrar — não há mais fila de aprovação.
 *
 * Um painel de administração da PLATAFORMA (sobre todas as organizações) pode
 * ser reconstruído sobre uma tabela `platform_admins` + RLS quando fizer sentido.
 */
export default function AdminDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary p-3 rounded-2xl w-fit shadow-lg mb-2">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">Cadastro agora é self-serve</CardTitle>
          <CardDescription className="text-lg">
            Novos hosts recebem o próprio workspace automaticamente ao se cadastrar. A antiga fila de aprovação não é mais necessária.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/host">Ir para o Painel do Host <ArrowRight className="ml-2 w-4 h-4" /></Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Voltar para Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
