-- Run with psql -v ON_ERROR_STOP=1. All fixtures are rolled back.
BEGIN;
SET LOCAL client_encoding = 'UTF8';

CREATE FUNCTION pg_temp.expect_failure(statement text, expected_state text, label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
    BEGIN
        EXECUTE statement;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
        IF actual_state <> expected_state THEN
            RAISE EXCEPTION '%: expected SQLSTATE %, got % (%)', label, expected_state, actual_state, SQLERRM;
        END IF;
        RAISE NOTICE 'PASS: %', label;
        RETURN;
    END;
    RAISE EXCEPTION 'FAIL: % accepted invalid data', label;
END;
$$;

DO $$
DECLARE
    class_id uuid := gen_random_uuid();
    teacher_id uuid := gen_random_uuid();
    student_id uuid := gen_random_uuid();
    quiz_id uuid := gen_random_uuid();
    other_quiz_id uuid := gen_random_uuid();
    question_id uuid := gen_random_uuid();
    other_question_id uuid := gen_random_uuid();
    foreign_question_id uuid := gen_random_uuid();
    option_id uuid;
    other_option_id uuid;
    foreign_option_id uuid;
    attempt_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "Class" (id, name) VALUES (class_id, 'db-test-' || class_id);
    INSERT INTO "User" (id, username, name, "passwordHash", role, "classId", "updatedAt") VALUES
        (teacher_id, 'teacher-' || teacher_id, 'معلم تجريبي', 'test-only', 'TEACHER', NULL, now()),
        (student_id, 'student-' || student_id, 'أحمد الخطيب', 'test-only', 'STUDENT', class_id, now());
    INSERT INTO "Quiz" (id, "teacherId", title, "opensAt", "closesAt", "updatedAt") VALUES
        (quiz_id, teacher_id, 'اختبار الرياضيات', now(), now() + interval '1 hour', now()),
        (other_quiz_id, teacher_id, 'Other quiz', now(), now() + interval '1 hour', now());
    INSERT INTO "QuizClass" ("quizId", "classId") VALUES (quiz_id, class_id);
    INSERT INTO "Question" (id, "quizId", prompt, points, "order") VALUES
        (question_id, quiz_id, 'السؤال الأول', 1.2345, 1),
        (other_question_id, quiz_id, 'Second question', 2, 2),
        (foreign_question_id, other_quiz_id, 'Foreign question', 3, 1);
    INSERT INTO "Option" (id, "questionId", text, "isCorrect", "order")
        SELECT gen_random_uuid(), q, 'Option ' || n, n = 1, n
        FROM unnest(ARRAY[question_id, other_question_id, foreign_question_id]) q
        CROSS JOIN generate_series(1, 4) n;
    SELECT id INTO option_id FROM "Option" WHERE "questionId" = question_id AND "order" = 1;
    SELECT id INTO other_option_id FROM "Option" WHERE "questionId" = other_question_id AND "order" = 1;
    SELECT id INTO foreign_option_id FROM "Option" WHERE "questionId" = foreign_question_id AND "order" = 1;
    INSERT INTO "Attempt" (id, "quizId", "studentId", "deadlineAt", "maxScore")
        VALUES (attempt_id, quiz_id, student_id, now() + interval '20 minutes', 3.2345);
    INSERT INTO "Answer" ("attemptId", "quizId", "questionId", "optionId", "updatedAt")
        VALUES (attempt_id, quiz_id, question_id, option_id, now());

    IF (SELECT name FROM "User" WHERE id = student_id) <> 'أحمد الخطيب' THEN
        RAISE EXCEPTION 'Arabic round-trip failed';
    END IF;
    RAISE NOTICE 'PASS: valid relational fixture and Arabic round-trip';

    PERFORM pg_temp.expect_failure(format('INSERT INTO "Attempt" (id, "quizId", "studentId", "deadlineAt", "maxScore") VALUES (gen_random_uuid(), %L, %L, now() + interval ''20 minutes'', 3.2345)', quiz_id, student_id), '23505', 'duplicate attempt');
    PERFORM pg_temp.expect_failure(format('INSERT INTO "Answer" SELECT * FROM "Answer" WHERE "attemptId" = %L', attempt_id), '23505', 'duplicate answer');
    PERFORM pg_temp.expect_failure(format('UPDATE "Answer" SET "optionId" = %L WHERE "attemptId" = %L', other_option_id, attempt_id), '23503', 'option from another question');
    PERFORM pg_temp.expect_failure(format('UPDATE "Answer" SET "questionId" = %L, "optionId" = %L WHERE "attemptId" = %L', foreign_question_id, foreign_option_id, attempt_id), '23503', 'question from another quiz');
    PERFORM pg_temp.expect_failure(format('UPDATE "Answer" SET "quizId" = %L, "questionId" = %L, "optionId" = %L WHERE "attemptId" = %L', other_quiz_id, foreign_question_id, foreign_option_id, attempt_id), '23503', 'forged answer quiz');
    PERFORM pg_temp.expect_failure(format('UPDATE "User" SET "classId" = NULL WHERE id = %L', student_id), '23514', 'student requires a class');
    PERFORM pg_temp.expect_failure(format('UPDATE "User" SET "classId" = %L WHERE id = %L', class_id, teacher_id), '23514', 'teacher cannot have student class');
    PERFORM pg_temp.expect_failure(format('UPDATE "Quiz" SET "durationMinutes" = 0 WHERE id = %L', quiz_id), '23514', 'zero duration');
    PERFORM pg_temp.expect_failure(format('UPDATE "Quiz" SET "closesAt" = "opensAt" WHERE id = %L', quiz_id), '23514', 'empty availability window');
    PERFORM pg_temp.expect_failure(format('UPDATE "Quiz" SET "penaltyValue" = 1 WHERE id = %L', quiz_id), '23514', 'penalty with NONE mode');
    PERFORM pg_temp.expect_failure(format('UPDATE "Quiz" SET "negativeMarking" = ''FRACTION'', "penaltyValue" = 1.1 WHERE id = %L', quiz_id), '23514', 'fraction over one');
    PERFORM pg_temp.expect_failure(format('UPDATE "Quiz" SET "negativeMarking" = ''FIXED'', "penaltyValue" = -1 WHERE id = %L', quiz_id), '23514', 'negative fixed penalty');
    PERFORM pg_temp.expect_failure(format('UPDATE "Question" SET points = 0 WHERE id = %L', question_id), '23514', 'zero question points');
    PERFORM pg_temp.expect_failure(format('UPDATE "Question" SET points = ''NaN'' WHERE id = %L', question_id), '23514', 'NaN question points');
    PERFORM pg_temp.expect_failure(format('UPDATE "Question" SET "order" = 1 WHERE id = %L', other_question_id), '23505', 'duplicate question order');
    PERFORM pg_temp.expect_failure(format('INSERT INTO "Option" (id, "questionId", text, "order") VALUES (gen_random_uuid(), %L, ''Fifth option'', 5)', question_id), '23514', 'fifth option');
    PERFORM pg_temp.expect_failure(format('UPDATE "Attempt" SET "deadlineAt" = "startedAt" WHERE id = %L', attempt_id), '23514', 'invalid deadline');
    PERFORM pg_temp.expect_failure(format('UPDATE "Attempt" SET "maxScore" = 0 WHERE id = %L', attempt_id), '23514', 'zero max score');
    PERFORM pg_temp.expect_failure(format('UPDATE "Attempt" SET status = ''SUBMITTED'' WHERE id = %L', attempt_id), '23514', 'incomplete submission');
    PERFORM pg_temp.expect_failure(format('UPDATE "Attempt" SET status = ''SUBMITTED'', "submittedAt" = now(), score = -1 WHERE id = %L', attempt_id), '23514', 'negative final score');
    PERFORM pg_temp.expect_failure(format('UPDATE "Attempt" SET status = ''SUBMITTED'', "submittedAt" = now(), score = 10 WHERE id = %L', attempt_id), '23514', 'score above maximum');
    PERFORM pg_temp.expect_failure(format('DELETE FROM "Quiz" WHERE id = %L', quiz_id), '23503', 'deleting attempted quiz');
    PERFORM pg_temp.expect_failure(format('DELETE FROM "Question" WHERE id = %L', question_id), '23503', 'deleting answered question');

    UPDATE "Quiz" SET "negativeMarking" = 'FIXED', "penaltyValue" = 0.5 WHERE id = quiz_id;
    UPDATE "Quiz" SET "negativeMarking" = 'FRACTION', "penaltyValue" = 0.1234 WHERE id = quiz_id;
    UPDATE "Attempt" SET status = 'SUBMITTED', "submittedAt" = now(),
        score = 3.2345 - (1.2345::numeric * 0.1234::numeric) WHERE id = attempt_id;
    IF (SELECT score FROM "Attempt" WHERE id = attempt_id) <> 3.08216270 THEN
        RAISE EXCEPTION 'Fractional score precision lost';
    END IF;
    UPDATE "Attempt" SET status = 'EXPIRED', score = 0 WHERE id = attempt_id;
    RAISE NOTICE 'PASS: fixed/fraction penalties, exact decimal score and zero-score expiry';

    DELETE FROM "Quiz" WHERE id = other_quiz_id;
    IF EXISTS (SELECT 1 FROM "Question" WHERE id = foreign_question_id)
        OR EXISTS (SELECT 1 FROM "Option" WHERE id = foreign_option_id) THEN
        RAISE EXCEPTION 'Unused quiz cascade failed';
    END IF;
    RAISE NOTICE 'PASS: unused quiz deletion cascades';
END;
$$;

ROLLBACK;
