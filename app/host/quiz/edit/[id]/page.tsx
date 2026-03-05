
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Sparkles, Trash2, ArrowLeft, Save, Loader2, Clock, Info, Coins, Zap } from "lucide-react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Question } from "@/lib/models";
import { useToast } from "@/hooks/use-toast";
import { generateQuizQuestionsFromTopic } from "@/ai/flows/generate-quiz-questions-from-topic";
import { useUser, useFirestore } from "@/firebase";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function EditQuiz() {
  const router = useRouter();
  const { id } = useParams();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showImmediateFeedback, setShowImmediateFeedback] = useState(true);
  const [decreasePointsOverTime, setDecreasePointsOverTime] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      toast({ title: "Acesso negado", description: "Você precisa estar logado para editar uma prova.", variant: "destructive" });
      router.push("/login");
    }
  }, [user, isUserLoading, router, toast]);

  useEffect(() => {
    async function fetchQuiz() {
      if (!db || !id || !user) return;
      try {
        const docRef = doc(db, "quizzes", id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.createdByUserId !== user.uid) {
            toast({ title: "Acesso negado", description: "Você não tem permissão para editar este quiz.", variant: "destructive" });
            router.push("/host");
            return;
          }
          setTitle(data.title || "");
          setDescription(data.description || "");
          setShowImmediateFeedback(data.showImmediateFeedback ?? true);
          setDecreasePointsOverTime(data.decreasePointsOverTime ?? true);
          setQuestions(data.questions || []);
        } else {
          toast({ title: "Erro", description: "Quiz não encontrado.", variant: "destructive" });
          router.push("/host");
        }
      } catch (error) {
        toast({ title: "Erro ao carregar quiz", variant: "destructive" });
      } finally {
        setIsInitialLoading(false);
      }
    }

    if (user) {
      fetchQuiz();
    }
  }, [db, id, user, router, toast]);

  if (isUserLoading || isInitialLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const addQuestion = () => {
    const newQ: Question = {
      id: crypto.randomUUID(),
      question: "",
      alternatives: ["", "", "", ""],
      correctAnswerIndex: 0,
      timeLimitSeconds: 30,
      basePoints: 1000
    };
    setQuestions([...questions, newQ]);
  };

  const handleGenerateAI = async () => {
    if (!topic.trim()) {
      toast({ title: "Por favor, insira um tópico para a IA", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const aiResult = await generateQuizQuestionsFromTopic({ topic });
      const newQ: Question = {
        id: crypto.randomUUID(),
        question: aiResult.question,
        alternatives: aiResult.alternatives,
        correctAnswerIndex: aiResult.correctAnswerIndex,
        timeLimitSeconds: aiResult.timeLimitSeconds,
        basePoints: aiResult.basePoints || 1000
      };
      setQuestions([...questions, newQ]);
      toast({ title: "Questão gerada pela IA!" });
    } catch (error) {
      toast({ title: "Erro ao gerar questão pela IA", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const removeQuestion = (qId: string) => {
    setQuestions(questions.filter(q => q.id !== qId));
  };

  const handleSave = async () => {
    if (!title || questions.length === 0) {
      toast({ title: "Título e ao menos uma questão são necessários", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, "quizzes", id as string);
      await updateDoc(docRef, {
        title,
        description,
        questions,
        showImmediateFeedback,
        decreasePointsOverTime,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Quiz atualizado com sucesso!" });
      router.push("/host");
    } catch (error) {
      toast({ title: "Erro ao atualizar quiz", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/host"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 className="text-xl font-headline font-bold">Editar Quiz</h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="font-bold">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Alterações
        </Button>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-10 space-y-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-headline">Detalhes Básicos</h2>
          <Card className="rounded-[2rem] overflow-hidden border-2">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-lg font-bold">Título do Quiz</Label>
                <Input 
                  id="title"
                  placeholder="Ex: Conhecimentos Gerais 101" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-bold h-14 rounded-xl border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc" className="font-bold">Descrição</Label>
                <Textarea 
                  id="desc"
                  placeholder="Sobre o que é este quiz?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl border-2"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border-2 border-dashed">
                  <div className="space-y-1">
                    <Label className="text-base font-bold">Feedback Imediato</Label>
                    <p className="text-xs text-muted-foreground">
                      Jogadores veem se acertaram logo após responder?
                    </p>
                  </div>
                  <Switch 
                    checked={showImmediateFeedback}
                    onCheckedChange={setShowImmediateFeedback}
                  />
                </div>

                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border-2 border-dashed">
                  <div className="space-y-1">
                    <Label className="text-base font-bold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500 fill-current" />
                      Pontos Decrescentes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      A pontuação diminui com o passar do tempo?
                    </p>
                  </div>
                  <Switch 
                    checked={decreasePointsOverTime}
                    onCheckedChange={setDecreasePointsOverTime}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h2 className="text-2xl font-headline">Questões</h2>
            <div className="flex flex-wrap gap-2">
               <div className="flex gap-1">
                 <Input 
                   placeholder="Tópico para IA..." 
                   className="w-40 h-10 rounded-xl" 
                   value={topic}
                   onChange={(e) => setTopic(e.target.value)}
                 />
                 <Button variant="secondary" onClick={handleGenerateAI} disabled={isGenerating} className="rounded-xl font-bold">
                   {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                   IA
                 </Button>
               </div>
               <Button variant="outline" onClick={addQuestion} className="rounded-xl font-bold">
                 <Plus className="w-4 h-4 mr-2" /> Adicionar Manual
               </Button>
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => (
              <Card key={q.id} className="relative overflow-hidden border-2 border-primary/10 rounded-3xl shadow-sm">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-black">QUESTÃO {idx + 1}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)} className="rounded-full hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Input 
                    placeholder="Sua pergunta..." 
                    value={q.question}
                    onChange={(e) => {
                      const newQs = [...questions];
                      newQs[idx].question = e.target.value;
                      setQuestions(newQs);
                    }}
                    className="font-bold text-lg border-2 h-14 rounded-xl"
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.alternatives.map((alt, aIdx) => (
                      <div key={aIdx} className="flex gap-3 items-center">
                        <div 
                          className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white transition-all cursor-pointer shadow-sm ${
                            q.correctAnswerIndex === aIdx ? 'bg-green-500 scale-110' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                          onClick={() => {
                            const newQs = [...questions];
                            newQs[idx].correctAnswerIndex = aIdx;
                            setQuestions(newQs);
                          }}
                        >
                          {String.fromCharCode(65 + aIdx)}
                        </div>
                        <Input 
                          placeholder={`Alternativa ${aIdx + 1}`}
                          value={alt}
                          onChange={(e) => {
                            const newQs = [...questions];
                            newQs[idx].alternatives[aIdx] = e.target.value;
                            setQuestions(newQs);
                          }}
                          className="rounded-xl border-2"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-8 pt-6 border-t mt-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-lg">
                        <Clock className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex flex-col">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Tempo Limite</Label>
                        <select 
                          className="bg-transparent font-black text-lg outline-none"
                          value={q.timeLimitSeconds}
                          onChange={(e) => {
                             const newQs = [...questions];
                             newQs[idx].timeLimitSeconds = parseInt(e.target.value);
                             setQuestions(newQs);
                          }}
                        >
                          {[10, 20, 30, 60, 90, 120].map(s => <option key={s} value={s}>{s}s</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="bg-yellow-100 p-2 rounded-lg">
                        <Coins className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className="flex flex-col">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Pontos Base</Label>
                        <Input 
                          type="number"
                          className="w-24 h-8 font-black text-lg border-none p-0 bg-transparent"
                          value={q.basePoints}
                          onChange={(e) => {
                            const newQs = [...questions];
                            newQs[idx].basePoints = parseInt(e.target.value) || 0;
                            setQuestions(newQs);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
