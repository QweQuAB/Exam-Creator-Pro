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

function useTimer(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed * 1000;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [running]);
  return elapsed;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AttemptTake() {
  const { attemptId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [currentEssayIndex, setCurrentEssayIndex] = useState(0);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [essayDraft, setEssayDraft] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<"mcq" | "essay">("mcq");

  const { data: attempt, isLoading } = useGetAttempt(attemptId!, {
    query: { enabled: !!attemptId, queryKey: getGetAttemptQueryKey(attemptId!) },
  });

  const submitAnswer = useSubmitAnswer();
  const finishAttempt = useFinishAttempt();

  const isFinished = attempt?.status === "finished";
  const timerRunning = !!attempt && !isFinished;
  const elapsed = useTimer(timerRunning);

  // Separate MCQ and Essay questions
  const mcqQuestions = attempt?.questions.filter((q) => q.questionType === "mcq") ?? [];
  const essayQuestions = attempt?.questions.filter((q) => q.questionType === "essay") ?? [];

  useEffect(() => {
    if (attempt && attempt.status === "in_progress") {
      const mcqs = attempt.questions.filter((q) => q.questionType === "mcq");
      const firstUnansweredMcq = mcqs.findIndex((q) => !q.isAnswered);
      if (firstUnansweredMcq !== -1) setCurrentMcqIndex(firstUnansweredMcq);
      if (essayQuestions.length > 0) setCurrentEssayIndex(0);
    }
  }, [attempt?.id]);

  if (isLoading || !attempt) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isFinished) {
    return <ResultsScreen attempt={attempt} onReview={() => setActiveSection("mcq")} />;
  }

  const handleOptionClick = (question: any, index: number) => {
    if (question.isAnswered || submittingId === question.id) return;
    setSubmittingId(question.id);
    submitAnswer.mutate(
      { attemptId: attemptId!, data: { attemptQuestionId: question.id, selectedIndex: index } },
      {
        onSuccess: (result) => {
          setSubmittingId(null);
          queryClient.setQueryData(getGetAttemptQueryKey(attemptId!), (old: any) => {
            if (!old) return old;
            const newQuestions = old.questions.map((q: any) =>
              q.id === question.id
                ? { ...q, isAnswered: true, selectedIndex: index, correctIndex: result.correctIndex, isCorrect: result.isCorrect }
                : q,
            );
            return { ...old, questions: newQuestions, score: result.score };
          });
        },
        onError: () => setSubmittingId(null),
      },
    );
  };

  const handleEssaySubmit = (question: any) => {
    const text = essayDraft[question.id]?.trim() ?? "";
    if (!text) return;
    setSubmittingId(question.id);
    submitAnswer.mutate(
      { attemptId: attemptId!, data: { attemptQuestionId: question.id, essayAnswer: text } },
      {
        onSuccess: () => {
          setSubmittingId(null);
          queryClient.setQueryData(getGetAttemptQueryKey(attemptId!), (old: any) => {
            if (!old) return old;
            const newQuestions = old.questions.map((q: any) =>
              q.id === question.id ? { ...q, isAnswered: true, essayAnswer: text } : q,
            );
            return { ...old, questions: newQuestions };
          });
          setEssayDraft((d) => ({ ...d, [question.id]: "" }));
        },
        onError: () => setSubmittingId(null),
      },
    );
  };

  const handleFinish = () => {
    finishAttempt.mutate(
      { attemptId: attemptId! },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAttemptQueryKey(attemptId!) });
        },
      },
    );
  };

  const allAnswered = attempt.questions.every((q) => q.isAnswered);
  const answeredCount = attempt.questions.filter((q) => q.isAnswered).length;
  const progressPct = (answeredCount / attempt.total) * 100;

  const optionLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];

  const hasMcq = mcqQuestions.length > 0;
  const hasEssay = essayQuestions.length > 0;

  const currentMcq = mcqQuestions[currentMcqIndex];
  const currentEssay = essayQuestions[currentEssayIndex];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center py-6 px-4 md:px-8 font-sans">
      <div className="w-full max-w-3xl space-y-6">
        {/* Progress Header */}
        <div className="bg-card rounded-2xl p-4 md:p-5 shadow-lg border border-border/60 flex items-center justify-between gap-4 flex-wrap">
          <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary font-semibold px-3 py-1.5 rounded-full">
            {answeredCount}/{attempt.total} answered
          </Badge>
          <div className="flex-1 min-w-[150px]">
            <Progress value={progressPct} className="h-2.5 bg-secondary" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
              <Clock className="w-4 h-4" />
              {formatElapsed(elapsed)}
            </div>
            <Badge className="bg-accent text-accent-foreground hover:bg-accent font-bold px-3 py-1.5 rounded-full">
              {attempt.score} pts
            </Badge>
          </div>
        </div>

        {/* Section Tabs */}
        <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as "mcq" | "essay")}>
          <TabsList className={`grid w-full ${hasEssay && hasMcq ? "grid-cols-2" : "grid-cols-1"}`}>
            {hasMcq && (
              <TabsTrigger value="mcq" className="gap-2">
                <FileText className="w-4 h-4" />
                Section A — MCQ
                <Badge variant="secondary" className="ml-1 text-xs">
                  {mcqQuestions.filter((q) => q.isAnswered).length}/{mcqQuestions.length}
                </Badge>
              </TabsTrigger>
            )}
            {hasEssay && (
              <TabsTrigger value="essay" className="gap-2">
                <PenLine className="w-4 h-4" />
                Section B — Essay
                <Badge variant="secondary" className="ml-1 text-xs">
                  {essayQuestions.filter((q) => q.isAnswered).length}/{essayQuestions.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          {/* MCQ Section */}
          {hasMcq && (
            <TabsContent value="mcq" className="pt-2">
              {currentMcq && (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentMcq.id}
                      initial={{ x: 40, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -40, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                      <div className="bg-card rounded-3xl p-6 md:p-10 shadow-2xl border border-border/80">
                        {currentMcq.topic && (
                          <div className="mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">
                              {currentMcq.topic}
                            </span>
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mb-2">
                          Q{currentMcqIndex + 1} of {mcqQuestions.length}
                        </div>
                        <div className="text-xl md:text-2xl font-serif font-semibold text-primary leading-relaxed mb-8">
                          <MathRenderer text={currentMcq.prompt} />
                          {currentMcq.repeatNote && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex ml-3 align-middle cursor-help text-accent hover:scale-110 transition-transform">
                                  <Star className="w-6 h-6 fill-current" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-primary text-primary-foreground p-4 max-w-sm text-sm border-none shadow-xl">
                                <div dangerouslySetInnerHTML={{ __html: currentMcq.repeatNote }} />
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        <div className="space-y-3">
                          {currentMcq.options.map((opt, i) => {
                            const isSelected = currentMcq.selectedIndex === i;
                            const isCorrectAnswer = currentMcq.correctIndex === i;
                            const isWrongSelected = isSelected && !currentMcq.isCorrect;
                            const showCorrect = currentMcq.isAnswered && isCorrectAnswer;

                            let optionStateClasses =
                              "border-border hover:border-primary/50 hover:bg-secondary/50 bg-card";
                            let letterClasses =
                              "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary";

                            if (currentMcq.isAnswered) {
                              if (showCorrect) {
                                optionStateClasses = "border-success bg-success/10";
                                letterClasses = "bg-success text-success-foreground";
                              } else if (isWrongSelected) {
                                optionStateClasses = "border-destructive bg-destructive/10";
                                letterClasses = "bg-destructive text-destructive-foreground";
                              } else {
                                optionStateClasses = "border-border/40 opacity-60";
                                letterClasses = "bg-secondary/50 text-muted-foreground/50";
                              }
                            }

                            return (
                              <button
                                key={i}
                                onClick={() => handleOptionClick(currentMcq, i)}
                                disabled={currentMcq.isAnswered || submittingId !== null}
                                className={`w-full group text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${optionStateClasses}`}
                              >
                                <span
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${letterClasses}`}
                                >
                                  {optionLetters[i]}
                                </span>
                                <span className="font-medium text-foreground text-base">
                                  <MathRenderer text={opt} />
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <AnimatePresence>
                          {currentMcq.isAnswered && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, marginTop: 0 }}
                              animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                              className="overflow-hidden"
                            >
                              <div
                                className={`p-6 rounded-2xl border ${currentMcq.isCorrect ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}
                              >
                                <div
                                  className={`flex items-center gap-2 font-bold text-lg mb-3 ${currentMcq.isCorrect ? "text-success" : "text-destructive"}`}
                                >
                                  {currentMcq.isCorrect ? (
                                    <CheckCircle className="w-5 h-5" />
                                  ) : (
                                    <XCircle className="w-5 h-5" />
                                  )}
                                  {currentMcq.isCorrect ? "Correct!" : "Incorrect"}
                                </div>
                                {currentMcq.explanation && (
                                  <p className="text-foreground leading-relaxed mb-4">
                                    {currentMcq.explanation}
                                  </p>
                                )}
                                {currentMcq.reference && (
                                  <div className="bg-primary/5 border-l-4 border-primary/40 p-3 rounded-r-lg text-sm font-medium text-primary">
                                    {currentMcq.reference}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* MCQ Navigation */}
                  <div className="flex items-center justify-between px-2 mt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentMcqIndex((i) => Math.max(0, i - 1))}
                      disabled={currentMcqIndex === 0}
                      className="text-muted-foreground hover:text-foreground gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" /> Previous
                    </Button>
                    {currentMcqIndex < mcqQuestions.length - 1 ? (
                      <Button
                        size="lg"
                        onClick={() => setCurrentMcqIndex((i) => i + 1)}
                        disabled={!currentMcq.isAnswered}
                        className="gap-2 font-bold px-8 shadow-md"
                      >
                        Next <ArrowRight className="w-4 h-4" />
                      </Button>
                    ) : hasEssay ? (
                      <Button
                        size="lg"
                        onClick={() => setActiveSection("essay")}
                        className="gap-2 font-bold px-8 shadow-md bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <PenLine className="w-4 h-4" /> Go to Essays
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        onClick={handleFinish}
                        disabled={!allAnswered || finishAttempt.isPending}
                        className="gap-2 font-bold px-8 shadow-md"
                      >
                        {finishAttempt.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Award className="w-4 h-4" />
                        )}
                        Finish Exam
                      </Button>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          )}

          {/* Essay Section */}
          {hasEssay && (
            <TabsContent value="essay" className="pt-2 space-y-6">
              {currentEssay && (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentEssay.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                      <div className="bg-card rounded-3xl p-6 md:p-10 shadow-2xl border border-border/80">
                        {currentEssay.topic && (
                          <div className="mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">
                              {currentEssay.topic}
                            </span>
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mb-2">
                          Essay {currentEssayIndex + 1} of {essayQuestions.length}
                        </div>
                        <div className="text-xl md:text-2xl font-serif font-semibold text-primary leading-relaxed mb-6">
                          <MathRenderer text={currentEssay.prompt} />
                          {currentEssay.repeatNote && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex ml-3 align-middle cursor-help text-accent hover:scale-110 transition-transform">
                                  <Star className="w-6 h-6 fill-current" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-primary text-primary-foreground p-4 max-w-sm text-sm border-none shadow-xl">
                                <div dangerouslySetInnerHTML={{ __html: currentEssay.repeatNote }} />
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {currentEssay.isAnswered ? (
                          <div className="bg-success/5 border border-success/20 rounded-xl p-5">
                            <div className="flex items-center gap-2 text-success font-semibold mb-3">
                              <CheckCircle className="w-5 h-5" /> Answer submitted
                            </div>
                            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                              {currentEssay.essayAnswer}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Write your answer here…"
                              className="min-h-[180px] resize-y text-base leading-relaxed"
                              value={essayDraft[currentEssay.id] ?? ""}
                              onChange={(e) =>
                                setEssayDraft((d) => ({ ...d, [currentEssay.id]: e.target.value }))
                              }
                            />
                            <Button
                              onClick={() => handleEssaySubmit(currentEssay)}
                              disabled={
                                !essayDraft[currentEssay.id]?.trim() ||
                                submittingId !== null
                              }
                              className="w-full gap-2 font-bold"
                            >
                              {submittingId === currentEssay.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              Submit Answer
                            </Button>
                          </div>
                        )}

                        {currentEssay.reference && (
                          <div className="mt-4 bg-primary/5 border-l-4 border-primary/40 p-3 rounded-r-lg text-sm font-medium text-primary">
                            {currentEssay.reference}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Essay Navigation */}
                  <div className="flex items-center justify-between px-2">
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentEssayIndex((i) => Math.max(0, i - 1))}
                      disabled={currentEssayIndex === 0}
                      className="text-muted-foreground hover:text-foreground gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" /> Previous
                    </Button>
                    {currentEssayIndex < essayQuestions.length - 1 ? (
                      <Button
                        size="lg"
                        onClick={() => setCurrentEssayIndex((i) => i + 1)}
                        className="gap-2 font-bold px-8 shadow-md"
                      >
                        Next Essay <ArrowRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        onClick={handleFinish}
                        disabled={!allAnswered || finishAttempt.isPending}
                        className="gap-2 font-bold px-8 shadow-md"
                      >
                        {finishAttempt.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Award className="w-4 h-4" />
                        )}
                        Finish Exam
                      </Button>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function ResultsScreen({ attempt, onReview }: { attempt: any; onReview: () => void }) {
  const [, setLocation] = useLocation();
  const mcqQuestions = attempt.questions.filter((q: any) => q.questionType === "mcq");
  const essayQuestions = attempt.questions.filter((q: any) => q.questionType === "essay");

  const elapsed = attempt.elapsedSeconds;
  const elapsedStr = elapsed
    ? elapsed < 60
      ? `${Math.round(elapsed)}s`
      : `${Math.floor(elapsed / 60)}m ${Math.round(elapsed % 60)}s`
    : null;

  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <Card className="border-border/60 shadow-2xl overflow-hidden bg-card">
          <div className="h-3 w-full bg-accent" />
          <CardContent className="p-8 md:p-12 text-center">
            <Award className="w-20 h-20 mx-auto text-accent mb-6" />
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-2">
              Quiz Completed
            </h1>
            <p className="text-lg text-muted-foreground mb-8">{attempt.examTitle}</p>

            <div className="inline-flex flex-col items-center justify-center p-8 bg-secondary/50 rounded-full w-48 h-48 border-4 border-background shadow-inner mb-6">
              <span className="text-5xl font-black text-primary">
                {Math.round(attempt.scorePct)}
                <span className="text-3xl">%</span>
              </span>
              <span className="text-sm font-medium text-muted-foreground mt-2">
                {attempt.score} / {attempt.total} correct
              </span>
            </div>

            {elapsedStr && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Completed in {elapsedStr}</span>
              </div>
            )}

            {attempt.userName && (
              <p className="text-sm text-muted-foreground mb-6">
                Submitted by <span className="font-semibold text-foreground">{attempt.userName}</span>
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 gap-2 px-8"
                onClick={() => setLocation(`/exams/${attempt.examId}/take`)}
              >
                <RotateCcw className="w-4 h-4" /> Try Again
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8" onClick={onReview}>
                <BookOpen className="w-4 h-4" /> Review Answers
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="gap-2 px-8"
                onClick={() => setLocation("/")}
              >
                <Home className="w-4 h-4" /> Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MCQ Review */}
        {mcqQuestions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif font-bold px-2">Section A — MCQ Review</h2>
            {mcqQuestions.map((q: any, i: number) => (
              <Card key={q.id} className="shadow-sm border-border/60">
                <CardContent className="p-6 flex flex-col md:flex-row gap-6">
                  <div className="flex-none pt-1">
                    {q.isCorrect ? (
                      <CheckCircle className="w-8 h-8 text-success" />
                    ) : (
                      <XCircle className="w-8 h-8 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="font-medium text-lg leading-snug text-foreground">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      <MathRenderer text={q.prompt} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-card text-muted-foreground">
                          Your Answer
                        </Badge>
                        <span className={`font-medium ${q.isCorrect ? "text-success" : "text-destructive"}`}>
                          {q.selectedIndex != null ? (
                            <MathRenderer text={q.options[q.selectedIndex]} />
                          ) : (
                            "Skipped"
                          )}
                        </span>
                      </div>
                      {!q.isCorrect && q.correctIndex != null && (
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            Correct Answer
                          </Badge>
                          <span className="font-medium text-success">
                            <MathRenderer text={q.options[q.correctIndex]} />
                          </span>
                        </div>
                      )}
                    </div>
                    {(q.explanation || q.reference) && (
                      <div className="bg-secondary/40 p-4 rounded-lg text-sm space-y-2">
                        {q.explanation && (
                          <div>
                            <span className="font-semibold">Explanation:</span>{" "}
                            <span className="text-muted-foreground">{q.explanation}</span>
                          </div>
                        )}
                        {q.reference && (
                          <div>
                            <span className="font-semibold">Reference:</span>{" "}
                            <span className="text-muted-foreground">{q.reference}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Essay Review */}
        {essayQuestions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif font-bold px-2">Section B — Essay Review</h2>
            {essayQuestions.map((q: any, i: number) => (
              <Card key={q.id} className="shadow-sm border-border/60">
                <CardContent className="p-6 space-y-4">
                  <div className="font-medium text-lg leading-snug text-foreground">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    <MathRenderer text={q.prompt} />
                  </div>
                  <div className="bg-secondary/30 p-4 rounded-lg">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Your Response
                    </p>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {q.essayAnswer || <span className="text-muted-foreground italic">No answer submitted</span>}
                    </p>
                  </div>
                  {q.reference && (
                    <div className="bg-primary/5 border-l-4 border-primary/40 p-3 rounded-r-lg text-sm text-primary">
                      {q.reference}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
