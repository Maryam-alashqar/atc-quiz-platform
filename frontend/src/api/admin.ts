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

export interface Overview {
  serverTime: string
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
  overview: ['admin', 'overview'] as const,
  users: (filters: UserFilters) => ['admin', 'users', filters] as const,
  allUsers: ['admin', 'users'] as const,
}

export function useOverview() {
  return useQuery({
    queryKey: adminKeys.overview,
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
