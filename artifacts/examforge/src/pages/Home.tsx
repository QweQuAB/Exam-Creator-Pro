import { Link } from "wouter";
import { format } from "date-fns";
import {
  BookOpen,
  History,
  TrendingUp,
  FileText,
  CheckCircle2,
  Trophy,
  ArrowRight,
  Plus,
  PenLine,
} from "lucide-react";
import { useGetDashboard, useGetRecentAttempts, useListExams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MathRenderer } from "@/components/MathRenderer";

export default function Home() {
  const { data: dashboard, isLoading: isLoadingDashboard } = useGetDashboard();
  const { data: recentAttempts, isLoading: isLoadingAttempts } = useGetRecentAttempts({ limit: 5 });
  const { data: exams, isLoading: isLoadingExams } = useListExams();

  const allQuestions = exams ?? [];
  const sectionA = allQuestions.flatMap((exam) =>
    (exam.questions ?? []).filter((q: any) => q.questionType !== "essay"),
  );
  const sectionB = allQuestions.flatMap((exam) =>
    (exam.questions ?? []).filter((q: any) => q.questionType === "essay"),
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your study progress and exam statistics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>{isLoadingDashboard ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{dashboard?.examCount || 0}</div>}</CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>{isLoadingDashboard ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{dashboard?.questionCount || 0}</div>}</CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attempts Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{dashboard?.finishedAttemptCount || 0}</div>}
            <p className="text-xs text-muted-foreground mt-1">Out of {dashboard?.attemptCount || 0} started</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{dashboard?.avgScorePct ? `${Math.round(dashboard.avgScorePct)}%` : "—"}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold text-primary">All Exams</h2>
            <Link href="/exams/new">
              <Button size="sm" variant="outline" className="gap-1 border-accent text-accent hover:bg-accent hover:text-accent-foreground font-semibold">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </Link>
          </div>

          <Tabs defaultValue="section-a" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="section-a" className="gap-2">
                <FileText className="h-4 w-4" /> Section A
              </TabsTrigger>
              <TabsTrigger value="section-b" className="gap-2">
                <PenLine className="h-4 w-4" /> Section B
              </TabsTrigger>
            </TabsList>

            <TabsContent value="section-a">
              <div className="grid gap-4 sm:grid-cols-2">
                {isLoadingExams ? (
                  Array(4).fill(0).map((_, i) => <Card key={i} className="shadow-sm"><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)
                ) : sectionA.length === 0 ? (
                  <div className="col-span-2 py-12 text-center border-2 border-dashed border-border rounded-xl">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No Section A questions yet</h3>
                  </div>
                ) : (
                  sectionA.map((question: any) => (
                    <Card key={question.id} className="shadow-sm border-border/60">
                      <CardHeader>
                        <Badge variant="secondary" className="w-fit">MCQ</Badge>
                        <CardTitle className="line-clamp-2 text-lg leading-tight font-serif">{question.prompt}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        <MathRenderer text={question.prompt} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="section-b">
              <div className="grid gap-4 sm:grid-cols-2">
                {isLoadingExams ? (
                  Array(4).fill(0).map((_, i) => <Card key={i} className="shadow-sm"><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)
                ) : sectionB.length === 0 ? (
                  <div className="col-span-2 py-12 text-center border-2 border-dashed border-border rounded-xl">
                    <PenLine className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No Section B questions yet</h3>
                  </div>
                ) : (
                  sectionB.map((question: any) => (
                    <Card key={question.id} className="shadow-sm border-border/60">
                      <CardHeader>
                        <Badge variant="secondary" className="w-fit bg-accent/10 text-accent">Essay</Badge>
                        <CardTitle className="line-clamp-2 text-lg leading-tight font-serif">{question.prompt}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        <MathRenderer text={question.prompt} />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 font-serif">
                <Trophy className="h-5 w-5 text-accent" /> Top Exams
              </CardTitle>
              <CardDescription>Most attempted exams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingDashboard ? <Skeleton className="h-32 w-full" /> : dashboard?.topExams.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No data yet</p> : dashboard?.topExams.map((exam, i) => (
                <div key={exam.examId} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs font-bold text-muted-foreground">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/exams/${exam.examId}`} className="text-sm font-medium hover:underline truncate block">{exam.courseCode ? `${exam.courseCode}: ` : ''}{exam.title}</Link>
                    <p className="text-xs text-muted-foreground">{exam.attemptCount} attempts</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 font-serif">
                <History className="h-5 w-5" /> Recent Attempts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingAttempts ? <Skeleton className="h-32 w-full" /> : recentAttempts?.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No attempts yet</p> : recentAttempts?.map((attempt) => (
                <div key={attempt.id} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                  <Link href={`/attempts/${attempt.id}`} className="text-sm font-medium hover:underline truncate">{attempt.examTitle}</Link>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{format(new Date(attempt.startedAt), "MMM d, yyyy")}</span>
                    {attempt.status === "finished" ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">{Math.round(attempt.scorePct)}%</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">In Progress</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
