import { Navigate } from 'react-router'
import { useMe } from '../api/auth'
import { homePath } from '../components/layout/navigation'
import { Spinner } from '../components/ui/States'

export function HomeRedirect() {
  const me = useMe()
  if (me.isPending) return <Spinner />
  return <Navigate to={me.data ? homePath(me.data.role) : '/login'} replace />
}
