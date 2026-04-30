import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, questionsTable, examsTable } from "@workspace/db";
import {
  CreateQuestionBody,
  UpdateQuestionBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/exams/:examId/questions", async (req, res) => {
  const examId = req.params.examId;
  const body = CreateQuestionBody.parse(req.body);

  if (body.correctIndex < 0 || body.correctIndex >= body.options.length) {
    res.status(400).json({ error: "correctIndex out of range" });
    return;
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
      topic: body.topic ?? null,
      prompt: body.prompt,
      options: body.options,
      correctIndex: body.correctIndex,
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
  if (body.topic !== undefined) update.topic = body.topic;
  if (body.prompt !== undefined) update.prompt = body.prompt;
  if (body.options !== undefined) update.options = body.options;
  if (body.correctIndex !== undefined) update.correctIndex = body.correctIndex;
  if (body.explanation !== undefined) update.explanation = body.explanation;
  if (body.reference !== undefined) update.reference = body.reference;
  if (body.repeatNote !== undefined) update.repeatNote = body.repeatNote;
  if (body.position !== undefined) update.position = body.position;

  const finalOptions = (update.options as string[] | undefined) ?? existing.options;
  const finalCorrect =
    (update.correctIndex as number | undefined) ?? existing.correctIndex;
  if (finalCorrect < 0 || finalCorrect >= finalOptions.length) {
    res.status(400).json({ error: "correctIndex out of range" });
    return;
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
