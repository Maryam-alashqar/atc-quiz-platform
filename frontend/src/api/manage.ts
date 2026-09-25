import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  ClassRoom,
  Page,
  QuizInput,
  QuizResults,
  QuizRoster,
  QuizStatus,
  StudentProgressRow,
  StudentRef,
  TeacherQuizDetail,
  TeacherQuizSummary,
} from './types'

export const manageKeys = {
  all: ['manage'] as const,
  list: (status?: QuizStatus) => ['manage', 'quizzes', status ?? 'ALL'] as const,
  quiz: (id: string) => ['manage', 'quiz', id] as const,
  results: (id: string, page: number) => ['manage', 'results', id, page] as const,
  classes: ['manage', 'classes'] as const,
}

export function useManagedQuizzes(status?: QuizStatus) {
  const query = status ? `&status=${status}` : ''
  return useQuery({
    queryKey: manageKeys.list(status),
    queryFn: () => api<Page<TeacherQuizSummary>>('GET', `/quizzes?page=1&pageSize=100${query}`),
  })
}

export function useManagedQuiz(id: string | undefined) {
  return useQuery({
    queryKey: manageKeys.quiz(id ?? ''),
    queryFn: () => api<TeacherQuizDetail>('GET', `/quizzes/${id}`),
    enabled: Boolean(id),
    // An open editor must not be overwritten by a background refetch.
    refetchOnWindowFocus: false,
  })
}

export function useClasses() {
  return useQuery({
    queryKey: manageKeys.classes,
    queryFn: () => api<ClassRoom[]>('GET', '/classes'),
    staleTime: Infinity,
  })
}

export function useSaveQuiz(id: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuizInput) =>
      id ? api<TeacherQuizDetail>('PATCH', `/quizzes/${id}`, input) : api<TeacherQuizDetail>('POST', '/quizzes', input),
    onSuccess: (quiz) => {
      queryClient.setQueryData(manageKeys.quiz(quiz.id), quiz)
      void queryClient.invalidateQueries({ queryKey: ['manage', 'quizzes'] })
    },
  })
}

export function usePublishQuiz() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<TeacherQuizDetail>('POST', `/quizzes/${id}/publish`),
    onSuccess: (quiz) => {
      queryClient.setQueryData(manageKeys.quiz(quiz.id), quiz)
      void queryClient.invalidateQueries({ queryKey: ['manage', 'quizzes'] })
    },
  })
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/quizzes/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: manageKeys.all }),
  })
}

export function useQuizResults(id: string, page: number) {
  return useQuery({
    queryKey: manageKeys.results(id, page),
    queryFn: () => api<QuizResults>('GET', `/quizzes/${id}/results?page=${page}&pageSize=50`),
    placeholderData: keepPreviousData,
  })
}

export const resultsExportUrl = (id: string) => `/api/quizzes/${id}/results/export`

/** Every student the quiz is meant for, with their attempt or none (who has not started). */
export function useQuizRoster(id: string) {
  return useQuery({
    queryKey: ['manage', 'roster', id],
    queryFn: () => api<QuizRoster>('GET', `/quizzes/${id}/results/students`),
  })
}

/** A teacher's students (their classes plus anyone they named) with progress on their quizzes. */
export function useMyStudents() {
  return useQuery({
    queryKey: ['manage', 'my-students'],
    queryFn: () => api<{ serverTime: string; items: StudentProgressRow[] }>('GET', '/overview/students'),
  })
}

/** Read-only lookup used to name students on a quiz. */
export function useStudentSearch(search: string, classId: string, enabled: boolean) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (classId) params.set('classId', classId)
  return useQuery({
    queryKey: ['manage', 'student-search', search.trim(), classId],
    queryFn: () => api<{ items: StudentRef[] }>('GET', `/students?${params}`),
    enabled,
    placeholderData: keepPreviousData,
  })
}
