
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useCollection, useDoc } from '@/firebase';
import { collection, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, UserCheck, UserX, Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase';

export default function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Redirect if not logged in
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Check if user is superadmin
  const adminRoleRef = useMemoFirebase(() => user ? doc(db, 'admin_roles', user.uid) : null, [db, user]);
  const { data: adminRole, isLoading: isAdminChecking } = useDoc(adminRoleRef);

  // Fetch all hosts - ONLY if admin role is confirmed
  const hostsQuery = useMemoFirebase(() => {
    if (!adminRole) return null;
    return query(collection(db, 'hosts'), orderBy('createdAt', 'desc'));
  }, [db, adminRole]);
  
  const { data: hosts, isLoading: isHostsLoading } = useCollection(hostsQuery);

  const toggleStatus = async (hostId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await updateDoc(doc(db, 'hosts', hostId), { status: newStatus });
      toast({ title: `Host ${newStatus === 'active' ? 'ativado' : 'bloqueado'} com sucesso!` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar status', description: 'Você não tem permissão para isso.' });
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (isUserLoading || isAdminChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (!adminRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
        <Card className="w-full max-w-md border-destructive shadow-2xl">
          <CardHeader className="text-center">
            <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription className="text-lg">
              Você não possui privilégios de Superadmin para acessar este painel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" onClick={handleLogout} className="w-full">
               <LogOut className="w-4 h-4 mr-2" /> Sair e trocar conta
            </Button>
            <Button variant="ghost" onClick={() => router.push('/')} className="w-full">
               Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <header className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <h1 className="text-4xl font-headline font-bold">Painel Superadmin</h1>
          </div>
          <p className="text-muted-foreground text-lg">Gerencie e ative novos Hosts do sistema.</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Sair do Painel
        </Button>
      </header>

      <main className="max-w-6xl mx-auto space-y-6">
        <div className="grid gap-4">
          {isHostsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : hosts && hosts.length > 0 ? (
            hosts.map((host: any) => (
              <Card key={host.id} className="overflow-hidden border-2 hover:border-primary/20 transition-all">
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <h3 className="text-xl font-bold">{host.displayName}</h3>
                      <Badge variant={host.status === 'active' ? 'default' : host.status === 'pending' ? 'secondary' : 'destructive'}>
                        {host.status === 'active' ? 'Ativo' : host.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{host.email}</p>
                    <p className="text-xs text-muted-foreground italic">Cadastrado em: {new Date(host.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="flex gap-3">
                    {host.status !== 'active' ? (
                      <Button onClick={() => toggleStatus(host.id, host.status)} className="bg-green-600 hover:bg-green-700">
                        <UserCheck className="w-4 h-4 mr-2" /> Ativar Host
                      </Button>
                    ) : (
                      <Button onClick={() => toggleStatus(host.id, host.status)} variant="destructive">
                        <UserX className="w-4 h-4 mr-2" /> Bloquear Acesso
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
              <p className="text-muted-foreground">Nenhum host cadastrado no momento.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
