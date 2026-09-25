-- CreateEnum
CREATE TYPE "QuizAudience" AS ENUM ('CLASSES', 'STUDENTS');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "audience" "QuizAudience" NOT NULL DEFAULT 'CLASSES';

-- CreateTable
CREATE TABLE "QuizStudent" (
    "quizId" UUID NOT NULL,
    "studentId" UUID NOT NULL,

    CONSTRAINT "QuizStudent_pkey" PRIMARY KEY ("quizId","studentId")
);

-- CreateIndex
CREATE INDEX "QuizStudent_studentId_idx" ON "QuizStudent"("studentId");

-- AddForeignKey
ALTER TABLE "QuizStudent" ADD CONSTRAINT "QuizStudent_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizStudent" ADD CONSTRAINT "QuizStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
