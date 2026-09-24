import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
    onSuccess: ({ user }) => {
      // Drop anything cached for a previous user before storing the new session.
      queryClient.clear()
      queryClient.setQueryData(meKey, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('POST', '/auth/logout'),
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(meKey, null)
    },
  })
}
