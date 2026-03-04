"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Sparkles, Trash2, ArrowLeft, Save, Loader2, Clock, Info, Coins } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { Question } from "@/lib/models";
import { useToast } from "@/hooks/use-toast";
import { generateQuizQuestionsFromTopic } from "@/ai/flows/generate-quiz-questions-from-topic";
import { useUser, useFirestore } from "@/firebase";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function NewQuiz() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showImmediateFeedback, setShowImmediateFeedback] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      toast({ title: "Acesso negado", description: "Você precisa estar logado para criar uma prova.", variant: "destructive" });
      router.push("/login");
    }
  }, [user, isUserLoading, router, toast]);

  if (isUserLoading || !user) {
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

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSave = async () => {
    if (!title || questions.length === 0) {
      toast({ title: "Título e ao menos uma questão são necessários", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, "quizzes"), {
        title,
        description,
        questions,
        showImmediateFeedback,
        createdAt: new Date().toISOString(),
        createdByUserId: user.uid,
        isPublishedAsChallenge: false
      });
      toast({ title: "Quiz salvo com sucesso!" });
      router.push("/host");
    } catch (error) {
      toast({ title: "Erro ao salvar quiz", variant: "destructive" });
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
          <h1 className="text-xl font-headline font-bold">Novo Quiz</h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="font-bold">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Quiz
        </Button>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-10 space-y-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-headline">Detalhes Básicos</h2>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Título do Quiz</Label>
                <Input 
                  id="title"
                  placeholder="Ex: Conhecimentos Gerais 101" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea 
                  id="desc"
                  placeholder="Sobre o que é este quiz?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-dashed">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">Feedback Imediato</Label>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" /> Jogadores veem se acertaram logo após responder?
                  </p>
                </div>
                <Switch 
                  checked={showImmediateFeedback}
                  onCheckedChange={setShowImmediateFeedback}
                />
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
                   className="w-40 h-10" 
                   value={topic}
                   onChange={(e) => setTopic(e.target.value)}
                 />
                 <Button variant="secondary" onClick={handleGenerateAI} disabled={isGenerating}>
                   {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                   IA
                 </Button>
               </div>
               <Button variant="outline" onClick={addQuestion}>
                 <Plus className="w-4 h-4 mr-2" /> Adicionar
               </Button>
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => (
              <Card key={q.id} className="relative overflow-hidden border-2 border-primary/10">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">Questão {idx + 1}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)}>
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
                    className="font-medium"
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.alternatives.map((alt, aIdx) => (
                      <div key={aIdx} className="flex gap-2 items-center">
                        <div 
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white transition-all cursor-pointer ${
                            q.correctAnswerIndex === aIdx ? 'bg-green-500 scale-110 shadow-lg' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
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
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-6 pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-bold">Tempo:</Label>
                      <select 
                        className="bg-muted px-3 py-1.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary font-bold"
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

                    <div className="flex items-center gap-3">
                      <Coins className="w-4 h-4 text-yellow-500" />
                      <Label className="text-sm font-bold">Pontos Base:</Label>
                      <Input 
                        type="number"
                        className="w-24 h-9 font-bold"
                        value={q.basePoints}
                        onChange={(e) => {
                          const newQs = [...questions];
                          newQs[idx].basePoints = parseInt(e.target.value) || 0;
                          setQuestions(newQs);
                        }}
                      />
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
