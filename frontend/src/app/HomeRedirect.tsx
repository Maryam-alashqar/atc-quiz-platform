import { Navigate } from 'react-router'
import { useMe } from '../api/auth'
import { homePath } from '../components/layout/navigation'
import { Spinner } from '../components/ui/States'
import { TeacherDashboardPage } from '../features/manage/TeacherDashboardPage'

/** /manage: the teacher's dashboard; the admin has their own at /admin. */
export function ManageHome() {
  const me = useMe()
  if (me.data?.role === 'TEACHER') return <TeacherDashboardPage />
  return <Navigate to={me.data ? homePath(me.data.role) : '/login'} replace />
}

export function HomeRedirect() {
  const me = useMe()
  if (me.isPending) return <Spinner />
  return <Navigate to={me.data ? homePath(me.data.role) : '/login'} replace />
}
