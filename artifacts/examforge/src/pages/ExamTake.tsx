import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useGetExam, useStartAttempt, getGetExamQueryKey } from "@workspace/api-client-react";
import { BookOpen, AlertCircle, Loader2, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function ExamTake() {
  const { examId } = useParams();
  const [, setLocation] = useLocation();
  const [resumeAttemptId, setResumeAttemptId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [userName, setUserName] = useState("");

  const { data: exam, isLoading } = useGetExam(examId!, { 
    query: { enabled: !!examId, queryKey: getGetExamQueryKey(examId!) } 
  });
  
  const startAttempt = useStartAttempt();

  useEffect(() => {
    if (examId) {
      const saved = localStorage.getItem(`examforge_resume_${examId}`);
      if (saved) {
        setResumeAttemptId(saved);
      }
      const savedName = localStorage.getItem("examforge_user_name");
      if (savedName) setUserName(savedName);
    }
  }, [examId]);

  const handleStart = () => {
    setShowNameDialog(true);
  };

  const confirmStart = () => {
    startAttempt.mutate({
      examId: examId!,
      data: { shuffleQuestions: true, shuffleOptions: true, userName: userName.trim() || null }
    }, {
      onSuccess: (attempt) => {
        localStorage.setItem(`examforge_resume_${examId}`, attempt.id);
        localStorage.setItem("examforge_user_name", userName.trim());
        setShowNameDialog(false);
        setLocation(`/attempts/${attempt.id}`);
      }
    });
  };

  const handleResume = () => {
    if (resumeAttemptId) {
      setLocation(`/attempts/${resumeAttemptId}`);
    }
  };

  if (isLoading) {
    return <div className="max-w-2xl mx-auto py-20 space-y-4"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!exam) {
    return <div className="text-center py-20 text-muted-foreground">Exam not found</div>;
  }

  if (exam.questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20">
        <Card className="border-border/60 shadow-sm text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-medium mb-2">No Questions Available</h2>
          <p className="text-muted-foreground mb-6">This exam doesn't have any questions yet.</p>
          <Link href={`/exams/${exam.id}`}>
            <Button>Back to Exam</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto w-full animate-in fade-in zoom-in-95 duration-500 pt-10">
        <Card className="border-primary shadow-xl bg-gradient-to-b from-card to-card/50 overflow-hidden">
          <div className="h-2 w-full bg-primary"></div>
          <CardContent className="pt-12 pb-12 px-8 text-center">
            {exam.courseCode && (
               <div className="inline-block bg-primary text-primary-foreground font-bold text-xs tracking-wider px-3 py-1 rounded-full mb-4">
                 {exam.courseCode}
               </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary mb-4 leading-tight">
              {exam.title}
            </h1>
            <p className="text-muted-foreground bg-accent/10 border-l-4 border-accent p-3 rounded-r-lg inline-block text-left text-sm max-w-md mx-auto mb-10">
              <span className="text-accent font-bold">Note:</span> Key topics that repeat in final exams are marked with a star. Pay attention to the explanations.
            </p>

            <div className="flex flex-wrap justify-center gap-6 mb-12">
              <div className="bg-secondary rounded-2xl p-4 min-w-[100px]">
                <div className="text-3xl font-bold text-primary">{exam.questions.length}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">QUESTIONS</div>
              </div>
              <div className="bg-secondary rounded-2xl p-4 min-w-[100px]">
                <div className="text-3xl font-bold text-primary"><RefreshCw className="w-8 h-8 mx-auto" /></div>
                <div className="text-xs text-muted-foreground font-medium mt-1">SHUFFLED</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 h-auto"
                onClick={handleStart}
                disabled={startAttempt.isPending}
              >
                {startAttempt.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <BookOpen className="w-5 h-5 mr-2"/>}
                Start New Quiz
              </Button>
              
              {resumeAttemptId && (
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="font-semibold text-lg px-8 py-6 h-auto"
                  onClick={handleResume}
                >
                  Resume Saved
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter your name</DialogTitle>
            <DialogDescription>
              This name will appear on the leaderboard when you finish the exam.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Display name</label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Ada Lovelace"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>Cancel</Button>
            <Button onClick={confirmStart} disabled={startAttempt.isPending} className="gap-2">
              <User className="w-4 h-4" /> Start Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
