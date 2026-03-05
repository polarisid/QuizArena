
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Play, FileText, Loader2 } from "lucide-react";
import { useUser } from "@/firebase";
import Link from "next/link";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const [livePin, setLivePin] = useState("");
  const [liveNickname, setLiveNickname] = useState("");
  const [challengeId, setChallengeId] = useState("");

  // Preenche o PIN automaticamente se vier do QR Code
  useEffect(() => {
    const pinFromUrl = searchParams.get("pin");
    if (pinFromUrl) {
      setLivePin(pinFromUrl);
    }
  }, [searchParams]);

  const handleJoinLive = (e: React.FormEvent) => {
    e.preventDefault();
    if (livePin.length === 6 && liveNickname.trim()) {
      router.push(`/play/${livePin}?nickname=${encodeURIComponent(liveNickname)}`);
    }
  };

  const handleJoinChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (challengeId.trim()) {
      router.push(`/challenge/${challengeId.trim()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-xl shadow-lg">
            <Trophy className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-headline font-bold tracking-tight text-primary">QuizArena</span>
        </Link>
        <div className="flex gap-4 items-center">
          {isUserLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : user ? (
            <Button variant="ghost" asChild className="hidden sm:flex">
              <Link href="/host">Painel do Host</Link>
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <Link href="/login">Login Host</Link>
            </Button>
          )}
          <Button variant="default" className="rounded-full px-6 font-bold" asChild>
            <Link href={user ? "/host/quiz/new" : "/login"}>Criar Prova</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-7xl font-headline leading-tight font-black text-slate-900">
                Aprenda <br /> <span className="text-primary italic">Jogando.</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-md">
                Entre em uma arena ao vivo ou realize uma prova individual através do código de acesso.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {/* Card Jogo Ao Vivo */}
              <Card className="border-2 border-primary/20 shadow-xl overflow-hidden bg-white">
                <div className="bg-primary px-6 py-4 flex items-center justify-between">
                  <h3 className="font-headline text-lg text-white font-bold flex items-center gap-2">
                    <Play className="w-5 h-5 fill-current" /> Jogo Ao Vivo (PIN)
                  </h3>
                </div>
                <CardContent className="p-6">
                  <form onSubmit={handleJoinLive} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input 
                        placeholder="PIN: 000 000" 
                        value={livePin}
                        onChange={(e) => setLivePin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="text-center text-2xl font-black tracking-widest h-14 border-2"
                      />
                      <Input 
                        placeholder="Seu Apelido" 
                        value={liveNickname}
                        onChange={(e) => setLiveNickname(e.target.value)}
                        className="h-14 text-lg border-2"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-14 text-lg font-black"
                      disabled={livePin.length !== 6 || !liveNickname.trim()}
                    >
                      ENTRAR NA ARENA
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Card Prova Assíncrona */}
              <Card className="border-2 border-slate-200 shadow-xl overflow-hidden bg-white">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                  <h3 className="font-headline text-lg text-white font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Acessar Prova (ID)
                  </h3>
                </div>
                <CardContent className="p-6">
                  <form onSubmit={handleJoinChallenge} className="flex flex-col sm:flex-row gap-4">
                    <Input 
                      placeholder="Cole o ID da Prova aqui..." 
                      value={challengeId}
                      onChange={(e) => setChallengeId(e.target.value)}
                      className="flex-1 h-14 text-lg border-2"
                    />
                    <Button 
                      type="submit" 
                      variant="secondary"
                      className="h-14 px-8 text-lg font-black"
                      disabled={!challengeId.trim()}
                    >
                      IR PARA PROVA
                    </Button>
                  </form>
                  <p className="mt-4 text-xs text-muted-foreground">
                    * Solicite o ID da prova ou o link direto ao seu professor ou instrutor.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="relative hidden lg:block">
             <div className="absolute -inset-10 bg-primary/10 blur-[100px] rounded-full"></div>
             <img 
               src="https://picsum.photos/seed/quiz-arena/1000/800" 
               alt="Hero" 
               className="relative rounded-[2rem] shadow-2xl border-8 border-white transform rotate-2 hover:rotate-0 transition-transform duration-500"
               data-ai-hint="educational gaming"
             />
          </div>
        </div>
      </main>

      <footer className="border-t bg-white py-12 mt-auto">
         <div className="container mx-auto px-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
              <Trophy className="w-5 h-5" />
              <span className="font-bold">QuizArena v2.0</span>
            </div>
            <div className="text-slate-400 text-sm space-y-1">
              <p>© 2025 QuizArena. Desenvolvido por Daniel Carvalho.</p>
              <p>Privado e Seguro.</p>
            </div>
         </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
