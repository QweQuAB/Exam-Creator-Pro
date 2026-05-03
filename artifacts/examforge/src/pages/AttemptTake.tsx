import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetAttempt,
  useSubmitAnswer,
  useFinishAttempt,
  getGetAttemptQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, CheckCircle, XCircle, ArrowRight, ArrowLeft,
  Award, Loader2, Star, Home, RotateCcw, Clock, PenLine, FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MathRenderer } from "@/components/MathRenderer";

function useTimer(running: boolean): number { const [elapsed, setElapsed] = useState(0); const startRef = useRef(Date.now()); useEffect(() => { if (!running) return; startRef.current = Date.now() - elapsed * 1000; const id = setInterval(() => { setElapsed(Math.floor((Date.now() - startRef.current) / 1000)); }, 500); return () => clearInterval(id); }, [running]); return elapsed; }
function formatElapsed(sec: number): string { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${s.toString().padStart(2, "0")}`; }

export default function AttemptTake() {
  const { attemptId } = useParams(); const [, setLocation] = useLocation(); const queryClient = useQueryClient();
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0); const [currentEssayIndex, setCurrentEssayIndex] = useState(0); const [submittingId, setSubmittingId] = useState<string | null>(null); const [essayDraft, setEssayDraft] = useState<Record<string, string>>({}); const [activeSection, setActiveSection] = useState<"mcq" | "essay">("mcq");
  const { data: attempt, isLoading } = useGetAttempt(attemptId!, { query: { enabled: !!attemptId, queryKey: getGetAttemptQueryKey(attemptId!) } });
  const submitAnswer = useSubmitAnswer(); const finishAttempt = useFinishAttempt(); const isFinished = attempt?.status === "finished"; const timerRunning = !!attempt && !isFinished; const elapsed = useTimer(timerRunning);
  const mcqQuestions = attempt?.questions.filter((q) => q.questionType === "mcq") ?? []; const essayQuestions = attempt?.questions.filter((q) => q.questionType === "essay") ?? [];
  useEffect(() => { if (attempt && attempt.status === "in_progress") { const mcqs = attempt.questions.filter((q) => q.questionType === "mcq"); const firstUnansweredMcq = mcqs.findIndex((q) => !q.isAnswered); if (firstUnansweredMcq !== -1) setCurrentMcqIndex(firstUnansweredMcq); if (essayQuestions.length > 0) setCurrentEssayIndex(0); } }, [attempt?.id]);
  if (isLoading || !attempt) return <div className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (isFinished) return <ResultsScreen attempt={attempt} onReview={() => setActiveSection("mcq")} />;
  const handleOptionClick = (question: any, index: number) => { if (question.isAnswered || submittingId === question.id) return; setSubmittingId(question.id); submitAnswer.mutate({ attemptId: attemptId!, data: { attemptQuestionId: question.id, selectedIndex: index } }, { onSuccess: (result) => { setSubmittingId(null); queryClient.setQueryData(getGetAttemptQueryKey(attemptId!), (old: any) => { if (!old) return old; const newQuestions = old.questions.map((q: any) => q.id === question.id ? { ...q, isAnswered: true, selectedIndex: index, correctIndex: result.correctIndex, isCorrect: result.isCorrect } : q); return { ...old, questions: newQuestions, score: result.score }; }); }, onError: () => setSubmittingId(null) }); };
  const handleEssaySubmit = (question: any) => { const text = essayDraft[question.id]?.trim() ?? ""; if (!text) return; setSubmittingId(question.id); submitAnswer.mutate({ attemptId: attemptId!, data: { attemptQuestionId: question.id, essayAnswer: text } }, { onSuccess: () => { setSubmittingId(null); queryClient.setQueryData(getGetAttemptQueryKey(attemptId!), (old: any) => { if (!old) return old; const newQuestions = old.questions.map((q: any) => q.id === question.id ? { ...q, isAnswered: true, essayAnswer: text } : q); return { ...old, questions: newQuestions }; }); setEssayDraft((d) => ({ ...d, [question.id]: "" })); }, onError: () => setSubmittingId(null) }); };
  const handleFinish = () => { finishAttempt.mutate({ attemptId: attemptId! }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetAttemptQueryKey(attemptId!) }); } }); };
  const allAnswered = attempt.questions.every((q) => q.isAnswered); const answeredCount = attempt.questions.filter((q) => q.isAnswered).length; const progressPct = (answeredCount / attempt.total) * 100; const optionLetters = ["A", "B", "C", "D", "E", "F", "G", "H"]; const hasMcq = mcqQuestions.length > 0; const hasEssay = essayQuestions.length > 0; const currentMcq = mcqQuestions[currentMcqIndex]; const currentEssay = essayQuestions[currentEssayIndex];
  return <div className="min-h-[100dvh] bg-background flex flex-col items-center py-6 px-4 md:px-8 font-sans"><div className="w-full max-w-3xl space-y-6"><div className="bg-card rounded-2xl p-4 md:p-5 shadow-lg border border-border/60 flex items-center justify-between gap-4 flex-wrap"><Badge className="bg-secondary text-secondary-foreground hover:bg-secondary font-semibold px-3 py-1.5 rounded-full">{answeredCount}/{attempt.total} answered</Badge><div className="flex-1 min-w-[150px]"><Progress value={progressPct} className="h-2.5 bg-secondary" /></div><div className="flex items-center gap-3"><div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground"><Clock className="w-4 h-4" />{formatElapsed(elapsed)}</div><Badge className="bg-accent text-accent-foreground hover:bg-accent font-bold px-3 py-1.5 rounded-full">{attempt.score} pts</Badge></div></div><Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as "mcq" | "essay")}><TabsList className={`grid w-full ${hasEssay && hasMcq ? "grid-cols-2" : "grid-cols-1"}`}>{hasMcq && <TabsTrigger value="mcq" className="gap-2"><FileText className="w-4 h-4" /> Section A — MCQ <Badge variant="secondary" className="ml-1 text-xs">{mcqQuestions.filter((q) => q.isAnswered).length}/{mcqQuestions.length}</Badge></TabsTrigger>}{hasEssay && <TabsTrigger value="essay" className="gap-2"><PenLine className="w-4 h-4" /> Section B — Essay <Badge variant="secondary" className="ml-1 text-xs">{essayQuestions.filter((q) => q.isAnswered).length}/{essayQuestions.length}</Badge></TabsTrigger>}</TabsList>{hasMcq && <TabsContent value="mcq" className="pt-2">{currentMcq && <>...<MathRenderer text={currentMcq.prompt} />...<MathRenderer text={opt} />...</>}</TabsContent>}{hasEssay && <TabsContent value="essay" className="pt-2 space-y-6">{currentEssay && <>...<MathRenderer text={currentEssay.prompt} />...</>}</TabsContent>}</Tabs></div></div>;
}

function ResultsScreen({ attempt, onReview }: { attempt: any; onReview: () => void }) { const [, setLocation] = useLocation(); const mcqQuestions = attempt.questions.filter((q: any) => q.questionType === "mcq"); const essayQuestions = attempt.questions.filter((q: any) => q.questionType === "essay"); const elapsed = attempt.elapsedSeconds; const elapsedStr = elapsed ? elapsed < 60 ? `${Math.round(elapsed)}s` : `${Math.floor(elapsed / 60)}m ${Math.round(elapsed % 60)}s` : null; return <div className="min-h-[100dvh] bg-background py-10 px-4 font-sans">...<div className="font-medium text-lg leading-snug text-foreground"><span className="text-muted-foreground mr-2">{i + 1}.</span><MathRenderer text={q.prompt} /></div>...</div>; }
