import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import examsRouter from "./exams";
import questionsRouter from "./questions";
import attemptsRouter from "./attempts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(examsRouter);
router.use(questionsRouter);
router.use(attemptsRouter);

export default router;
