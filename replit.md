# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Replit Auth (OIDC + PKCE, cookie sessions)
- **Math rendering**: KaTeX

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **`artifacts/api-server`** — Express API server at `/api`. All routes: health, auth (Replit OIDC), exams, questions, attempts, leaderboard, dashboard. Input/output validated with generated Zod schemas.
- **`artifacts/examforge`** — ExamForge React + Vite web app at `/`. Full-featured exam study platform.

## ExamForge Features

- Create exams with MCQ and Essay (Section B) questions
- Shuffled quiz taking with live timer (elapsed seconds tracked)
- Section A / Section B tab split in quiz view
- MCQ: immediate feedback, correct/incorrect reveal
- Essay: free-text answer submission per question
- KaTeX math rendering in prompts and options (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`)
- Leaderboard per exam (fastest finishers, ranked)
- Per-exam stats: attempt count, avg score, topic breakdown, repeat hotlist
- Bulk import from JSON
- Replit Auth login/logout with user avatar in header
- ASP 401 African Studies seed data (15 MCQ past questions)

## Database (Drizzle)

Schema in `lib/db/src/schema/exams.ts`:
- `exams` (id, title, courseCode, institution, description)
- `questions` (examId, questionType enum[mcq|essay], topic, prompt, options[], correctIndex nullable, explanation, reference, repeatNote, position)
- `attempts` (examId, userId, userName, status, score, total, elapsedSeconds, startedAt, finishedAt)
- `attempt_questions` (attemptId, questionId, optionOrder[], correctIndex remapped, selectedIndex, essayAnswer, isCorrect)
- `users` (id, email, firstName, lastName, profileImageUrl) — from auth

Auth schema in `lib/db/src/schema/auth.ts`.

`correctIndex` is never returned to the client until the MCQ question has been answered. Essay questions have null correctIndex.

## Auth

- Browser: OIDC PKCE flow via `/api/login` → `/api/callback`, cookie session (`sid`)
- Session data stored in DB via `lib/auth.ts` createSession/getSession
- `authMiddleware` attaches `req.user` and `req.isAuthenticated()` to every request
- `useAuth()` hook from `@workspace/replit-auth-web` — login/logout, user state

## Seed Data

`pnpm --filter @workspace/scripts run seed-asp401` — seeds the ASP 401 (African Studies) exam with 15 past questions. Idempotent (skips if exam already exists).
