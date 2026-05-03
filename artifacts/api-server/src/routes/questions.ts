import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, questionsTable, examsTable } from "@workspace/db";
import {
  BulkImportQuestionsBody,
  CreateQuestionBody,
  UpdateQuestionBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/exams/:examId/questions", async (req, res) => {
  const examId = req.params.examId;
  const body = CreateQuestionBody.parse(req.body);
  const qType = body.questionType ?? "mcq";

  if (qType === "mcq") {
    if (!body.options || body.options.length < 2) {
      res.status(400).json({ error: "MCQ questions require at least 2 options." });
      return;
    }
    if (body.correctIndex === null || body.correctIndex === undefined) {
      res.status(400).json({ error: "MCQ questions require a correctIndex." });
      return;
    }
    if (body.correctIndex < 0 || body.correctIndex >= body.options.length) {
      res.status(400).json({ error: "correctIndex out of range" });
      return;
    }
  }

  const [exam] = await db
    .select({ id: examsTable.id })
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${questionsTable.position}) + 1, 0)::int`,
    })
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId));

  const [row] = await db
    .insert(questionsTable)
    .values({
      examId,
      questionType: qType,
      topic: body.topic ?? null,
      prompt: body.prompt,
      options: qType === "essay" ? [] : (body.options ?? []),
      correctIndex: qType === "essay" ? null : (body.correctIndex ?? null),
      explanation: body.explanation ?? null,
      reference: body.reference ?? null,
      repeatNote: body.repeatNote ?? null,
      position: next,
    })
    .returning();

  await db
    .update(examsTable)
    .set({ updatedAt: new Date() })
    .where(eq(examsTable.id, examId));

  res.status(201).json(row);
});

router.post("/exams/:examId/questions/bulk", async (req, res) => {
  const examId = req.params.examId;
  const body = BulkImportQuestionsBody.parse(req.body);

  const [exam] = await db
    .select({ id: examsTable.id })
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i]!;
    const qType = q.questionType ?? "mcq";
    if (qType === "mcq") {
      if (!q.options || q.options.length < 2) {
        res.status(400).json({ error: `Question #${i + 1}: MCQ requires at least 2 options.` });
        return;
      }
      if (q.correctIndex === null || q.correctIndex === undefined) {
        res.status(400).json({ error: `Question #${i + 1}: MCQ requires correctIndex.` });
        return;
      }
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        res.status(400).json({
          error: `Question #${i + 1}: correctIndex ${q.correctIndex} is out of range for ${q.options.length} options.`,
        });
        return;
      }
    }
  }

  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${questionsTable.position}) + 1, 0)::int`,
    })
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId));

  const rows = body.questions.map((q, idx) => {
    const qType = q.questionType ?? "mcq";
    return {
      examId,
      questionType: qType,
      topic: q.topic ?? null,
      prompt: q.prompt,
      options: qType === "essay" ? [] : (q.options ?? []),
      correctIndex: qType === "essay" ? null : (q.correctIndex ?? null),
      explanation: q.explanation ?? null,
      reference: q.reference ?? null,
      repeatNote: q.repeatNote ?? null,
      position: next + idx,
    };
  });

  const inserted = await db.insert(questionsTable).values(rows).returning({ id: questionsTable.id });

  await db
    .update(examsTable)
    .set({ updatedAt: new Date() })
    .where(eq(examsTable.id, examId));

  res.status(201).json({ insertedCount: inserted.length, examId });
});

router.patch("/questions/:questionId", async (req, res) => {
  const questionId = req.params.questionId;
  const body = UpdateQuestionBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, questionId));
  if (!existing) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  const update: Record<string, unknown> = {};
  if (body.questionType !== undefined) update.questionType = body.questionType;
  if (body.topic !== undefined) update.topic = body.topic;
  if (body.prompt !== undefined) update.prompt = body.prompt;
  if (body.options !== undefined) update.options = body.options;
  if (body.correctIndex !== undefined) update.correctIndex = body.correctIndex;
  if (body.explanation !== undefined) update.explanation = body.explanation;
  if (body.reference !== undefined) update.reference = body.reference;
  if (body.repeatNote !== undefined) update.repeatNote = body.repeatNote;
  if (body.position !== undefined) update.position = body.position;

  const finalType = (update.questionType as string | undefined) ?? existing.questionType;
  if (finalType === "mcq") {
    const finalOptions = (update.options as string[] | undefined) ?? existing.options;
    const finalCorrect = (update.correctIndex as number | null | undefined) ?? existing.correctIndex;
    if (finalOptions.length < 2) {
      res.status(400).json({ error: "MCQ requires at least 2 options." });
      return;
    }
    if (finalCorrect === null || finalCorrect === undefined) {
      res.status(400).json({ error: "MCQ requires a correctIndex." });
      return;
    }
    if (finalCorrect < 0 || finalCorrect >= finalOptions.length) {
      res.status(400).json({ error: "correctIndex out of range" });
      return;
    }
  }

  const [row] = await db
    .update(questionsTable)
    .set(update)
    .where(eq(questionsTable.id, questionId))
    .returning();

  await db
    .update(examsTable)
    .set({ updatedAt: new Date() })
    .where(eq(examsTable.id, existing.examId));

  res.json(row);
});

router.delete("/questions/:questionId", async (req, res) => {
  await db
    .delete(questionsTable)
    .where(eq(questionsTable.id, req.params.questionId));
  res.status(204).send();
});

export default router;
