import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { meKey } from '../api/auth'

// A 401 anywhere means the session expired: clear the user so the router sends them to login.
function onError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(meKey, null)
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
  },
})
