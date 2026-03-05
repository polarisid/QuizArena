
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Clock, Loader2, CheckCircle, XCircle, Timer, Send, Coins } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useMemoFirebase } from '@/firebase/provider';

export default function PlayerLiveGame() {
  const { pin } = useParams();
  const searchParams = useSearchParams();
  const nickname = searchParams.get('nickname');
  const db = useFirestore();
  const router = useRouter();

  const safeNickname = nickname ? nickname.replace(/[.#$/[\]]/g, '_') : '';

  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<{ correct: boolean, points: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentPotential, setCurrentPotential] = useState<number>(0);

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

  // Reiniciar estado quando mudar a questão
  useEffect(() => {
    setHasAnswered(false);
    setAnswerFeedback(null);
  }, [room?.currentQuestionIndex]);

  // Cronômetro sincronizado e cálculo de pontos em tempo real
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (room?.status === 'question' && room?.questionStartTime && quiz) {
      const currentQ = quiz.questions[room.currentQuestionIndex];
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = (now - room.questionStartTime!) / 1000;
        const remaining = Math.max(0, currentQ.timeLimitSeconds - elapsed);
        
        setTimeLeft(Math.ceil(remaining));

        const basePoints = currentQ.basePoints || 1000;
        
        if (quiz.decreasePointsOverTime === false) {
          setCurrentPotential(basePoints);
        } else {
          // Cálculo dinâmico da pontuação atual (Premia velocidade, mín 50% dos basePoints)
          const ratio = remaining / currentQ.timeLimitSeconds;
          const potential = Math.round(basePoints * (0.5 + 0.5 * ratio));
          setCurrentPotential(potential);
        }
        
        if (remaining <= 0 && !hasAnswered) {
          handleAnswer(-1);
        }
      };

      updateTimer();
      interval = setInterval(updateTimer, 100);
    }
    return () => clearInterval(interval);
  }, [room?.status, room?.questionStartTime, room?.currentQuestionIndex, quiz, hasAnswered]);

  const handleJoin = () => {
    if (!roomRef || !safeNickname) return;
    const playerKey = `players.${safeNickname}`;
    const payload = {
      [playerKey]: {
        nickname: nickname,
        score: 0,
        joinedAt: Date.now()
      }
    };
    updateDoc(roomRef, payload).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: roomRef.path,
        operation: 'update',
        requestResourceData: payload
      }));
    });
  };

  useEffect(() => {
    if (room && safeNickname && !room.players?.[safeNickname]) {
      handleJoin();
    }
  }, [room?.id, safeNickname]);

  const handleAnswer = (index: number) => {
    if (hasAnswered || !room || !quiz || !safeNickname) return;
    setHasAnswered(true);

    const currentQ = quiz.questions[room.currentQuestionIndex];
    const isCorrect = Number(index) === Number(currentQ.correctAnswerIndex);
    
    let points = 0;
    if (isCorrect) {
      points = currentPotential;
      const scoreKey = `players.${safeNickname}.score`;
      const currentScore = room.players[safeNickname]?.score || 0;
      const payload = { [scoreKey]: Math.round(currentScore + points) };
      
      updateDoc(roomRef!, payload).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: roomRef!.path,
          operation: 'update',
          requestResourceData: payload
        }));
      });
    }

    setAnswerFeedback({ correct: isCorrect, points });
  };

  if (isRoomLoading || isQuizLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <Loader2 className="animate-spin text-white w-10 h-10" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
        <Card className="p-8 max-w-md w-full shadow-2xl border-none rounded-[2rem]">
           <CardTitle className="text-2xl mb-4">Arena Encerrada</CardTitle>
           <Button onClick={() => router.push('/')} className="w-full">Voltar para Início</Button>
        </Card>
      </div>
    );
  }

  const currentQ = quiz?.questions[room.currentQuestionIndex];
  const timeProgress = currentQ ? (timeLeft / currentQ.timeLimitSeconds) * 100 : 0;
  const isFeedbackHidden = quiz?.showImmediateFeedback === false;

  return (
    <div className="min-h-screen bg-primary flex flex-col p-6 text-white overflow-hidden">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8 gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-black opacity-60">Combatente</span>
          <span className="font-black text-xl truncate max-w-[120px]">{nickname}</span>
        </div>

        {room.status === 'question' && (
          <div className={`flex flex-col items-center px-6 py-2 rounded-2xl shadow-2xl border-b-4 transition-all ${quiz.decreasePointsOverTime !== false ? 'bg-yellow-500 border-yellow-700 text-primary' : 'bg-white border-slate-200 text-primary'}`}>
            <span className="text-[10px] uppercase font-black opacity-80">{quiz.decreasePointsOverTime !== false ? 'Vale agora' : 'Valor Questão'}</span>
            <div className="flex items-center gap-1">
              <Coins className={`w-5 h-5 ${quiz.decreasePointsOverTime !== false ? 'text-primary' : 'text-yellow-500'}`} />
              <span className="text-2xl font-black">{currentPotential}</span>
            </div>
          </div>
        )}
        
        <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-2xl flex flex-col items-center border border-white/20">
          <span className="text-[10px] uppercase font-black opacity-60">Total</span>
          <span className="text-2xl font-black">{Math.round(room.players?.[safeNickname]?.score || 0)}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        {room.status === 'waiting' && (
          <div className="text-center space-y-10 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 blur-[100px] rounded-full"></div>
              <h1 className="text-6xl font-black relative">ARENA <br/> <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">PRONTA!</span></h1>
            </div>
            <p className="text-2xl font-bold opacity-80">Aguardando o host iniciar o combate...</p>
            <div className="flex justify-center gap-1">
               <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
               <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
               <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        )}

        {room.status === 'question' && (
          <div className="w-full space-y-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex flex-col items-center gap-4 mb-4">
                <div className="bg-black/20 px-8 py-3 rounded-full border border-white/10 flex items-center gap-4">
                  <Timer className={`w-8 h-8 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : ''}`} />
                  <span className={`text-5xl font-black ${timeLeft <= 5 ? 'text-red-400' : ''}`}>{timeLeft}s</span>
                </div>
                <Progress value={timeProgress} className="h-3 w-full max-w-md bg-white/10" />
            </div>

            {hasAnswered ? (
              <div className="text-center space-y-8 animate-in zoom-in-95 duration-300">
                {isFeedbackHidden ? (
                  <>
                    <div className="bg-white/20 p-8 rounded-[3rem] w-48 h-48 flex items-center justify-center mx-auto shadow-2xl">
                       <Send className="w-24 h-24 text-white animate-pulse" />
                    </div>
                    <h2 className="text-5xl font-black uppercase">Enviado!</h2>
                    <p className="text-2xl font-bold opacity-60">Aguardando revelação...</p>
                  </>
                ) : (
                  answerFeedback?.correct ? (
                    <>
                      <div className="bg-green-400 p-8 rounded-[3rem] w-48 h-48 flex items-center justify-center mx-auto shadow-2xl rotate-3">
                         <CheckCircle className="w-32 h-32 text-primary" />
                      </div>
                      <h2 className="text-6xl font-black">CORRETO!</h2>
                      <p className="text-3xl font-black">+{answerFeedback.points} pts</p>
                    </>
                  ) : (
                    <>
                      <div className="bg-destructive p-8 rounded-[3rem] w-48 h-48 flex items-center justify-center mx-auto shadow-2xl -rotate-3">
                         <XCircle className="w-32 h-32 text-white" />
                      </div>
                      <h2 className="text-6xl font-black">ERROU!</h2>
                      <p className="text-2xl font-bold opacity-60">Mais atenção na próxima!</p>
                    </>
                  )
                )}
              </div>
            ) : (
              <>
                <h2 className="text-4xl font-black text-center mb-10 leading-tight drop-shadow-lg">{currentQ?.question}</h2>
                <div className="grid grid-cols-1 gap-4">
                  {currentQ?.alternatives.map((alt, idx) => (
                    <Button 
                      key={idx} 
                      className="h-24 text-2xl font-black bg-white text-primary hover:bg-white/90 shadow-[0_10px_0_0_rgba(255,255,255,0.2)] rounded-[2rem] transition-transform active:scale-95 whitespace-normal p-4"
                      onClick={() => handleAnswer(idx)}
                    >
                      {alt}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {room.status === 'results' && (
          <div className="text-center space-y-10 animate-in fade-in duration-500">
             {isFeedbackHidden && answerFeedback ? (
               <div className="space-y-6 animate-in zoom-in-95 duration-500">
                  {answerFeedback.correct ? (
                    <>
                      <div className="bg-green-400 p-8 rounded-[3rem] w-40 h-40 flex items-center justify-center mx-auto shadow-2xl">
                         <CheckCircle className="w-24 h-24 text-primary" />
                      </div>
                      <h2 className="text-5xl font-black">VOCÊ ACERTOU!</h2>
                      <p className="text-3xl font-black">+{answerFeedback.points} pts ganhos</p>
                    </>
                  ) : (
                    <>
                      <div className="bg-destructive p-8 rounded-[3rem] w-40 h-40 flex items-center justify-center mx-auto shadow-2xl">
                         <XCircle className="w-24 h-24 text-white" />
                      </div>
                      <h2 className="text-5xl font-black">VOCÊ ERROU</h2>
                      <p className="text-2xl font-bold opacity-60">Fique atento na próxima!</p>
                    </>
                  )}
               </div>
             ) : (
               <>
                 <h2 className="text-6xl font-black italic tracking-tighter uppercase">RODADA ENCERRADA</h2>
                 <p className="text-2xl font-bold opacity-80">Olhe para o Host para ver o ranking!</p>
               </>
             )}
             
             <div className="bg-white/10 backdrop-blur-xl p-12 rounded-[4rem] border border-white/20 shadow-2xl mt-8">
                <p className="text-xs uppercase font-black mb-4 opacity-60 tracking-widest">Sua Pontuação Total</p>
                <p className="text-8xl font-black">{Math.round(room.players?.[safeNickname]?.score || 0)}</p>
             </div>
          </div>
        )}

        {room.status === 'podium' && (
          <div className="text-center space-y-8 animate-in zoom-in duration-700">
             <Trophy className="w-32 h-32 mx-auto text-yellow-400 animate-bounce-slow" />
             <h2 className="text-6xl font-black tracking-tighter uppercase">ARENA FINALIZADA!</h2>
             <div className="bg-white text-primary p-12 rounded-[4rem] shadow-2xl transform hover:scale-105 transition-transform">
                <p className="text-sm font-black mb-2 uppercase opacity-40">Sua Conquista</p>
                <p className="text-8xl font-black">{Math.round(room.players?.[safeNickname]?.score || 0)} pts</p>
             </div>
             <Button variant="outline" className="text-white border-white/40 hover:bg-white/20 mt-10 rounded-2xl h-14 px-10 font-black" onClick={() => router.push('/')}>
               VOLTAR À BASE
             </Button>
          </div>
        )}
      </main>
    </div>
  );
}
