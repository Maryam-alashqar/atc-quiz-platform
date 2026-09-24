import { useMe } from '../api/auth'
import type { User } from '../api/types'

/** The signed-in user. Only valid below <RequireAuth>, which guarantees it is loaded. */
export function useCurrentUser(): User {
  const { data } = useMe()
  if (!data) throw new Error('useCurrentUser used outside <RequireAuth>')
  return data
}
