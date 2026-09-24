import { createBrowserRouter, Navigate } from 'react-router'
import { useMe } from '../api/auth'
import { AppShell } from '../components/layout/AppShell'
import { homePath } from '../components/layout/navigation'
import { Spinner } from '../components/ui/States'
import { LoginPage } from '../features/auth/LoginPage'
import { NotFoundPage } from '../features/NotFoundPage'
import { RequireAuth, RequireRole } from './guards'

function HomeRedirect() {
  const me = useMe()
  if (me.isPending) return <Spinner />
  return <Navigate to={me.data ? homePath(me.data.role) : '/login'} replace />
}

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth>{(user) => <AppShell user={user} />}</RequireAuth>,
    children: [
      {
        path: 'student',
        element: (
          <RequireRole roles={['STUDENT']}>
            <p className="py-10 text-center text-muted">Student area</p>
          </RequireRole>
        ),
      },
      {
        path: 'manage/*',
        element: (
          <RequireRole roles={['TEACHER', 'ADMIN']}>
            <p className="py-10 text-center text-muted">Quiz management</p>
          </RequireRole>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
