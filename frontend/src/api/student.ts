import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { syncServerTime } from '../lib/time'
import { api } from './client'
import type { Attempt, HistoryItem, StudentQuiz, StudentQuizDetails, TimedPage } from './types'

// The API caps pages at 100; a class sees far fewer quizzes than that per term.
const ALL = '?page=1&pageSize=100'

async function timed<T extends { serverTime: string }>(request: Promise<T>): Promise<T> {
  const data = await request
  syncServerTime(data.serverTime)
  return data
}

export const studentKeys = {
  all: ['student'] as const,
  available: ['student', 'quizzes', 'available'] as const,
  upcoming: ['student', 'quizzes', 'upcoming'] as const,
  history: ['student', 'history'] as const,
  quiz: (id: string) => ['student', 'quiz', id] as const,
  attempt: (id: string) => ['student', 'attempt', id] as const,
}

export function useAvailableQuizzes() {
  return useQuery({
    queryKey: studentKeys.available,
    queryFn: () => timed(api<TimedPage<StudentQuiz>>('GET', `/student/quizzes${ALL}`)),
  })
}

export function useUpcomingQuizzes() {
  return useQuery({
    queryKey: studentKeys.upcoming,
    queryFn: () => timed(api<TimedPage<StudentQuiz>>('GET', `/student/quizzes/upcoming${ALL}`)),
  })
}

export function useHistory() {
  return useQuery({
    queryKey: studentKeys.history,
    queryFn: () => timed(api<TimedPage<HistoryItem>>('GET', `/student/attempts${ALL}`)),
  })
}

export function useQuizDetails(id: string) {
  return useQuery({
    queryKey: studentKeys.quiz(id),
    queryFn: () => timed(api<StudentQuizDetails>('GET', `/student/quizzes/${id}`)),
  })
}

export function useAttempt(id: string) {
  return useQuery({
    queryKey: studentKeys.attempt(id),
    queryFn: () => timed(api<Attempt>('GET', `/student/attempts/${id}`)),
    // The attempt is the source of truth for answers; don't let a background refetch
    // overwrite a selection the student just made.
    refetchOnWindowFocus: false,
  })
}

export function useStartAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (quizId: string) => timed(api<Attempt>('POST', `/student/quizzes/${quizId}/attempt`)),
    onSuccess: (attempt) => {
      queryClient.setQueryData(studentKeys.attempt(attempt.id), attempt)
      void queryClient.invalidateQueries({ queryKey: studentKeys.all })
    },
  })
}

export function useSubmitAttempt(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => timed(api<Attempt>('POST', `/student/attempts/${id}/submit`)),
    onSuccess: (attempt) => {
      queryClient.setQueryData(studentKeys.attempt(id), attempt)
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'student' && query.queryKey[1] !== 'attempt',
      })
    },
  })
}

/** Plain call (not a hook) so the quiz player can queue and retry saves itself. */
export function saveAnswer(attemptId: string, questionId: string, optionId: string | null) {
  return timed(api<Attempt>('PUT', `/student/attempts/${attemptId}/answers`, { questionId, optionId }))
}
