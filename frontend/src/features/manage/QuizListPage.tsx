import { BarChart3, CalendarDays, FilePlus2, Pencil, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useManagedQuizzes } from '../../api/manage'
import type { QuizStatus, TeacherQuizSummary } from '../../api/types'
import { useCurrentUser } from '../../app/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { formatDateRange } from '../../lib/time'
import { liveState } from './liveState'

const filters: (QuizStatus | undefined)[] = [undefined, 'DRAFT', 'PUBLISHED']

function QuizCard({ quiz, showTeacher }: { quiz: TeacherQuizSummary; showTeacher: boolean }) {
  const { t, locale } = useI18n()
  const state = liveState(quiz)
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Badge tone={state.tone}>{t(state.key)}</Badge>
          <span className="text-xs font-semibold text-muted">{quiz.language === 'AR' ? 'العربية' : 'English'}</span>
        </div>
        <h2 className="truncate text-lg font-semibold text-ink">
          <bdi>{quiz.title}</bdi>
        </h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateRange(quiz.opensAt, quiz.closesAt, locale)}
          </span>
          <span>
            {t('common.questions', { n: quiz.questionCount })} · {t('common.minutes', { n: quiz.durationMinutes })}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-4" aria-hidden="true" />
            {quiz.classes.length ? quiz.classes.map((c) => c.name).join(', ') : t('manage.noClasses')}
          </span>
          {showTeacher && (
            <span>
              {t('manage.by')} <bdi>{quiz.teacher.name}</bdi>
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <ButtonLink to={`/manage/quizzes/${quiz.id}/results`} variant="secondary">
          <BarChart3 className="size-4" aria-hidden="true" />
          {t('manage.results', { n: quiz.attemptCount })}
        </ButtonLink>
        <ButtonLink to={`/manage/quizzes/${quiz.id}/edit`} variant="ghost" aria-label={t('manage.edit')}>
          <Pencil className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('manage.edit')}</span>
        </ButtonLink>
      </div>
    </Card>
  )
}

export function QuizListPage() {
  const { t } = useI18n()
  const user = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const status = filters.find((value) => value && value === params.get('status'))
  const quizzes = useManagedQuizzes(status)
  const isAdmin = user.role === 'ADMIN'

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{t(isAdmin ? 'nav.allQuizzes' : 'nav.quizzes')}</h1>
          <p className="mt-1 text-muted">{t(isAdmin ? 'manage.subtitleAdmin' : 'manage.subtitle')}</p>
        </div>
        {!isAdmin && (
          <ButtonLink to="/manage/quizzes/new">
            <FilePlus2 className="size-4" aria-hidden="true" />
            {t('nav.newQuiz')}
          </ButtonLink>
        )}
      </header>

      <div role="tablist" className="flex gap-1 self-start rounded-full bg-surface p-1 shadow-card">
        {filters.map((value) => (
          <button
            key={value ?? 'all'}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => setParams(value ? { status: value } : {}, { replace: true })}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
              status === value ? 'bg-primary text-white' : 'text-muted hover:text-primary'
            }`}
          >
            {t(value === 'DRAFT' ? 'manage.filter.draft' : value === 'PUBLISHED' ? 'manage.filter.published' : 'manage.filter.all')}
          </button>
        ))}
      </div>

      {quizzes.isPending ? (
        <Spinner />
      ) : quizzes.isError ? (
        <Card>
          <ErrorState error={quizzes.error} onRetry={() => quizzes.refetch()} />
        </Card>
      ) : quizzes.data.items.length === 0 ? (
        <Card>
          <EmptyState title={t('manage.empty')}>
            {!isAdmin && (
              <Link to="/manage/quizzes/new" className="font-semibold text-secondary">
                {t('manage.emptyCta')}
              </Link>
            )}
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {quizzes.data.items.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} showTeacher={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}
