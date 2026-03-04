
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useUser, deleteDocumentNonBlocking } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, Play, SkipForward, Loader2, LogOut, Timer, Coins, ArrowLeft, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMemoFirebase } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

export default function HostGameControl() {
  const { pin } = useParams();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentPotential, setCurrentPotential] = useState<number>(0);
  const [isFinishing, setIsFinishing] = useState(false);

  // Proteção de rota
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  const roomRef = useMemoFirebase(() => {
    if (!db || !pin) return null;
    return doc(db, 'gameRooms', pin as string);
  }, [db, pin]);

  const { data: room, isLoading: isRoomLoading } = useDoc(roomRef);

  const quizRef = useMemoFirebase(() => {
    if (!db || !room?.quizId) return null;
    return doc(db, 'quizzes', room.quizId);
  }, [db, room?.quizId]);

  const { data: quiz, isLoading: isQuizLoading } = useDoc(quizRef);

  const players = room?.players ? Object.values(room.players) : [];

  // Redirecionamento automático se a sala for deletada (por outro meio ou pelo próprio host)
  useEffect(() => {
    if (pin && !isRoomLoading && room === null && !isFinishing) {
      router.push('/host');
    }
  }, [room, isRoomLoading, router, pin, isFinishing]);

  // Cronômetro do Host e Cálculo de Pontuação Dinâmica
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (room?.status === 'question' && room?.questionStartTime && quiz) {
      const currentQ = quiz.questions[room.currentQuestionIndex];
      const updateTimer = () => {
        const elapsed = (Date.now() - room.questionStartTime!) / 1000;
        const remaining = Math.max(0, currentQ.timeLimitSeconds - elapsed);
        
        setTimeLeft(Math.ceil(remaining));

        const basePoints = currentQ.basePoints || 1000;
        const ratio = remaining / currentQ.timeLimitSeconds;
        const potential = Math.round(basePoints * (0.5 + 0.5 * ratio));
        setCurrentPotential(potential);
      };
      updateTimer();
      interval = setInterval(updateTimer, 100);
    }
    return () => clearInterval(interval);
  }, [room?.status, room?.questionStartTime, room?.currentQuestionIndex, quiz]);

  const handleStartGame = () => {
    if (!roomRef) return;
    updateDoc(roomRef, {
      status: 'question',
      currentQuestionIndex: 0,
      questionStartTime: Date.now()
    });
  };

  const handleNextQuestion = () => {
    if (!roomRef || !quiz || !room) return;
    const nextIndex = room.currentQuestionIndex + 1;
    const payload = nextIndex < quiz.questions.length 
      ? { status: 'question', currentQuestionIndex: nextIndex, questionStartTime: Date.now() }
      : { status: 'podium' };

    updateDoc(roomRef, payload);
  };

  const handleShowResults = () => {
    if (!roomRef) return;
    updateDoc(roomRef, { status: 'results' });
  };

  const handleFinishGame = () => {
    if (!window.confirm('Deseja encerrar esta arena permanentemente?')) return;
    
    setIsFinishing(true);
    if (roomRef) {
      // Exclui o documento sem travar o redirecionamento
      deleteDocumentNonBlocking(roomRef);
      toast({ title: "Arena encerrada com sucesso" });
      router.push('/host');
    } else {
      router.push('/host');
    }
  };

  if (isRoomLoading || isQuizLoading || isAuthLoading || isFinishing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-bold animate-pulse">
            {isFinishing ? 'ENCERRANDO ARENA...' : 'CARREGANDO ARENA...'}
          </p>
        </div>
      </div>
    );
  }

  // Se a sala não existe, mostramos uma tela de transição rápida enquanto o useEffect redireciona
  if (!room || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-bold">Encerrando...</p>
        </div>
      </div>
    );
  }

  const currentQ = quiz?.questions[room.currentQuestionIndex];
  const timeProgress = currentQ ? (timeLeft / currentQ.timeLimitSeconds) * 100 : 0;

  // URL para o QR Code (Aponta para a Home com o PIN pré-preenchido)
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/?pin=${pin}` : '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="bg-primary p-2 rounded-xl">
             <Trophy className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-none mb-1">{quiz?.title}</h1>
            <Badge variant="outline" className="font-bold border-slate-200">PIN: {pin}</Badge>
          </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" size="sm" onClick={handleFinishGame} className="font-bold rounded-xl text-destructive hover:bg-destructive/5 border-destructive/20">
             <LogOut className="w-4 h-4 mr-2" /> Encerrar Arena
           </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-5xl space-y-10">
        {room.status === 'waiting' && (
          <div className="text-center space-y-12 py-10">
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Aguardando na Arena...</h2>
              <div className="text-9xl font-black text-primary drop-shadow-2xl">{pin}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-8">
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <Users className="w-6 h-6" /> Jogadores Conectados ({players.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                   <div className="flex flex-wrap gap-3 justify-center">
                     {players.length > 0 ? players.map((p: any, idx) => (
                       <Badge key={idx} variant="secondary" className="text-xl py-3 px-8 rounded-2xl bg-slate-100 hover:bg-primary hover:text-white transition-colors cursor-default">
                         {p.nickname}
                       </Badge>
                     )) : (
                       <div className="py-10 text-center space-y-4 opacity-40">
                          <Loader2 className="w-10 h-10 animate-spin mx-auto" />
                          <p className="font-bold uppercase tracking-widest">Esperando o primeiro combatente...</p>
                       </div>
                     )}
                   </div>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-6">
                <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white p-8 flex flex-col items-center justify-center space-y-6">
                   <p className="text-center font-bold text-lg opacity-80">Todos prontos?</p>
                   <Button size="lg" className="w-full h-20 text-2xl font-black bg-white text-primary hover:bg-white/90 rounded-[1.5rem]" onClick={handleStartGame} disabled={players.length === 0}>
                     <Play className="w-8 h-8 mr-3 fill-current" /> INICIAR
                   </Button>
                </Card>
                
                <div className="bg-slate-200 p-6 rounded-[2.5rem] text-center space-y-4 flex flex-col items-center shadow-inner">
                   <div className="bg-white p-4 rounded-3xl shadow-lg border-2 border-white">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`}
                        alt="Acesso rápido via QR Code"
                        className="w-32 h-32"
                      />
                   </div>
                   <div className="space-y-1">
                      <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest leading-none">Acesso Rápido</p>
                      <p className="font-black text-slate-900 text-xs">Aponte a câmera para entrar</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {room.status === 'question' && (
          <div className="text-center space-y-12">
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-4">
                 <Badge variant="outline" className="text-xl py-2 px-6 border-primary text-primary font-black rounded-full uppercase">Questão {room.currentQuestionIndex + 1}</Badge>
                 
                 <div className="flex items-center gap-6 bg-slate-900 text-white px-8 py-3 rounded-full shadow-lg">
                    <div className="flex items-center gap-2 border-r border-white/20 pr-6">
                      <Timer className={`w-8 h-8 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : ''}`} />
                      <span className={`text-3xl font-black ${timeLeft <= 5 ? 'text-red-400' : ''}`}>{timeLeft}s</span>
                    </div>
                    <div className="flex items-center gap-2 text-yellow-400">
                      <Coins className="w-8 h-8" />
                      <span className="text-3xl font-black">{currentPotential} pts</span>
                    </div>
                 </div>
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">{currentQ?.question}</h2>
              <Progress value={timeProgress} className="h-4 max-w-2xl mx-auto rounded-full bg-slate-200" />
            </div>
            
            <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
               {currentQ?.alternatives.map((alt, idx) => (
                 <div key={idx} className="p-8 rounded-[2rem] border-4 border-slate-100 bg-white text-left font-bold text-2xl flex items-center shadow-sm">
                   <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mr-5 shrink-0">
                     {String.fromCharCode(65 + idx)}
                   </span>
                   {alt}
                 </div>
               ))}
            </div>

            <Button onClick={handleShowResults} size="lg" className="h-16 px-12 text-xl font-black rounded-2xl shadow-xl">
              <SkipForward className="w-6 h-6 mr-3" /> Encerrar Tempo e Ver Resultados
            </Button>
          </div>
        )}

        {room.status === 'results' && (
          <div className="space-y-12">
            <div className="text-center space-y-6">
               <h2 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Resposta Correta</h2>
               <div className="max-w-2xl mx-auto p-10 rounded-[3rem] border-8 border-green-500 bg-green-50 font-black text-4xl shadow-2xl text-green-700">
                 {currentQ?.alternatives[currentQ.correctAnswerIndex]}
               </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl font-black text-center text-slate-900">Ranking Parcial</h2>
              <Card className="max-w-3xl mx-auto overflow-hidden shadow-2xl border-none rounded-[3rem] bg-white">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="p-6 font-black uppercase tracking-widest text-xs">Posição</th>
                        <th className="p-6 font-black uppercase tracking-widest text-xs">Jogador</th>
                        <th className="p-6 font-black uppercase tracking-widest text-xs text-right">Pontos</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {players
                        .sort((a: any, b: any) => b.score - a.score)
                        .slice(0, 5)
                        .map((p: any, idx) => (
                          <tr key={idx} className={idx === 0 ? 'bg-primary/5' : ''}>
                            <td className="p-6 font-mono font-bold text-slate-400">#{idx + 1}</td>
                            <td className="p-6 font-black text-xl text-slate-800">{p.nickname}</td>
                            <td className="p-6 text-right font-black text-2xl text-primary">{Math.round(p.score || 0)}</td>
                          </tr>
                        ))
                      }
                  </tbody>
                </table>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button size="lg" onClick={handleNextQuestion} className="px-16 h-16 text-xl font-black rounded-2xl shadow-xl">
                {room.currentQuestionIndex + 1 < (quiz?.questions.length || 0) ? 'Próxima Questão' : 'Ver Pódio Final'}
              </Button>
            </div>
          </div>
        )}

        {room.status === 'podium' && (
           <div className="text-center space-y-16 py-10 animate-in zoom-in-95 duration-700">
              <div className="relative">
                <Trophy className="w-48 h-48 text-yellow-500 mx-auto animate-bounce-slow" />
                <div className="absolute inset-0 bg-yellow-500/20 blur-[100px] rounded-full -z-10"></div>
              </div>
              <div className="space-y-10">
                <h2 className="text-7xl font-black italic tracking-tighter uppercase text-slate-900">PÓDIO FINAL</h2>
                <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto">
                   {players
                    .sort((a: any, b: any) => b.score - a.score)
                    .slice(0, 3)
                    .map((p: any, idx) => (
                      <div key={idx} className={`w-full p-8 rounded-[3rem] border-4 flex items-center justify-between transition-transform hover:scale-105 ${idx === 0 ? 'bg-yellow-50 border-yellow-200 shadow-2xl scale-110 mb-6' : 'bg-white border-slate-100 shadow-xl'}`}>
                        <div className="flex items-center gap-6">
                           <span className={`text-4xl font-black ${idx === 0 ? 'text-yellow-600' : 'text-slate-300'}`}>{idx + 1}º</span>
                           <span className="text-3xl font-black text-slate-800">{p.nickname}</span>
                        </div>
                        <span className={`text-3xl font-black ${idx === 0 ? 'text-primary' : 'text-slate-900'}`}>{Math.round(p.score || 0)} pts</span>
                      </div>
                    ))
                   }
                </div>
              </div>
              <Button variant="outline" size="lg" onClick={handleFinishGame} className="h-16 px-12 rounded-2xl font-black border-2 border-slate-200">
                <ArrowLeft className="w-5 h-5 mr-3" /> ENCERRAR ARENA
              </Button>
           </div>
        )}
      </main>
    </div>
  );
}
