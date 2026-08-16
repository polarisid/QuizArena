'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useLiveSession } from '@/lib/supabase/use-live-session';
import type { Question, QuizSettings } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Loader2, CheckCircle, XCircle, Timer, Send, Coins, WifiOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function PlayerLiveGame() {
  const { pin } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const nickname = (searchParams.get('nickname') || '').trim();

  const { session, players, isMissing, isReconnecting } = useLiveSession(pin as string);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({});
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<{ correct: boolean; points: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentPotential, setCurrentPotential] = useState<number>(0);

  const myScore = Math.round(players.find((p) => p.nickname === nickname)?.score || 0);

  // Entra na sala — e RE-TENTA enquanto não aparecer na lista de jogadores
  // (auto-recuperação: cobre join que falhou ou evento de realtime perdido).
  useEffect(() => {
    if (!session || !nickname) return;
    const amIn = players.some((p) => p.nickname === nickname);
    if (amIn) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .rpc('join_game', { p_pin: pin as string, p_nickname: nickname })
      .then(({ error }) => {
        if (error) console.error('join_game falhou:', error.message);
      });
  }, [session?.id, nickname, pin, players]);

  // Carrega questões + settings do quiz
  useEffect(() => {
    async function loadQuiz() {
      if (!session?.quiz_id) return;
      const supabase = getSupabaseBrowserClient();
      const [{ data: quiz }, { data: qs }] = await Promise.all([
        supabase.from('quizzes').select('settings').eq('id', session.quiz_id).maybeSingle(),
        supabase.from('questions').select('*').eq('quiz_id', session.quiz_id).order('position', { ascending: true }),
      ]);
      if (quiz) setQuizSettings(quiz.settings || {});
      if (qs) setQuestions(qs as Question[]);
    }
    loadQuiz();
  }, [session?.quiz_id]);

  const currentQ = session ? questions[session.current_question_index] : undefined;

  // Reinicia o estado ao mudar de questão
  useEffect(() => {
    setHasAnswered(false);
    setAnswerFeedback(null);
  }, [session?.current_question_index]);

  const handleAnswer = async (index: number) => {
    if (hasAnswered || !session || !currentQ || !nickname) return;
    setHasAnswered(true);
    const supabase = getSupabaseBrowserClient();
    // Pontuação decidida no servidor (anti-cheat + idempotente)
    const { data, error } = await supabase.rpc('submit_answer', {
      p_pin: pin as string,
      p_nickname: nickname,
      p_question_index: session.current_question_index,
      p_chosen_index: index,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) {
      setAnswerFeedback({ correct: !!row.is_correct, points: row.points || 0 });
    } else {
      setAnswerFeedback({ correct: false, points: 0 });
    }
  };

  // Cronômetro sincronizado; envia resposta vazia (-1) ao esgotar
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (session?.status === 'question' && session.question_started_at && currentQ) {
      const startedAt = new Date(session.question_started_at).getTime();
      const update = () => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const remaining = Math.max(0, currentQ.time_limit_seconds - elapsed);
        setTimeLeft(Math.ceil(remaining));
        const base = currentQ.base_points || 1000;
        if (quizSettings.decreasePointsOverTime === false) {
          setCurrentPotential(base);
        } else {
          const ratio = remaining / currentQ.time_limit_seconds;
          setCurrentPotential(Math.round(base * (0.5 + 0.5 * ratio)));
        }
        if (remaining <= 0 && !hasAnswered) handleAnswer(-1);
      };
      update();
      interval = setInterval(update, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [session?.status, session?.question_started_at, session?.current_question_index, currentQ, quizSettings, hasAnswered]);

  if (isMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center bg-slate-50">
        <Card className="p-8 max-w-md w-full shadow-2xl border-none rounded-[2rem]">
           <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
           <CardTitle className="text-2xl mb-2">Arena Encerrada</CardTitle>
           <CardDescription className="mb-6">O host finalizou esta partida.</CardDescription>
           <Button onClick={() => router.push('/')} className="w-full">Voltar para Início</Button>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-primary text-white">
        <Loader2 className="animate-spin w-10 h-10" />
        <p className="font-bold opacity-80">{isReconnecting ? 'Reconectando à arena...' : 'Entrando na arena...'}</p>
      </div>
    );
  }

  const timeProgress = currentQ ? (timeLeft / currentQ.time_limit_seconds) * 100 : 0;
  const isFeedbackHidden = quizSettings.showImmediateFeedback === false;
  const decrease = quizSettings.decreasePointsOverTime !== false;

  return (
    <div className="min-h-screen bg-primary flex flex-col p-6 text-white overflow-hidden">
      {isReconnecting && (
        <div className="fixed top-0 inset-x-0 z-50 bg-yellow-500 text-primary text-center py-1.5 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 animate-in slide-in-from-top">
          <WifiOff className="w-3.5 h-3.5" /> Reconectando... suas respostas estão salvas
        </div>
      )}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8 gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-black opacity-60">Combatente</span>
          <span className="font-black text-xl truncate max-w-[120px]">{nickname}</span>
        </div>

        {session.status === 'question' && (
          <div className={`flex flex-col items-center px-6 py-2 rounded-2xl shadow-2xl border-b-4 transition-all ${decrease ? 'bg-yellow-500 border-yellow-700 text-primary' : 'bg-white border-slate-200 text-primary'}`}>
            <span className="text-[10px] uppercase font-black opacity-80">{decrease ? 'Vale agora' : 'Valor Questão'}</span>
            <div className="flex items-center gap-1">
              <Coins className={`w-5 h-5 ${decrease ? 'text-primary' : 'text-yellow-500'}`} />
              <span className="text-2xl font-black">{currentPotential}</span>
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-2xl flex flex-col items-center border border-white/20">
          <span className="text-[10px] uppercase font-black opacity-60">Total</span>
          <span className="text-2xl font-black">{myScore}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        {session.status === 'waiting' && (
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

        {session.status === 'question' && (
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
                <h2 className="text-4xl font-black text-center mb-10 leading-tight drop-shadow-lg">{currentQ?.prompt}</h2>
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

        {session.status === 'results' && (
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
                <p className="text-8xl font-black">{myScore}</p>
             </div>
          </div>
        )}

        {session.status === 'podium' && (
          <div className="text-center space-y-8 animate-in zoom-in duration-700">
             <Trophy className="w-32 h-32 mx-auto text-yellow-400 animate-bounce-slow" />
             <h2 className="text-6xl font-black tracking-tighter uppercase">ARENA FINALIZADA!</h2>
             <div className="bg-white text-primary p-12 rounded-[4rem] shadow-2xl transform hover:scale-105 transition-transform">
                <p className="text-sm font-black mb-2 uppercase opacity-40">Sua Conquista</p>
                <p className="text-8xl font-black">{myScore} pts</p>
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
