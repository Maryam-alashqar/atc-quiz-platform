import { createBrowserRouter, Outlet } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { AdminDashboardPage } from '../features/admin/AdminDashboardPage'
import { UsersPage } from '../features/admin/UsersPage'
import { LoginPage } from '../features/auth/LoginPage'
import { MyStudentsPage } from '../features/manage/MyStudentsPage'
import { QuizEditorPage } from '../features/manage/QuizEditorPage'
import { QuizListPage } from '../features/manage/QuizListPage'
import { QuizResultsPage } from '../features/manage/QuizResultsPage'
import { NotFoundPage } from '../features/NotFoundPage'
import { AttemptResultPage } from '../features/student/AttemptResultPage'
import { DashboardPage } from '../features/student/DashboardPage'
import { QuizDetailsPage } from '../features/student/QuizDetailsPage'
import { QuizPlayerPage } from '../features/student/QuizPlayerPage'
import { QuizzesPage } from '../features/student/QuizzesPage'
import { ResultsPage } from '../features/student/ResultsPage'
import { RequireAuth, RequireRole } from './guards'
import { HomeRedirect, ManageHome } from './HomeRedirect'
import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      {
        path: '/login',
        element: <LoginPage />,
        handle: { title: 'auth.submit' },
      },
      // The quiz player is full-screen: no sidebar or tab bar to tap by accident mid-quiz.
      {
        path: '/student/attempts/:id',
        handle: { title: 'title.quiz' },
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
              {
                index: true,
                element: <DashboardPage />,
                handle: { title: 'nav.home' },
              },
              {
                path: 'quizzes',
                element: <QuizzesPage />,
                handle: { title: 'nav.myQuizzes' },
              },
              {
                path: 'quizzes/:id',
                element: <QuizDetailsPage />,
                handle: { title: 'title.quiz' },
              },
              {
                path: 'attempts/:id/result',
                element: <AttemptResultPage />,
                handle: { title: 'title.result' },
              },
              {
                path: 'results',
                element: <ResultsPage />,
                handle: { title: 'nav.results' },
              },
            ],
          },
          {
            path: 'manage',
            element: (
              <RequireRole roles={['TEACHER', 'ADMIN']}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              {
                index: true,
                element: <ManageHome />,
                handle: { title: 'nav.home' },
              },
              {
                path: 'students',
                element: <MyStudentsPage />,
                handle: { title: 'nav.myStudents' },
              },
              {
                path: 'quizzes',
                element: <QuizListPage />,
                handle: { title: 'nav.quizzes' },
              },
              {
                path: 'quizzes/new',
                element: <QuizEditorPage />,
                handle: { title: 'nav.newQuiz' },
              },
              {
                path: 'quizzes/:id/edit',
                element: <QuizEditorPage />,
                handle: { title: 'editor.editTitle' },
              },
              {
                path: 'quizzes/:id/results',
                element: <QuizResultsPage />,
                handle: { title: 'results.teacherTitle' },
              },
            ],
          },
          {
            path: 'admin',
            element: (
              <RequireRole roles={['ADMIN']}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              {
                index: true,
                element: <AdminDashboardPage />,
                handle: { title: 'nav.home' },
              },
              {
                path: 'users',
                element: <UsersPage />,
                handle: { title: 'nav.users' },
              },
            ],
          },
          {
            path: '*',
            element: <NotFoundPage />,
            handle: { title: 'notFound.title' },
          },
        ],
      },
    ],
  },
])
