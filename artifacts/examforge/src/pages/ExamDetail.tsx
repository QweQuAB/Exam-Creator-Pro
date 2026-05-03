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
import { MathRenderer } from "@/components/MathRenderer";

const questionSchema = z.object({
  questionType: z.enum(["mcq", "essay"]).default("mcq"),
  topic: z.string().optional(),
  prompt: z.string().min(1, "Prompt is required"),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().min(0).optional(),
  explanation: z.string().optional(),
  reference: z.string().optional(),
  repeatNote: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.questionType === "mcq") {
    const opts = data.options ?? [];
    if (opts.length < 2 || opts.some((o) => !o.trim())) ctx.addIssue({ code: "custom", message: "At least 2 non-empty options required", path: ["options"] });
    if (data.correctIndex === undefined || data.correctIndex === null) ctx.addIssue({ code: "custom", message: "Select the correct answer", path: ["correctIndex"] });
  }
});
type QuestionFormValues = z.infer<typeof questionSchema>;

const examMetaSchema = z.object({ title: z.string().min(1, "Title is required"), courseCode: z.string().optional(), institution: z.string().optional(), description: z.string().optional() });
type ExamMetaValues = z.infer<typeof examMetaSchema>;

const DEFAULT_QUESTION: QuestionFormValues = { questionType: "mcq", prompt: "", topic: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", reference: "", repeatNote: "" };

export default function ExamDetail() {
  const { examId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("questions");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [showDeleteExam, setShowDeleteExam] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: exam, isLoading: isLoadingExam } = useGetExam(examId!, { query: { enabled: !!examId, queryKey: getGetExamQueryKey(examId!) } });
  const { data: stats, isLoading: isLoadingStats } = useGetExamStats(examId!, { query: { enabled: !!examId, queryKey: getGetExamStatsQueryKey(examId!) } });
  const { data: attempts, isLoading: isLoadingAttempts } = useListAttemptsForExam(examId!, { limit: 10 }, { query: { enabled: !!examId, queryKey: getListAttemptsForExamQueryKey(examId!, { limit: 10 }) } });

  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  const metaForm = useForm<ExamMetaValues>({ resolver: zodResolver(examMetaSchema), values: exam ? { title: exam.title, courseCode: exam.courseCode || "", institution: exam.institution || "", description: exam.description || "" } : undefined });
  const questionForm = useForm<QuestionFormValues>({ resolver: zodResolver(questionSchema), defaultValues: DEFAULT_QUESTION });

  const onSaveMeta = (data: ExamMetaValues) => { updateExam.mutate({ examId: examId!, data: { title: data.title, courseCode: data.courseCode || null, institution: data.institution || null, description: data.description || null } }, { onSuccess: () => { setIsEditingMeta(false); queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) }); queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() }); } }); };
  const onDeleteExam = () => { deleteExam.mutate({ examId: examId! }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() }); setLocation("/"); } }); };
  const onSaveQuestion = (data: QuestionFormValues) => {
    const isEssay = data.questionType === "essay";
    const payload = { questionType: data.questionType, prompt: data.prompt, topic: data.topic || null, options: isEssay ? [] : (data.options ?? []), correctIndex: isEssay ? null : (data.correctIndex ?? null), explanation: data.explanation || null, reference: data.reference || null, repeatNote: data.repeatNote || null };
    if (editingQuestionId) updateQuestion.mutate({ questionId: editingQuestionId, data: payload }, { onSuccess: () => { setEditingQuestionId(null); queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) }); } });
    else createQuestion.mutate({ examId: examId!, data: payload }, { onSuccess: () => { setShowAddQuestion(false); questionForm.reset(DEFAULT_QUESTION); queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) }); queryClient.invalidateQueries({ queryKey: getGetExamStatsQueryKey(examId!) }); } });
  };

  const openEditQuestion = (q: any) => { const isEssay = q.questionType === "essay"; questionForm.reset({ questionType: isEssay ? "essay" : "mcq", prompt: q.prompt, topic: q.topic || "", options: isEssay ? ["", "", "", ""] : [...q.options], correctIndex: isEssay ? 0 : (q.correctIndex ?? 0), explanation: q.explanation || "", reference: q.reference || "", repeatNote: q.repeatNote || "" }); setEditingQuestionId(q.id); };
  const cancelQuestionEdit = () => { setEditingQuestionId(null); setShowAddQuestion(false); questionForm.reset(DEFAULT_QUESTION); };

  if (isLoadingExam) return <div className="max-w-5xl mx-auto space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!exam) return <div className="text-center py-20">Exam not found</div>;

  const mcqQuestions = exam.questions.filter((q: any) => q.questionType !== "essay");
  const essayQuestions = exam.questions.filter((q: any) => q.questionType === "essay");

  return (
    <div className="max-w-5xl mx-auto w-full animate-in fade-in duration-500 space-y-8">
      <Card className="border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1 space-y-4">
              {isEditingMeta ? <Form {...metaForm}><form onSubmit={metaForm.handleSubmit(onSaveMeta)} className="space-y-4">...</form></Form> : <><div>{exam.courseCode && <Badge className="mb-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">{exam.courseCode}</Badge>}<h1 className="text-3xl font-serif font-bold text-primary tracking-tight">{exam.title}</h1>{exam.institution && <p className="text-sm font-medium text-muted-foreground mt-1">{exam.institution}</p>}</div>{exam.description && <p className="text-muted-foreground">{exam.description}</p>}<div className="flex gap-2">{mcqQuestions.length > 0 && <Badge variant="secondary" className="gap-1"><FileText className="w-3 h-3" /> {mcqQuestions.length} MCQ</Badge>}{essayQuestions.length > 0 && <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent border-accent/20"><PenLine className="w-3 h-3" /> {essayQuestions.length} Essay</Badge>}</div></>}
            </div>
            <div className="flex flex-col gap-3 min-w-[200px]"><Link href={`/exams/${exam.id}/take`}><Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2">Take Quiz <ArrowRight className="w-4 h-4" /></Button></Link></div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start h-12 bg-transparent border-b border-border/40 rounded-none p-0">
          <TabsTrigger value="questions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium">Section A / B</TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium">Stats & Attempts</TabsTrigger>
          <TabsTrigger value="leaderboard" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium gap-2"><Trophy className="w-4 h-4" /> Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="pt-6 space-y-6">
          <Tabs defaultValue="section-a" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="section-a">Section A</TabsTrigger>
              <TabsTrigger value="section-b">Section B</TabsTrigger>
            </TabsList>
            <TabsContent value="section-a" className="space-y-4">{mcqQuestions.map((q: any, index: number) => <Card key={q.id} className="hover:border-primary/30 transition-colors shadow-sm"><CardContent className="p-6">...<div className="font-medium text-lg leading-snug"><MathRenderer text={q.prompt} /></div>...<span><MathRenderer text={opt} /></span>...</CardContent></Card>)}</TabsContent>
            <TabsContent value="section-b" className="space-y-4">{essayQuestions.map((q: any, index: number) => <Card key={q.id} className="hover:border-primary/30 transition-colors shadow-sm"><CardContent className="p-6">...<div className="font-medium text-lg leading-snug"><MathRenderer text={q.prompt} /></div>...Essay question... </CardContent></Card>)}</TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="stats" className="pt-6 space-y-6">...</TabsContent>
        <TabsContent value="leaderboard" className="pt-6"><Leaderboard examId={examId!} /></TabsContent>
      </Tabs>

      <BulkImportDialog open={showImport} onOpenChange={setShowImport} examId={examId!} />
    </div>
  );
}

function QuestionEditorForm({ form, onSave, onCancel, isPending }: { form: any; onSave: any; onCancel: any; isPending: boolean; }) { return <Form {...form}>...</Form>; }
