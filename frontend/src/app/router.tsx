import { createBrowserRouter, Outlet } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { NotFoundPage } from '../features/NotFoundPage'
import { AttemptResultPage } from '../features/student/AttemptResultPage'
import { DashboardPage } from '../features/student/DashboardPage'
import { QuizDetailsPage } from '../features/student/QuizDetailsPage'
import { QuizPlayerPage } from '../features/student/QuizPlayerPage'
import { QuizzesPage } from '../features/student/QuizzesPage'
import { ResultsPage } from '../features/student/ResultsPage'
import { RequireAuth, RequireRole } from './guards'
import { HomeRedirect } from './HomeRedirect'

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  // The quiz player is full-screen: no sidebar or tab bar to tap by accident mid-quiz.
  {
    path: '/student/attempts/:id',
    element: (
      <RequireAuth>
        {() => (
          <RequireRole roles={['STUDENT']}>
            <QuizPlayerPage />
          </RequireRole>
        )}
      </RequireAuth>
    ),
  },
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
          { path: 'quizzes/:id', element: <QuizDetailsPage /> },
          { path: 'attempts/:id/result', element: <AttemptResultPage /> },
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
