
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Clock, Medal, ArrowLeft, Loader2, Target, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemoFirebase } from "@/firebase/provider";

export default function ChallengeLeaderboard() {
  const { id } = useParams();
  const db = useFirestore();

  // Buscar dados do Quiz
  const quizRef = useMemoFirebase(() => id ? doc(db, "quizzes", id as string) : null, [db, id]);
  const { data: quiz, isLoading: isQuizLoading } = useDoc(quizRef);

  // Buscar resultados (Top 50)
  const resultsQuery = useMemoFirebase(() => {
    if (!db || !id) return null;
    // Removendo orderBy temporariamente para evitar problemas de índice enquanto as regras propagam
    return query(
      collection(db, "challengeResults"),
      where("challengeId", "==", id),
      limit(50)
    );
  }, [db, id]);

  const { data: results, isLoading: isResultsLoading, error } = useCollection(resultsQuery);

  // Ordenação manual no cliente para garantir que funcione sem índices compostos imediatos
  const sortedResults = React.useMemo(() => {
    if (!results) return [];
    return [...results].sort((a, b) => b.score - a.score);
  }, [results]);

  if (isQuizLoading || isResultsLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <p className="text-slate-500 font-medium">Carregando Ranking da Arena...</p>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full text-center p-8 border-destructive shadow-2xl">
          <CardHeader>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Erro de Permissão</CardTitle>
            <CardDescription className="text-lg">
              As regras de segurança do ranking estão sendo atualizadas. Por favor, tente novamente em alguns segundos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Voltar ao Início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const top3 = sortedResults.slice(0, 3);
  const others = sortedResults.slice(3);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      <header className="bg-white border-b px-6 py-8 shadow-sm">
        <div className="max-w-5xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-6">
          <Button variant="ghost" asChild className="rounded-full">
            <Link href={`/challenge/${id}`}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Prova</Link>
          </Button>
          <div className="text-center flex-1">
            <h1 className="text-4xl font-headline font-black text-slate-900 tracking-tight">Arena Leaderboard</h1>
            <p className="text-primary font-bold text-lg">{quiz?.title || 'Arena Privada'}</p>
          </div>
          <div className="w-32 hidden md:block"></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-6 pt-12 space-y-12">
        {top3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end pt-10">
            {/* Second Place */}
            {top3[1] && (
              <Card className="border-2 border-slate-200 shadow-xl order-2 md:order-1 h-fit bg-white">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="relative mx-auto w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                    <Medal className="w-12 h-12 text-slate-400" />
                    <span className="absolute -top-2 -right-2 bg-slate-400 text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center border-4 border-white">2</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold truncate">{top3[1].nickname}</h3>
                    <div className="text-3xl font-black text-slate-500">{top3[1].score}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* First Place */}
            {top3[0] && (
              <Card className="border-4 border-primary shadow-2xl order-1 md:order-2 scale-110 z-10 bg-white relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-2 bg-primary" />
                <CardContent className="p-10 text-center space-y-6">
                  <div className="relative mx-auto w-28 h-28 bg-primary/10 rounded-full flex items-center justify-center">
                    <Trophy className="w-16 h-16 text-primary" />
                    <span className="absolute -top-3 -right-3 bg-primary text-white text-lg font-black w-10 h-10 rounded-full flex items-center justify-center border-4 border-white">1</span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black truncate text-slate-900">{top3[0].nickname}</h3>
                    <div className="text-5xl font-black text-primary">{top3[0].score}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Third Place */}
            {top3[2] && (
              <Card className="border-2 border-amber-100 shadow-xl order-3 h-fit bg-white">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="relative mx-auto w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center">
                    <Medal className="w-12 h-12 text-amber-600" />
                    <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center border-4 border-white">3</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold truncate">{top3[2].nickname}</h3>
                    <div className="text-3xl font-black text-amber-700">{top3[2].score}</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card className="shadow-2xl overflow-hidden rounded-[2rem] border-none bg-white">
          <CardHeader className="bg-slate-900 text-white p-8">
            <CardTitle className="text-2xl font-black">Ranking Completo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-black uppercase border-b">
                    <th className="px-8 py-5">Posição</th>
                    <th className="px-8 py-5">Nickname</th>
                    <th className="px-8 py-5">Pontos</th>
                    <th className="px-8 py-5">Acertos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedResults.length > 0 ? (
                    sortedResults.map((res, idx) => (
                      <tr key={res.id} className="hover:bg-slate-50">
                        <td className="px-8 py-6 text-slate-400 font-mono">#{idx + 1}</td>
                        <td className="px-8 py-6 font-bold text-slate-800">{res.nickname}</td>
                        <td className="px-8 py-6 font-black text-slate-900">{res.score}</td>
                        <td className="px-8 py-6">
                           <span className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-100">
                              {res.correctAnswers} acertos
                           </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-32 text-center text-slate-400">
                        Nenhum resultado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
