import { createBrowserRouter, Outlet } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { NotFoundPage } from '../features/NotFoundPage'
import { DashboardPage } from '../features/student/DashboardPage'
import { QuizzesPage } from '../features/student/QuizzesPage'
import { ResultsPage } from '../features/student/ResultsPage'
import { RequireAuth, RequireRole } from './guards'
import { HomeRedirect } from './HomeRedirect'

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
            <Outlet />
          </RequireRole>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'quizzes', element: <QuizzesPage /> },
          { path: 'results', element: <ResultsPage /> },
        ],
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
