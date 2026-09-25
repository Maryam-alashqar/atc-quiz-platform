import { Activity, ArrowRight, CheckCircle2, ClipboardList, GraduationCap, TimerOff, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useOverview, type Overview, type Rate } from '../../api/admin'
import { useCurrentUser } from '../../app/useCurrentUser'
import adminHero800 from '../../assets/admin-hero-800.webp'
import adminHero1400 from '../../assets/admin-hero-1400.webp'
import { Hero } from '../../components/dashboard/Hero'
import { StatCard } from '../../components/dashboard/StatCard'
import { Card, SectionCard } from '../../components/ui/Card'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { formatDateTime } from '../../lib/time'

/** One labelled bar: how many of the expected attempts were completed, plus the average score. */
function ParticipationBar({ label, sub, rate }: { label: string; sub: string; rate: Rate }) {
  const { t } = useI18n()
  const value = rate.participation ?? 0
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-semibold text-ink">
          <bdi>{label}</bdi>
        </span>
        <span className="shrink-0 font-serif text-lg font-bold text-ink">
          {rate.participation === null ? '—' : `${rate.participation}%`}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-ivory"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {sub}
        {' · '}
        {rate.expected
          ? t('admin.rateDetail', { done: rate.completed, expected: rate.expected })
          : t('admin.nothingYet')}
        {rate.averagePercent !== null && ` · ${t('admin.avgScore', { n: rate.averagePercent })}`}
      </p>
    </div>
  )
}

function QuizStatus({ counts }: { counts: Overview['counts'] }) {
  const { t } = useI18n()
  const rows = [
    ['manage.state.live', counts.liveQuizzes, 'stroke-success', 'bg-success'],
    ['manage.state.scheduled', counts.scheduledQuizzes, 'stroke-gold', 'bg-gold'],
    ['manage.state.closed', counts.closedQuizzes, 'stroke-secondary', 'bg-secondary'],
    ['manage.state.draft', counts.draftQuizzes, 'stroke-line', 'bg-line'],
  ] as const
  const total = rows.reduce((sum, [, value]) => sum + value, 0)
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
      <ProgressRing label={t('admin.quizStatus')} segments={rows.map(([, value, stroke]) => ({ value, className: stroke }))}>
        <div>
          <p className="font-serif text-3xl font-bold text-ink">{total}</p>
          <p className="text-xs text-muted">{t('admin.quizzesTotal')}</p>
        </div>
      </ProgressRing>
      <dl className="flex w-full flex-col gap-3 text-sm">
        {rows.map(([key, value, , dot]) => (
          <div key={key} className="flex items-center gap-3">
            <span className={`size-3 rounded-full ${dot}`} aria-hidden="true" />
            <dt className="flex-1 text-muted">{t(key)}</dt>
            <dd className="font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function RecentSubmissions({ items }: { items: Overview['recent'] }) {
  const { t, locale } = useI18n()
  if (items.length === 0) return <EmptyState title={t('dash.noActivity')} />
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const Icon = item.status === 'EXPIRED' ? TimerOff : CheckCircle2
        return (
          <li key={item.id}>
            <Link
              to={`/manage/quizzes/${item.quiz.id}/results`}
              className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-ivory"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-ink">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  <bdi>{item.student.name}</bdi>
                  {item.student.className && <span className="font-normal text-muted"> · {item.student.className}</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  <bdi>{item.quiz.title}</bdi> · {formatDateTime(item.submittedAt, locale)}
                </span>
              </span>
              <span className="shrink-0 font-serif text-lg font-bold text-ink">{Math.round(Number(item.percentage))}%</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function AdminDashboardPage() {
  const { t } = useI18n()
  const user = useCurrentUser()
  const overview = useOverview()

  const viewResults = (
    <Link to="/manage/quizzes" className="flex items-center gap-1 text-sm font-semibold text-secondary hover:text-primary">
      {t('nav.allQuizzes')}
      <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
    </Link>
  )

  return (
    <div className="flex flex-col gap-5">
      <Hero
        name={user.name}
        title={t('admin.heroTitle')}
        accent={t('admin.heroAccent')}
        body={t('admin.heroBody')}
        cta={{ to: '/admin/users', label: t('admin.heroCta') }}
        image={{ small: adminHero800, large: adminHero1400 }}
      />

      {overview.isPending ? (
        <Spinner />
      ) : overview.isError ? (
        <Card>
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              to="/admin/users"
              tone="sky"
              icon={<GraduationCap className="size-7" aria-hidden="true" />}
              label={t('admin.stat.students')}
              value={overview.data.counts.students}
              hint={t('admin.stat.classes', { n: overview.data.counts.classes })}
            />
            <StatCard
              to="/admin/users?role=TEACHER"
              tone="sky"
              icon={<Users className="size-7" aria-hidden="true" />}
              label={t('admin.stat.teachers')}
              value={overview.data.counts.teachers}
              hint={t('admin.stat.teachersHint')}
            />
            <StatCard
              to="/manage/quizzes"
              tone="gold"
              icon={<ClipboardList className="size-7 text-gold" aria-hidden="true" />}
              label={t('admin.stat.live')}
              value={overview.data.counts.liveQuizzes}
              hint={t('admin.stat.liveHint', { n: overview.data.counts.scheduledQuizzes })}
            />
            <StatCard
              to="/manage/quizzes"
              tone="sky"
              icon={<Activity className="size-7" aria-hidden="true" />}
              label={t('admin.stat.participation')}
              value={overview.data.overall.participation === null ? '—' : `${overview.data.overall.participation}%`}
              hint={
                overview.data.overall.averagePercent === null
                  ? t('admin.nothingYet')
                  : t('admin.avgScore', { n: overview.data.overall.averagePercent })
              }
            />
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
            <div className="flex min-w-0 flex-col gap-5">
              <SectionCard title={t('admin.byClass')}>
                <p className="-mt-1 mb-4 text-sm text-muted">{t('admin.byClassHint')}</p>
                <div className="flex flex-col gap-5">
                  {overview.data.classes.map((c) => (
                    <ParticipationBar
                      key={c.id}
                      label={c.name}
                      sub={t('admin.classSub', { students: c.students, quizzes: c.quizzes })}
                      rate={c}
                    />
                  ))}
                </div>
              </SectionCard>
              <SectionCard title={t('admin.byTeacher')} action={viewResults}>
                {overview.data.teachers.length === 0 ? (
                  <EmptyState title={t('admin.noTeachers')} />
                ) : (
                  <div className="flex flex-col gap-5">
                    {overview.data.teachers.map((teacher) => (
                      <ParticipationBar
                        key={teacher.id}
                        label={teacher.name}
                        sub={t('admin.teacherSub', { quizzes: teacher.quizzes })}
                        rate={teacher}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <SectionCard title={t('admin.quizStatus')}>
                <QuizStatus counts={overview.data.counts} />
              </SectionCard>
              <SectionCard title={t('admin.recent')}>
                <RecentSubmissions items={overview.data.recent} />
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
