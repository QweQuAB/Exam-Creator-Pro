import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  BookOpen, Edit2, Plus, ArrowRight, Settings, Trash2,
  AlertTriangle, Save, X, Target, History, TrendingUp,
  Star, Upload, Trophy, PenLine, FileText,
} from "lucide-react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Leaderboard } from "@/components/Leaderboard";
import { MathRenderer } from "@/components/MathRenderer";
import {
  useGetExam,
  useUpdateExam,
  useDeleteExam,
  useGetExamStats,
  useListAttemptsForExam,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  getGetExamQueryKey,
  getGetExamStatsQueryKey,
  getListExamsQueryKey,
  getListAttemptsForExamQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// -- Form schemas --
const questionSchema = z
  .object({
    questionType: z.enum(["mcq", "essay"]).default("mcq"),
    topic: z.string().optional(),
    prompt: z.string().min(1, "Prompt is required"),
    options: z.array(z.string()).optional(),
    correctIndex: z.number().min(0).optional(),
    explanation: z.string().optional(),
    reference: z.string().optional(),
    repeatNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.questionType === "mcq") {
      const opts = data.options ?? [];
      if (opts.length < 2 || opts.some((o) => !o.trim())) {
        ctx.addIssue({ code: "custom", message: "At least 2 non-empty options required", path: ["options"] });
      }
      if (data.correctIndex === undefined || data.correctIndex === null) {
        ctx.addIssue({ code: "custom", message: "Select the correct answer", path: ["correctIndex"] });
      }
    }
  });
type QuestionFormValues = z.infer<typeof questionSchema>;

const examMetaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  courseCode: z.string().optional(),
  institution: z.string().optional(),
  description: z.string().optional(),
});
type ExamMetaValues = z.infer<typeof examMetaSchema>;

const DEFAULT_QUESTION: QuestionFormValues = {
  questionType: "mcq",
  prompt: "",
  topic: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  reference: "",
  repeatNote: "",
};

export default function ExamDetail() {
  const { examId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("questions");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [showDeleteExam, setShowDeleteExam] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showImport, setShowImport] = useState<"mcq" | "essay" | null>(null);

  // -- Queries --
  const { data: exam, isLoading: isLoadingExam } = useGetExam(examId!, {
    query: { enabled: !!examId, queryKey: getGetExamQueryKey(examId!) },
  });
  const { data: stats, isLoading: isLoadingStats } = useGetExamStats(examId!, {
    query: { enabled: !!examId, queryKey: getGetExamStatsQueryKey(examId!) },
  });
  const { data: attempts, isLoading: isLoadingAttempts } = useListAttemptsForExam(
    examId!,
    { limit: 10 },
    { query: { enabled: !!examId, queryKey: getListAttemptsForExamQueryKey(examId!, { limit: 10 }) } },
  );

  // -- Mutations --
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  // -- Forms --
  const metaForm = useForm<ExamMetaValues>({
    resolver: zodResolver(examMetaSchema),
    values: exam
      ? {
          title: exam.title,
          courseCode: exam.courseCode || "",
          institution: exam.institution || "",
          description: exam.description || "",
        }
      : undefined,
  });

  const questionForm = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: DEFAULT_QUESTION,
  });

  // -- Handlers --
  const onSaveMeta = (data: ExamMetaValues) => {
    updateExam.mutate(
      {
        examId: examId!,
        data: {
          title: data.title,
          courseCode: data.courseCode || null,
          institution: data.institution || null,
          description: data.description || null,
        },
      },
      {
        onSuccess: () => {
          setIsEditingMeta(false);
          queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) });
          queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
        },
      },
    );
  };

  const onDeleteExam = () => {
    deleteExam.mutate(
      { examId: examId! },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
          setLocation("/");
        },
      },
    );
  };

  const onSaveQuestion = (data: QuestionFormValues) => {
    const isEssay = data.questionType === "essay";
    const payload = {
      questionType: data.questionType,
      prompt: data.prompt,
      topic: data.topic || null,
      options: isEssay ? [] : (data.options ?? []),
      correctIndex: isEssay ? null : (data.correctIndex ?? null),
      explanation: data.explanation || null,
      reference: data.reference || null,
      repeatNote: data.repeatNote || null,
    };

    if (editingQuestionId) {
      updateQuestion.mutate(
        { questionId: editingQuestionId, data: payload },
        {
          onSuccess: () => {
            setEditingQuestionId(null);
            queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) });
          },
        },
      );
    } else {
      createQuestion.mutate(
        { examId: examId!, data: payload },
        {
          onSuccess: () => {
            setShowAddQuestion(false);
            questionForm.reset(DEFAULT_QUESTION);
            queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) });
            queryClient.invalidateQueries({ queryKey: getGetExamStatsQueryKey(examId!) });
          },
        },
      );
    }
  };

  const openEditQuestion = (q: any) => {
    const isEssay = q.questionType === "essay";
    questionForm.reset({
      questionType: isEssay ? "essay" : "mcq",
      prompt: q.prompt,
      topic: q.topic || "",
      options: isEssay ? ["", "", "", ""] : [...q.options],
      correctIndex: isEssay ? 0 : (q.correctIndex ?? 0),
      explanation: q.explanation || "",
      reference: q.reference || "",
      repeatNote: q.repeatNote || "",
    });
    setEditingQuestionId(q.id);
  };

  const cancelQuestionEdit = () => {
    setEditingQuestionId(null);
    setShowAddQuestion(false);
    questionForm.reset(DEFAULT_QUESTION);
  };

  if (isLoadingExam) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!exam) {
    return <div className="text-center py-20">Exam not found</div>;
  }

  const mcqQuestions = exam.questions.filter((q: any) => !q.questionType || q.questionType === "mcq");
  const essayQuestions = exam.questions.filter((q: any) => q.questionType === "essay");

  // Render a single question card (shared by Section A and Section B views)
  const renderQuestionCard = (q: any, index: number, globalIndex: number) => {
    if (editingQuestionId === q.id) {
      return (
        <Card key={q.id} className="border-primary shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardHeader>
            <CardTitle className="text-lg">Edit Question {globalIndex + 1}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionEditorForm
              form={questionForm}
              onSave={onSaveQuestion}
              onCancel={cancelQuestionEdit}
              isPending={updateQuestion.isPending}
            />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card key={q.id} className="hover:border-primary/30 transition-colors shadow-sm">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-none pt-1">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold text-sm">
                {index + 1}
              </span>
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {q.topic && (
                      <Badge variant="outline" className="text-accent border-accent/30 bg-accent/5">
                        {q.topic}
                      </Badge>
                    )}
                    {q.questionType === "essay" ? (
                      <Badge variant="outline" className="gap-1 text-xs bg-accent/10 text-accent border-accent/20">
                        <PenLine className="w-3 h-3" /> Essay
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs bg-secondary text-muted-foreground">
                        <FileText className="w-3 h-3" /> MCQ
                      </Badge>
                    )}
                  </div>
                  <div className="font-medium text-lg leading-snug">
                    <MathRenderer text={q.prompt} />
                    {q.repeatNote && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex ml-2 align-middle cursor-help text-accent hover:scale-110 transition-transform">
                            <Star className="w-5 h-5 fill-current" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-primary-foreground p-3 max-w-xs text-sm">
                          <div dangerouslySetInnerHTML={{ __html: q.repeatNote }} />
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditQuestion(q)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Delete this question?")) {
                        deleteQuestion.mutate(
                          { questionId: q.id },
                          {
                            onSuccess: () =>
                              queryClient.invalidateQueries({
                                queryKey: getGetExamQueryKey(examId!),
                              }),
                          },
                        );
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {q.questionType === "essay" ? (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-sm text-muted-foreground italic">
                  Essay question — students write a free-form response.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {(q.options ?? []).map((opt: string, i: number) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-sm flex gap-3 ${
                        i === q.correctIndex
                          ? "border-success bg-success/5 font-medium"
                          : "border-border/60 bg-card"
                      }`}
                    >
                      <span
                        className={`flex-none w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          i === q.correctIndex
                            ? "bg-success text-success-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span><MathRenderer text={opt} /></span>
                    </div>
                  ))}
                </div>
              )}

              {(q.explanation || q.reference) && (
                <div className="bg-secondary/30 p-4 rounded-lg text-sm space-y-2 mt-4 border border-border/40">
                  {q.explanation && (
                    <div>
                      <span className="font-semibold text-primary">Explanation:</span>{" "}
                      <span className="text-muted-foreground">{q.explanation}</span>
                    </div>
                  )}
                  {q.reference && (
                    <div>
                      <span className="font-semibold text-primary">Reference:</span>{" "}
                      <span className="text-muted-foreground">{q.reference}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full animate-in fade-in duration-500 space-y-8">
      {/* Header */}
      <Card className="border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1 space-y-4">
              {isEditingMeta ? (
                <Form {...metaForm}>
                  <form onSubmit={metaForm.handleSubmit(onSaveMeta)} className="space-y-4">
                    <FormField
                      control={metaForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} className="font-serif text-lg font-bold" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-4">
                      <FormField
                        control={metaForm.control}
                        name="courseCode"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Course Code" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={metaForm.control}
                        name="institution"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Institution" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={metaForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea placeholder="Description" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" type="submit" disabled={updateExam.isPending}>
                        <Save className="w-4 h-4 mr-2" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingMeta(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <>
                  <div>
                    {exam.courseCode && (
                      <Badge className="mb-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                        {exam.courseCode}
                      </Badge>
                    )}
                    <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">
                      {exam.title}
                    </h1>
                    {exam.institution && (
                      <p className="text-sm font-medium text-muted-foreground mt-1">{exam.institution}</p>
                    )}
                  </div>
                  {exam.description && <p className="text-muted-foreground">{exam.description}</p>}
                  <div className="flex gap-2">
                    {mcqQuestions.length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <FileText className="w-3 h-3" /> {mcqQuestions.length} MCQ
                      </Badge>
                    )}
                    {essayQuestions.length > 0 && (
                      <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent border-accent/20">
                        <PenLine className="w-3 h-3" /> {essayQuestions.length} Essay
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 min-w-[200px]">
              <Link href={`/exams/${exam.id}/take`}>
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2"
                >
                  Take Quiz <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              {!isEditingMeta && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsEditingMeta(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Dialog open={showDeleteExam} onOpenChange={setShowDeleteExam}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive border-destructive/20 hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Exam?</DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. All questions and attempts will be permanently
                          deleted.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteExam(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={onDeleteExam}
                          disabled={deleteExam.isPending}
                        >
                          Yes, Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start h-12 bg-transparent border-b border-border/40 rounded-none p-0">
          <TabsTrigger
            value="questions"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium"
          >
            Questions ({exam.questions.length})
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium"
          >
            Stats & Attempts
          </TabsTrigger>
          <TabsTrigger
            value="leaderboard"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium gap-2"
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* Questions Tab — split into Section A (MCQ) and Section B (Essay) */}
        <TabsContent value="questions" className="pt-6 space-y-6">
          {!showAddQuestion && !editingQuestionId && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImport("mcq")} className="gap-2">
                <Upload className="w-4 h-4" /> Import MCQ
              </Button>
            </div>
          )}

          {showAddQuestion && (
            <Card className="border-accent shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
              <CardHeader>
                <CardTitle className="text-lg">New Question</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionEditorForm
                  form={questionForm}
                  onSave={onSaveQuestion}
                  onCancel={cancelQuestionEdit}
                  isPending={createQuestion.isPending}
                />
              </CardContent>
            </Card>
          )}

          {exam.questions.length === 0 && !showAddQuestion ? (
            <div className="text-center py-16 border-2 border-dashed border-border/60 rounded-xl">
              <Target className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium">No questions yet</h3>
              <p className="text-muted-foreground mt-1 mb-4">
                Add questions one by one, or import a batch from a JSON file.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => setShowImport("mcq")} className="gap-2">
                  <Upload className="w-4 h-4" /> Bulk Import
                </Button>
                <Button
                  onClick={() => {
                    questionForm.reset({ ...DEFAULT_QUESTION, questionType: "mcq" });
                    setShowAddQuestion(true);
                  }}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                >
                  <Plus className="w-4 h-4" /> Add First MCQ
                </Button>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="section-a" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-sm">
                <TabsTrigger value="section-a" className="gap-2">
                  <FileText className="w-4 h-4" /> Section A
                  {mcqQuestions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{mcqQuestions.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="section-b" className="gap-2">
                  <PenLine className="w-4 h-4" /> Section B
                  {essayQuestions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs bg-accent/10 text-accent">{essayQuestions.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="section-a" className="space-y-4">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowImport("mcq")} className="gap-2">
                    <Upload className="w-4 h-4" /> Import MCQ
                  </Button>
                  <Button
                    onClick={() => {
                      questionForm.reset({ ...DEFAULT_QUESTION, questionType: "mcq" });
                      setShowAddQuestion(true);
                    }}
                    className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Plus className="w-4 h-4" /> Add MCQ
                  </Button>
                </div>
                {mcqQuestions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-xl">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">No MCQ questions yet. Add one above.</p>
                  </div>
                ) : (
                  mcqQuestions.map((q: any, index: number) =>
                    renderQuestionCard(q, index, exam.questions.indexOf(q))
                  )
                )}
              </TabsContent>

              <TabsContent value="section-b" className="space-y-4">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowImport("essay")} className="gap-2">
                    <Upload className="w-4 h-4" /> Import Essay
                  </Button>
                  <Button
                    onClick={() => {
                      questionForm.reset({
                        ...DEFAULT_QUESTION,
                        questionType: "essay",
                        options: [],
                        correctIndex: undefined,
                      });
                      setShowAddQuestion(true);
                    }}
                    className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Plus className="w-4 h-4" /> Add Essay
                  </Button>
                </div>
                {essayQuestions.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-xl">
                    <PenLine className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">No essay questions yet. Add one above.</p>
                  </div>
                ) : (
                  essayQuestions.map((q: any, index: number) =>
                    renderQuestionCard(q, index, exam.questions.indexOf(q))
                  )
                )}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="pt-6 space-y-6">
          {isLoadingStats ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="w-4 h-4" /> Total Attempts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.attemptCount || 0}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Average Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {stats?.avgScorePct != null ? `${Math.round(stats.avgScorePct)}%` : "—"}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="w-4 h-4" /> Best Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {stats?.bestScorePct != null ? `${Math.round(stats.bestScorePct)}%` : "—"}
                  </div>
                </CardContent>
              </Card>

              {stats?.topicBreakdown && stats.topicBreakdown.length > 0 && (
                <Card className="md:col-span-3 shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-serif">Topic Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {stats.topicBreakdown.map((t, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="px-3 py-1 text-sm bg-secondary text-secondary-foreground border-border/40"
                        >
                          {t.topic || "Uncategorized"}{" "}
                          <span className="ml-2 opacity-50">{t.count}</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats?.repeatHotlist && stats.repeatHotlist.length > 0 && (
                <Card className="md:col-span-3 shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Star className="w-4 h-4 text-accent fill-current" /> Exam Repeat Hotlist
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stats.repeatHotlist.map((r) => (
                      <div key={r.questionId} className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
                        <p className="font-medium text-sm mb-1">{r.prompt}</p>
                        <div
                          className="text-xs text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: r.repeatNote }}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div>
            <h3 className="text-lg font-serif font-semibold mb-4">Recent Attempts</h3>
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {isLoadingAttempts ? (
                  <div className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : attempts?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No attempts recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {attempts?.map((attempt) => (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div>
                          <div className="font-medium">
                            {attempt.userName && (
                              <span className="text-accent mr-2">{attempt.userName}</span>
                            )}
                            {format(new Date(attempt.startedAt), "PPP 'at' p")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {attempt.status === "finished"
                              ? `Score: ${attempt.score}/${attempt.total}`
                              : "In Progress"}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {attempt.status === "finished" ? (
                            <Badge className="bg-success text-success-foreground hover:bg-success">
                              {Math.round(attempt.scorePct)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-border/60">
                              Ongoing
                            </Badge>
                          )}
                          <Link href={`/attempts/${attempt.id}`}>
                            <Button variant="ghost" size="sm">
                              Review
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="pt-6">
          <Leaderboard examId={examId!} />
        </TabsContent>
      </Tabs>

      <BulkImportDialog
        open={showImport !== null}
        onOpenChange={(open) => setShowImport(open ? (showImport ?? "mcq") : null)}
        examId={examId!}
        questionType={showImport ?? "mcq"}
      />
    </div>
  );
}

function QuestionEditorForm({
  form,
  onSave,
  onCancel,
  isPending,
}: {
  form: any;
  onSave: any;
  onCancel: any;
  isPending: boolean;
}) {
  const questionType = form.watch("questionType");
  const isEssay = questionType === "essay";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
        {/* Question Type */}
        <FormField
          control={form.control}
          name="questionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question Type</FormLabel>
              <FormControl>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => field.onChange("mcq")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                      field.value === "mcq"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Multiple Choice (MCQ)
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("essay")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                      field.value === "essay"
                        ? "border-accent bg-accent/5 text-accent"
                        : "border-border text-muted-foreground hover:border-accent/30"
                    }`}
                  >
                    <PenLine className="w-4 h-4" /> Essay / Long Answer
                  </button>
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic tag</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Scope & Objectives" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Question Prompt <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[80px]"
                  placeholder={
                    isEssay
                      ? "Discuss the significance of…"
                      : "What is the main objective of…"
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEssay ? (
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 text-sm text-muted-foreground">
            <PenLine className="w-4 h-4 inline mr-2 text-accent" />
            Essay questions allow students to write a free-form response. No options needed.
          </div>
        ) : (
          <div className="space-y-4">
            <Label>
              Options & Correct Answer <span className="text-destructive">*</span>
            </Label>
            <FormField
              control={form.control}
              name="correctIndex"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      value={field.value?.toString() ?? "0"}
                      onValueChange={(val) => field.onChange(parseInt(val))}
                      className="space-y-3"
                    >
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className={`flex items-start space-x-3 p-3 border rounded-lg transition-colors ${
                            field.value === index ? "border-primary bg-primary/5" : "border-border/60"
                          }`}
                        >
                          <RadioGroupItem value={index.toString()} id={`opt-${index}`} className="mt-2" />
                          <div className="flex-1">
                            <FormField
                              control={form.control}
                              name={`options.${index}`}
                              render={({ field: optField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                                      {...optField}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-border/40">
          <FormField
            control={form.control}
            name="explanation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Explanation</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Why is this correct?"
                    className="h-24 resize-none"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Unit 1 Section 4.1"
                    className="h-24 resize-none"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="repeatNote"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Repeat Star Note <Star className="w-3 h-3 text-accent fill-current" />
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Appears 3 times in Exams:<br>• 2018 Q1"
                  className="h-20 font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <CardDescription>Supports basic HTML like &lt;br&gt; for line breaks.</CardDescription>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="w-4 h-4" /> Save Question
          </Button>
        </div>
      </form>
    </Form>
  );
}
