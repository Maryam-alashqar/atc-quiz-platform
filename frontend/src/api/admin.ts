import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { syncServerTime } from '../lib/time'
import { api } from './client'
import type { AttemptStatus, ClassRoom, Page } from './types'

export type ManagedRole = 'STUDENT' | 'TEACHER'

export interface ManagedUser {
  id: string
  username: string
  name: string
  role: ManagedRole
  class: ClassRoom | null
  createdAt: string
  attemptCount: number
  quizCount: number
}

export interface Rate {
  completed: number
  expected: number
  participation: number | null
  averagePercent: number | null
}

export interface QuizFollowUp {
  id: string
  title: string
  closesAt: string
  open: boolean
  audience: 'CLASSES' | 'STUDENTS'
  expected: number
  completed: number
  inProgress: number
  notStarted: number
  averagePercent: number | null
}

/** The admin gets the whole centre; a teacher gets the same shape for their own quizzes. */
export interface Overview {
  serverTime: string
  scope: 'CENTRE' | 'TEACHER'
  counts: {
    students: number
    teachers: number
    classes: number
    liveQuizzes: number
    scheduledQuizzes: number
    closedQuizzes: number
    draftQuizzes: number
  }
  overall: Rate
  classes: (Rate & { id: string; name: string; students: number; quizzes: number })[]
  teachers: (Rate & { id: string; name: string; username: string; quizzes: number })[]
  quizzes: QuizFollowUp[]
  recent: {
    id: string
    status: AttemptStatus
    submittedAt: string
    score: string
    maxScore: string
    percentage: string
    quiz: { id: string; title: string }
    student: { name: string; className: string | null }
  }[]
}

export interface UserFilters {
  role: ManagedRole
  classId?: string
  search?: string
  page: number
}

export const adminKeys = {
  // Keyed by user so a teacher and the admin never share a cached overview.
  overview: (userId: string) => ['admin', 'overview', userId] as const,
  users: (filters: UserFilters) => ['admin', 'users', filters] as const,
  allUsers: ['admin', 'users'] as const,
}

export function useOverview(userId: string) {
  return useQuery({
    queryKey: adminKeys.overview(userId),
    queryFn: async () => {
      const data = await api<Overview>('GET', '/overview')
      syncServerTime(data.serverTime)
      return data
    },
  })
}

export function useUsers(filters: UserFilters, pageSize = 25) {
  const params = new URLSearchParams({ role: filters.role, page: String(filters.page), pageSize: String(pageSize) })
  if (filters.classId) params.set('classId', filters.classId)
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  return useQuery({
    queryKey: [...adminKeys.users(filters), pageSize],
    queryFn: () => api<Page<ManagedUser>>('GET', `/users?${params}`),
    placeholderData: keepPreviousData,
  })
}

/** All teachers, for choosing a quiz owner. A centre has a handful of teachers. */
export function useTeachers(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'teachers'],
    queryFn: () => api<Page<ManagedUser>>('GET', '/users?role=TEACHER&pageSize=100'),
    enabled,
  })
}

export interface NewUser {
  username: string
  name: string
  role: ManagedRole
  classId?: string
  password: string
}

function useUserMutation<T, R>(fn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useCreateUser() {
  return useUserMutation((input: NewUser) => api<ManagedUser>('POST', '/users', input))
}

export function useUpdateUser() {
  return useUserMutation(({ id, ...input }: { id: string; name?: string; classId?: string }) =>
    api<ManagedUser>('PATCH', `/users/${id}`, input),
  )
}

export function useResetPassword() {
  return useUserMutation(({ id, password }: { id: string; password: string }) =>
    api<void>('POST', `/users/${id}/password`, { password }),
  )
}

export interface ImportSummary {
  classesCreated: number
  usersCreated: number
  quizzesCreated: number
  questionsCreated: number
  optionsCreated: number
  classesSkipped: number
  usersSkipped: number
  quizzesSkipped: number
}

export interface ImportResult {
  preview: boolean
  source: 'xlsx' | 'csv'
  summary: ImportSummary
}

/** Check (preview) or import one workbook or the four CSV files. */
export function useImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ files, preview }: { files: File[]; preview: boolean }) => {
      const form = new FormData()
      for (const file of files) form.append('files', file)
      return api<ImportResult>('POST', `/import${preview ? '?preview=true' : ''}`, form)
    },
    onSuccess: (result) => {
      // New classes, people and quizzes show up everywhere.
      if (!result.preview) void queryClient.invalidateQueries()
    },
  })
}
