import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, ApiError } from './client'
import type { User } from './types'

export const meKey = ['auth', 'me'] as const

/** Resolves to the signed-in user, or null when there is no valid session. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return (await api<{ user: User }>('GET', '/auth/me')).user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      api<{ user: User }>('POST', '/auth/login', credentials),
    onSuccess: ({ user }) => switchSession(queryClient, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('POST', '/auth/logout'),
    onSettled: () => switchSession(queryClient, null),
  })
}

/**
 * Store the new session and drop every other cached response (they belong to the previous user).
 * The session query is updated in place, never removed: components are subscribed to it, and a
 * removed query would leave them showing the old user (queryClient.clear() did exactly that).
 */
export function switchSession(queryClient: QueryClient, user: User | null) {
  queryClient.setQueryData(meKey, user)
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] })
}

/** Change one's own password (the current one is required). The session stays signed in. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => api<void>('POST', '/auth/password', body),
  })
}
