import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useMe } from '../api/auth'
import type { Role, User } from '../api/types'
import { useCurrentUser } from './useCurrentUser'
import { homePath } from '../components/layout/navigation'
import { ErrorState, Spinner } from '../components/ui/States'

export function RequireAuth({ children }: { children: (user: User) => ReactNode }) {
  const me = useMe()
  const location = useLocation()
  if (me.isPending) return <Spinner />
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children(me.data)
}

/** Sends users to their own home instead of showing another role's page. The API enforces the same rule. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useCurrentUser()
  if (!roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />
  return children
}
