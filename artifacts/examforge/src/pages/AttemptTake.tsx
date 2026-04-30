import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { 
  useGetAttempt, 
  useSubmitAnswer, 
  useFinishAttempt, 
  getGetAttemptQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, CheckCircle, XCircle, ArrowRight, ArrowLeft, 
  Award, Loader2, Star, Home, RotateCcw 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function AttemptTake() {
  const { attemptId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const { data: attempt, isLoading } = useGetAttempt(attemptId!, {
    query: { enabled: !!attemptId, queryKey: getGetAttemptQueryKey(attemptId!) }
  });

  const submitAnswer = useSubmitAnswer();
  const finishAttempt = useFinishAttempt();

  useEffect(() => {
    // If we load an in-progress attempt, jump to the first unanswered question
    if (attempt && attempt.status === "in_progress") {
      const firstUnanswered = attempt.questions.findIndex(q => !q.isAnswered);
      if (firstUnanswered !== -1 && firstUnanswered !== currentIndex) {
        setCurrentIndex(firstUnanswered);
      } else if (firstUnanswered === -1) {
        // all answered, go to last
        setCurrentIndex(attempt.questions.length - 1);
      }
    }
  }, [attempt?.id]); // Only run on initial load of the attempt

  if (isLoading || !attempt) {
    return <div className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const isFinished = attempt.status === "finished";
  const question = attempt.questions[currentIndex];
  const progressPct = ((currentIndex + 1) / attempt.total) * 100;

  const handleOptionClick = (index: number) => {
    if (isFinished || question.isAnswered || submittingId === question.id) return;

    setSubmittingId(question.id);
    submitAnswer.mutate({
      attemptId: attemptId!,
      data: {
        attemptQuestionId: question.id,
        selectedIndex: index
      }
    }, {
      onSuccess: (result) => {
        setSubmittingId(null);
        // Optimistically update cache to show answer
        queryClient.setQueryData(getGetAttemptQueryKey(attemptId!), (old: any) => {
          if (!old) return old;
          const newQuestions = old.questions.map((q: any) => {
            if (q.id === question.id) {
              return {
                ...q,
                isAnswered: true,
                selectedIndex: index,
                correctIndex: result.correctIndex,
                isCorrect: result.isCorrect
              };
            }
            return q;
          });
          return { ...old, questions: newQuestions, score: result.score, total: result.total };
        });
      },
      onError: () => setSubmittingId(null)
    });
  };

  const handleNext = () => {
    if (currentIndex < attempt.total - 1) {
      setCurrentIndex(curr => curr + 1);
    } else {
      // Finish
      if (!isFinished) {
        finishAttempt.mutate({ attemptId: attemptId! }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetAttemptQueryKey(attemptId!) });
            localStorage.removeItem(`examforge_resume_${attempt.examId}`);
          }
        });
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(curr => curr - 1);
    }
  };

  if (isFinished && currentIndex === attempt.total - 1) {
    // Results screen (can be toggled by being at the end or we can just show it)
    // Actually, let's render a dedicated results view if finished and we want to review
    return <ResultsScreen attempt={attempt} onReview={() => setCurrentIndex(0)} />;
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center py-6 px-4 md:px-8 font-sans">
      <div className="w-full max-w-3xl space-y-6">
        {/* Progress Header */}
        <div className="bg-card rounded-2xl p-4 md:p-6 shadow-lg border border-border/60 flex items-center justify-between gap-4 md:gap-6 flex-wrap">
          <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary text-sm font-semibold px-4 py-1.5 rounded-full border-border/40">
            Q {currentIndex + 1} of {attempt.total}
          </Badge>
          <div className="flex-1 min-w-[200px]">
            <Progress value={progressPct} className="h-2.5 bg-secondary" />
          </div>
          <Badge className="bg-accent text-accent-foreground hover:bg-accent text-sm font-bold px-4 py-1.5 rounded-full">
            Score: {attempt.score}
          </Badge>
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
          >
            <div className="bg-card rounded-3xl p-6 md:p-10 shadow-2xl border border-border/80">
              {question.topic && (
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">
                    {question.topic}
                  </span>
                </div>
              )}
              
              <div className="text-xl md:text-2xl font-serif font-semibold text-primary leading-relaxed mb-8">
                {question.prompt}
                {question.repeatNote && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex ml-3 align-middle cursor-help text-accent hover:scale-110 transition-transform">
                        <Star className="w-6 h-6 fill-current" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-primary text-primary-foreground p-4 max-w-sm text-sm border-none shadow-xl">
                      <div dangerouslySetInnerHTML={{ __html: question.repeatNote }} />
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const isSelected = question.selectedIndex === i;
                  const isCorrectAnswer = question.correctIndex === i;
                  const isWrongSelected = isSelected && !question.isCorrect;
                  const showCorrect = question.isAnswered && isCorrectAnswer;
                  
                  let optionStateClasses = "border-border hover:border-primary/50 hover:bg-secondary/50 bg-card";
                  let letterClasses = "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary";
                  
                  if (question.isAnswered) {
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
                  } else if (isSelected || submittingId === question.id) {
                    // Just in case we want a loading state while submitting
                    if (isSelected) {
                       optionStateClasses = "border-primary bg-primary/5";
                       letterClasses = "bg-primary text-primary-foreground";
                    } else {
                       optionStateClasses = "border-border/40 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleOptionClick(i)}
                      disabled={question.isAnswered || submittingId !== null}
                      className={`w-full group text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${optionStateClasses}`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${letterClasses}`}>
                        {optionLetters[i]}
                      </span>
                      <span className="font-medium text-foreground text-base">{opt}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {question.isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-6 rounded-2xl border ${question.isCorrect ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <div className={`flex items-center gap-2 font-bold text-lg mb-3 ${question.isCorrect ? 'text-success' : 'text-destructive'}`}>
                        {question.isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        {question.isCorrect ? "Correct!" : "Incorrect"}
                      </div>
                      
                      {question.explanation && (
                        <p className="text-foreground leading-relaxed mb-4">{question.explanation}</p>
                      )}
                      
                      {question.reference && (
                        <div className="bg-primary/5 border-l-4 border-primary/40 p-3 rounded-r-lg text-sm font-medium text-primary">
                          {question.reference}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between px-2">
          <Button 
            variant="ghost" 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </Button>

          <Button 
            size="lg"
            onClick={handleNext}
            disabled={!question.isAnswered && !isFinished}
            className={`gap-2 font-bold px-8 shadow-md ${!question.isAnswered && !isFinished ? 'opacity-50' : 'bg-primary hover:bg-primary/90'}`}
          >
            {currentIndex === attempt.total - 1 ? (
               isFinished ? "View Results" : "Finish Attempt"
            ) : (
               <>Next <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultsScreen({ attempt, onReview }: { attempt: any, onReview: () => void }) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <Card className="border-border/60 shadow-2xl overflow-hidden bg-card">
          <div className="h-3 w-full bg-accent"></div>
          <CardContent className="p-8 md:p-12 text-center">
            <Award className="w-20 h-20 mx-auto text-accent mb-6" />
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-2">Quiz Completed</h1>
            <p className="text-lg text-muted-foreground mb-8">{attempt.examTitle}</p>

            <div className="inline-flex flex-col items-center justify-center p-8 bg-secondary/50 rounded-full w-48 h-48 border-4 border-background shadow-inner mb-8">
              <span className="text-5xl font-black text-primary">{Math.round(attempt.scorePct)}<span className="text-3xl">%</span></span>
              <span className="text-sm font-medium text-muted-foreground mt-2">{attempt.score} / {attempt.total} Correct</span>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 gap-2 px-8" onClick={() => setLocation(`/exams/${attempt.examId}/take`)}>
                <RotateCcw className="w-4 h-4" /> Try Again
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8" onClick={onReview}>
                <BookOpen className="w-4 h-4" /> Review Answers
              </Button>
              <Button size="lg" variant="ghost" className="gap-2 px-8" onClick={() => setLocation(`/`)}>
                <Home className="w-4 h-4" /> Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-serif font-bold px-2">Review Summary</h2>
          {attempt.questions.map((q: any, i: number) => (
            <Card key={q.id} className="shadow-sm border-border/60">
              <CardContent className="p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-none pt-1">
                  {q.isCorrect ? 
                    <CheckCircle className="w-8 h-8 text-success" /> : 
                    <XCircle className="w-8 h-8 text-destructive" />
                  }
                </div>
                <div className="flex-1 space-y-4">
                  <div className="font-medium text-lg leading-snug text-foreground">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    {q.prompt}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-card text-muted-foreground border-border/60">Your Answer</Badge>
                      <span className={`font-medium ${q.isCorrect ? 'text-success' : 'text-destructive'}`}>
                        {q.selectedIndex != null ? q.options[q.selectedIndex] : 'Skipped'}
                      </span>
                    </div>
                    {!q.isCorrect && q.correctIndex != null && (
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">Correct Answer</Badge>
                        <span className="font-medium text-success">{q.options[q.correctIndex]}</span>
                      </div>
                    )}
                  </div>

                  {(q.explanation || q.reference) && (
                    <div className="bg-secondary/40 p-4 rounded-lg text-sm space-y-2 mt-2">
                      {q.explanation && <div><span className="font-semibold">Explanation:</span> <span className="text-muted-foreground">{q.explanation}</span></div>}
                      {q.reference && <div><span className="font-semibold">Reference:</span> <span className="text-muted-foreground">{q.reference}</span></div>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
