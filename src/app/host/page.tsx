'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Plus, Play, Trash2, Edit, Loader2, AlertCircle, LogOut, BarChart3, Globe, BookOpen, Copy, Check, Link as LinkIcon } from "lucide-react";
import { collection, query, where, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useDoc, useAuth } from "@/firebase";
import { useMemoFirebase } from "@/firebase/provider";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function HostDashboard() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isCreatingRoom, setIsCreatingRoom] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const hostProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return doc(db, 'hosts', user.uid);
  }, [db, user?.uid]);
  
  const { data: hostProfile, isLoading: isProfileLoading } = useDoc(hostProfileRef);

  const quizzesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid || isProfileLoading || !hostProfile || hostProfile.status !== 'active') {
      return null;
    }
    return query(
      collection(db, "quizzes"), 
      where("createdByUserId", "==", user.uid)
    );
  }, [db, user?.uid, isProfileLoading, hostProfile?.status]);
  
  const { data: quizzes, isLoading: isQuizzesLoading } = useCollection(quizzesQuery);

  const handleDelete = async (id: string) => {
    setIsDeletingId(id);
    try {
      await deleteDoc(doc(db, "quizzes", id));
      toast({ title: "Quiz excluído com sucesso" });
    } catch (error) {
      toast({ title: "Erro ao excluir quiz", variant: "destructive" });
    } finally {
      setIsDeletingId(null);
    }
  };

  const handlePublishToggle = async (quiz: any) => {
    try {
      await updateDoc(doc(db, "quizzes", quiz.id), {
        isPublishedAsChallenge: !quiz.isPublishedAsChallenge
      });
      toast({ 
        title: quiz.isPublishedAsChallenge ? "Prova removida dos desafios" : "Publicado como desafio assíncrono!",
        description: quiz.isPublishedAsChallenge ? "" : "Agora qualquer pessoa com o link pode responder."
      });
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const copyToClipboard = (quizId: string) => {
    const url = `${window.location.origin}/challenge/${quizId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(quizId);
    toast({
      title: "Link copiado!",
      description: "O link da prova foi copiado para sua área de transferência.",
    });
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleStartLive = async (quizId: string) => {
    if (!user) return;
    setIsCreatingRoom(quizId);
    try {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const gameRoomRef = doc(db, "gameRooms", pin);
      await setDoc(gameRoomRef, {
        quizId,
        hostId: user.uid,
        status: "waiting",
        currentQuestionIndex: 0,
        questionStartTime: null,
        players: {},
        createdAt: Date.now()
      });
      router.push(`/host/game/${pin}`);
    } catch (error) {
      toast({ title: "Erro ao criar sala de jogo", variant: "destructive" });
    } finally {
      setIsCreatingRoom(null);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (!hostProfile || hostProfile.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
        <Card className="w-full max-w-md shadow-2xl border-orange-200 border-2">
          <CardHeader className="text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Acesso Pendente</CardTitle>
            <CardDescription className="text-lg">
              Sua conta ({user.email}) ainda não foi ativada. Por favor, aguarde a aprovação do Superadmin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
             <div className="bg-muted p-4 rounded-lg text-xs break-all">
              <p className="font-bold mb-1 uppercase opacity-60">Seu UID para ativação:</p>
              <code>{user.uid}</code>
            </div>
            <Button variant="outline" onClick={handleLogout} className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/">Voltar para Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-xl shadow-lg">
            <Trophy className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-headline font-bold text-primary">QuizArena <span className="text-xs font-normal text-slate-400">Host</span></span>
        </Link>
        <div className="flex gap-4 items-center">
          <Button variant="ghost" onClick={handleLogout} size="sm" className="hidden sm:flex">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
          <Button asChild size="sm" className="font-bold rounded-full px-6">
            <Link href="/host/quiz/new"><Plus className="w-4 h-4 mr-2" /> Criar Novo</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-6xl">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-4xl font-headline font-black text-slate-900">Meus Quizzes e Provas</h1>
          <Badge variant="outline" className="px-4 py-1 text-slate-500 border-slate-300">
            {quizzes?.length || 0} Criados
          </Badge>
        </div>

        {isQuizzesLoading ? (
          <div className="flex justify-center py-32"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /></div>
        ) : quizzes && quizzes.length > 0 ? (
          <div className="grid gap-6">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="overflow-hidden border-2 hover:border-primary/20 transition-all bg-white shadow-sm hover:shadow-md rounded-2xl">
                <div className="flex flex-col md:flex-row p-8 gap-8 items-start">
                  <div className="bg-slate-100 w-20 h-20 rounded-2xl flex items-center justify-center shrink-0">
                     <BookOpen className="w-10 h-10 text-slate-400" />
                  </div>
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <CardTitle className="text-2xl font-bold">{quiz.title}</CardTitle>
                          {quiz.isPublishedAsChallenge && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                              <Globe className="w-3 h-3 mr-1" /> Público
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-slate-500 text-lg">{quiz.description}</CardDescription>
                      </div>
                      
                      {quiz.isPublishedAsChallenge && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-dashed flex flex-col gap-1 min-w-[200px]">
                           <span className="text-[10px] uppercase font-bold text-slate-400">Link da Prova</span>
                           <div className="flex items-center justify-between gap-2">
                             <code className="text-xs font-mono truncate max-w-[150px]">{quiz.id}</code>
                             <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(quiz.id)}>
                               {copiedId === quiz.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                             </Button>
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 pt-4">
                      <Button 
                        size="sm" 
                        onClick={() => handleStartLive(quiz.id)}
                        className="font-bold bg-primary hover:bg-primary/90 rounded-lg px-6"
                        disabled={isCreatingRoom === quiz.id}
                      >
                        {isCreatingRoom === quiz.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />} 
                        Iniciar Live
                      </Button>
                      <Button 
                        size="sm" 
                        variant={quiz.isPublishedAsChallenge ? "outline" : "secondary"} 
                        onClick={() => handlePublishToggle(quiz)}
                        className="font-bold rounded-lg"
                      >
                        {quiz.isPublishedAsChallenge ? "Remover dos Desafios" : "Publicar Prova"}
                      </Button>
                      
                      {quiz.isPublishedAsChallenge && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="font-bold rounded-lg text-primary hover:bg-primary/5" 
                          onClick={() => copyToClipboard(quiz.id)}
                        >
                          <LinkIcon className="w-4 h-4 mr-2" /> Copiar Link
                        </Button>
                      )}

                      <Button size="sm" variant="ghost" className="font-bold rounded-lg" asChild>
                        <Link href={`/challenge/${quiz.id}/leaderboard`}><BarChart3 className="w-4 h-4 mr-2" /> Resultados</Link>
                      </Button>
                      
                      <div className="flex-1" />
                      
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" className="rounded-lg" asChild title="Editar">
                          <Link href={`/host/quiz/edit/${quiz.id}`}><Edit className="w-4 h-4" /></Link>
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="rounded-lg text-destructive hover:bg-destructive/5" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl border-2">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-2xl font-black">Excluir este quiz?</AlertDialogTitle>
                              <AlertDialogDescription className="text-lg text-slate-500">
                                Esta ação não pode ser desfeita. Todas as questões e configurações de "<strong>{quiz.title}</strong>" serão removidas permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-6">
                              <AlertDialogCancel className="rounded-xl font-bold h-12">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(quiz.id)} 
                                className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-black h-12 px-8"
                                disabled={isDeletingId === quiz.id}
                              >
                                {isDeletingId === quiz.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Sim, Excluir Realmente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[3rem] border-4 border-dashed border-slate-200 flex flex-col items-center space-y-6">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
              <Plus className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-400 text-xl font-medium">Você ainda não criou nenhum quiz ou prova.</p>
            <Button asChild size="lg" className="rounded-full px-10 font-black"><Link href="/host/quiz/new">Criar Minha Primeira Prova</Link></Button>
          </div>
        )}
      </main>
    </div>
  );
}
