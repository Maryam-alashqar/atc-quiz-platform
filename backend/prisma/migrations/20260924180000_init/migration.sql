-- CreateSchema
BEGIN;

CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "QuizLanguage" AS ENUM ('AR', 'EN');

-- CreateEnum
CREATE TYPE "NegativeMarking" AS ENUM ('NONE', 'FRACTION', 'FIXED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "classId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "language" "QuizLanguage" NOT NULL DEFAULT 'EN',
    "durationMinutes" INTEGER NOT NULL DEFAULT 20,
    "opensAt" TIMESTAMPTZ(3) NOT NULL,
    "closesAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "negativeMarking" "NegativeMarking" NOT NULL DEFAULT 'NONE',
    "penaltyValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizClass" (
    "quizId" UUID NOT NULL,
    "classId" UUID NOT NULL,

    CONSTRAINT "QuizClass_pkey" PRIMARY KEY ("quizId","classId")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" DECIMAL(12,4) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DECIMAL(20,8),
    "maxScore" DECIMAL(20,8) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "attemptId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("attemptId","questionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_classId_idx" ON "User"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_name_key" ON "Class"("name");

-- CreateIndex
CREATE INDEX "Quiz_teacherId_idx" ON "Quiz"("teacherId");

-- CreateIndex
CREATE INDEX "Quiz_status_opensAt_closesAt_idx" ON "Quiz"("status", "opensAt", "closesAt");

-- CreateIndex
CREATE INDEX "QuizClass_classId_idx" ON "QuizClass"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_id_quizId_key" ON "Question"("id", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_quizId_order_key" ON "Question"("quizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Option_id_questionId_key" ON "Option"("id", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Option_questionId_order_key" ON "Option"("questionId", "order");

-- CreateIndex
CREATE INDEX "Attempt_studentId_startedAt_idx" ON "Attempt"("studentId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_quizId_studentId_key" ON "Attempt"("quizId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_id_quizId_key" ON "Attempt"("id", "quizId");

-- CreateIndex
CREATE INDEX "Answer_questionId_quizId_idx" ON "Answer"("questionId", "quizId");

-- CreateIndex
CREATE INDEX "Answer_optionId_questionId_idx" ON "Answer"("optionId", "questionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizClass" ADD CONSTRAINT "QuizClass_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizClass" ADD CONSTRAINT "QuizClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_quizId_fkey" FOREIGN KEY ("attemptId", "quizId") REFERENCES "Attempt"("id", "quizId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_quizId_fkey" FOREIGN KEY ("questionId", "quizId") REFERENCES "Question"("id", "quizId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_optionId_questionId_fkey" FOREIGN KEY ("optionId", "questionId") REFERENCES "Option"("id", "questionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL checks are maintained in SQL because Prisma's schema does not
-- represent them. Preserve these constraints in future migrations.
ALTER TABLE "User" ADD CONSTRAINT "User_class_role_check" CHECK (
    ("role" = 'STUDENT' AND "classId" IS NOT NULL)
    OR ("role" IN ('TEACHER', 'ADMIN') AND "classId" IS NULL)
);

ALTER TABLE "Quiz"
    ADD CONSTRAINT "Quiz_duration_check" CHECK ("durationMinutes" > 0),
    ADD CONSTRAINT "Quiz_window_check" CHECK ("closesAt" > "opensAt"),
    ADD CONSTRAINT "Quiz_penalty_check" CHECK (
        ("negativeMarking" = 'NONE' AND "penaltyValue" = 0)
        OR ("negativeMarking" = 'FRACTION' AND "penaltyValue" > 0 AND "penaltyValue" <= 1)
        OR ("negativeMarking" = 'FIXED' AND "penaltyValue" > 0 AND "penaltyValue" < 'NaN'::numeric)
    );

ALTER TABLE "Question"
    ADD CONSTRAINT "Question_points_check" CHECK ("points" > 0 AND "points" < 'NaN'::numeric),
    ADD CONSTRAINT "Question_order_check" CHECK ("order" > 0);

ALTER TABLE "Option" ADD CONSTRAINT "Option_order_check" CHECK ("order" BETWEEN 1 AND 4);

ALTER TABLE "Attempt"
    ADD CONSTRAINT "Attempt_deadline_check" CHECK ("deadlineAt" > "startedAt"),
    ADD CONSTRAINT "Attempt_max_score_check" CHECK ("maxScore" > 0 AND "maxScore" < 'NaN'::numeric),
    ADD CONSTRAINT "Attempt_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= "maxScore")),
    ADD CONSTRAINT "Attempt_completion_check" CHECK (
        ("status" = 'IN_PROGRESS' AND "submittedAt" IS NULL AND "score" IS NULL)
        OR ("status" IN ('SUBMITTED', 'EXPIRED') AND "submittedAt" IS NOT NULL
            AND "submittedAt" >= "startedAt" AND "score" IS NOT NULL)
    );

COMMIT;
