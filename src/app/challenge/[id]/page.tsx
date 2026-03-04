"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { Quiz, Question } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Clock, CheckCircle, XCircle, Loader2, Timer, Coins } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";

export default function ChallengePlay() {
  const { id } = useParams();
  const db = useFirestore();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'results'>('intro');
  const [nickname, setNickname] = useState("");
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentPotential, setCurrentPotential] = useState(0);
  const [totalTimeTaken, setTotalTimeTaken] = useState(0);
  const [isAnswering, setIsAnswering] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ correct: boolean, points: number } | null>(null);

  useEffect(() => {
    async function fetchQuiz() {
      if (!db || !id) return;
      const docRef = doc(db, "quizzes", id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setQuiz({ id: snap.id, ...snap.data() } as any);
      }
    }
    fetchQuiz();
  }, [id, db]);

  // Cronômetro e cálculo de pontos em tempo real
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && !isAnswering && timeLeft > 0) {
      timer = setInterval(() => {
        const nextTime = timeLeft - 0.1;
        setTimeLeft(nextTime);
        setTotalTimeTaken(prev => prev + 0.1);

        // Cálculo dinâmico da pontuação atual
        if (quiz) {
          const currentQ = quiz.questions[currentQIndex];
          const basePoints = currentQ.basePoints || 1000;
          const ratio = Math.max(0, nextTime / currentQ.timeLimitSeconds);
          const potential = Math.round(basePoints * (0.5 + 0.5 * ratio));
          setCurrentPotential(potential);
        }

        if (nextTime <= 0) {
          handleAnswer(-1);
        }
      }, 100);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, isAnswering, quiz, currentQIndex]);

  const startChallenge = () => {
    if (!nickname.trim()) return;
    setGameState('playing');
    setCurrentQIndex(0);
    const initialTime = quiz!.questions[0].timeLimitSeconds;
    setTimeLeft(initialTime);
    setCurrentPotential(quiz!.questions[0].basePoints || 1000);
  };

  const handleAnswer = (index: number) => {
    if (isAnswering) return;
    setIsAnswering(true);
    
    const currentQ = quiz!.questions[currentQIndex];
    const isCorrect = Number(index) === Number(currentQ.correctAnswerIndex);
    
    let points = 0;
    if (isCorrect) {
      points = currentPotential;
      setScore(prev => prev + points);
      setCorrectCount(prev => prev + 1);
    }
    
    setLastFeedback({ correct: isCorrect, points });
    
    setTimeout(() => {
      setLastFeedback(null);
      setIsAnswering(false);
      if (currentQIndex + 1 < quiz!.questions.length) {
        const nextIdx = currentQIndex + 1;
        setCurrentQIndex(nextIdx);
        const nextTime = quiz!.questions[nextIdx].timeLimitSeconds;
        setTimeLeft(nextTime);
        setCurrentPotential(quiz!.questions[nextIdx].basePoints || 1000);
      } else {
        finishGame();
      }
    }, 2000);
  };

  const finishGame = () => {
    setGameState('results');
    const payload = {
      challengeId: id,
      nickname,
      score,
      correctAnswers: correctCount,
      totalTime: Math.round(totalTimeTaken),
      timestamp: Date.now()
    };
    addDoc(collection(db, "challengeResults"), payload).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'challengeResults',
        operation: 'create',
        requestResourceData: payload
      }));
    });
  };

  if (!quiz) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  const currentQ = quiz.questions[currentQIndex];
  const timeProgress = quiz && gameState === 'playing' ? (timeLeft / currentQ.timeLimitSeconds) * 100 : 100;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6">
      {gameState === 'playing' && (
        <header className="max-w-4xl mx-auto w-full mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase font-black text-slate-400">Total</span>
              <span className="font-black text-2xl text-primary">{score}</span>
            </div>
            
            {!isAnswering && (
              <div className="flex flex-col items-center bg-yellow-500 text-white px-8 py-2 rounded-2xl border-b-4 border-yellow-700 shadow-xl animate-pulse">
                <span className="text-[10px] uppercase font-black opacity-80">Vale agora</span>
                <div className="flex items-center gap-1">
                  <Coins className="w-5 h-5" />
                  <span className="font-black text-3xl">{currentPotential}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col items-end">
              <span className="text-xs uppercase font-black text-slate-400">Tempo</span>
              <div className="flex items-center gap-2">
                <Timer className={`w-6 h-6 ${timeLeft <= 5 ? 'text-destructive animate-pulse' : 'text-slate-600'}`} />
                <span className={`font-black text-3xl ${timeLeft <= 5 ? 'text-destructive' : 'text-slate-900'}`}>{Math.ceil(timeLeft)}s</span>
              </div>
            </div>
          </div>
          <Progress value={timeProgress} className={`h-4 transition-all duration-100 ${timeLeft <= 5 ? 'bg-destructive/20' : 'bg-slate-200'}`} />
          <div className="text-center mt-2">
            <span className="text-xs font-bold text-slate-400">QUESTÃO {currentQIndex + 1} / {quiz.questions.length}</span>
          </div>
        </header>
      )}

      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        {gameState === 'intro' && (
          <Card className="w-full max-w-md p-8 text-center space-y-6 shadow-2xl border-none rounded-[2rem] bg-white">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
              <Trophy className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-900">{quiz.title}</h1>
              <p className="text-slate-500 font-medium">{quiz.description}</p>
            </div>
            <div className="space-y-4">
               <Input 
                placeholder="Seu Nickname" 
                value={nickname} 
                onChange={e => setNickname(e.target.value)} 
                className="text-center h-14 text-lg font-bold border-2 rounded-2xl"
              />
              <Button onClick={startChallenge} className="w-full h-14 text-lg font-black rounded-2xl shadow-lg" disabled={!nickname.trim()}>
                Começar Prova
              </Button>
            </div>
          </Card>
        )}

        {gameState === 'playing' && (
          <div className="w-full space-y-12">
            {lastFeedback ? (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
                {lastFeedback.correct ? (
                  <>
                    <div className="bg-green-500 p-8 rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-2xl">
                       <CheckCircle className="w-24 h-24 text-white" />
                    </div>
                    <h2 className="text-6xl font-black text-green-600">ACERTOU!</h2>
                    <p className="text-4xl font-black">+{lastFeedback.points} pontos</p>
                  </>
                ) : (
                  <>
                    <div className="bg-destructive p-8 rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-2xl">
                       <XCircle className="w-24 h-24 text-white" />
                    </div>
                    <h2 className="text-6xl font-black text-destructive">ERROU...</h2>
                    <p className="text-2xl font-bold opacity-80 text-slate-500">Mais atenção na próxima!</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-4xl md:text-5xl text-center font-black text-slate-900 mb-12 tracking-tight">{currentQ.question}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {currentQ.alternatives.map((alt, idx) => (
                    <Button 
                      key={idx} 
                      variant="outline" 
                      className="h-32 text-xl font-bold shadow-sm border-2 rounded-3xl hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all whitespace-normal p-4" 
                      onClick={() => handleAnswer(idx)} 
                      disabled={isAnswering}
                    >
                      {alt}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {gameState === 'results' && (
          <Card className="w-full max-w-md p-12 text-center space-y-8 shadow-2xl border-none rounded-[3rem] bg-white">
            <div className="relative">
              <Trophy className="w-32 h-32 mx-auto text-yellow-500 animate-bounce-slow" />
              <div className="absolute inset-0 bg-yellow-500/10 blur-[50px] rounded-full -z-10"></div>
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-slate-900">Finalizado!</h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Seus Resultados na Prova</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-6 rounded-2xl">
                <p className="text-4xl font-black text-primary">{score}</p>
                <p className="text-xs font-bold text-slate-400 uppercase">Pontos</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl">
                <p className="text-4xl font-black text-green-600">{correctCount}</p>
                <p className="text-xs font-bold text-slate-400 uppercase">Acertos</p>
              </div>
            </div>
            <div className="pt-4 flex flex-col gap-3">
              <Button asChild className="w-full h-14 text-lg font-black rounded-2xl shadow-lg">
                <Link href={`/challenge/${id}/leaderboard`}>Ver Ranking Global</Link>
              </Button>
              <Button variant="ghost" asChild className="w-full h-14 text-lg font-bold rounded-2xl">
                <Link href="/">Voltar ao Início</Link>
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
