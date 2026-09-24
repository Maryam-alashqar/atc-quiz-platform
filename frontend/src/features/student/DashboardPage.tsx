import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, ClipboardCheck, FileText, Sun, Target, TimerOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useHistory, useAvailableQuizzes, useUpcomingQuizzes } from '../../api/student'
import type { HistoryItem } from '../../api/types'
import { useCurrentUser } from '../../app/useCurrentUser'
import { ButtonLink } from '../../components/ui/Button'
import { Card, SectionCard } from '../../components/ui/Card'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { ammanHour, formatDate, serverNow } from '../../lib/time'
import hero800 from '../../assets/hero-800.webp'
import hero1400 from '../../assets/hero-1400.webp'
import { QuizRow } from './QuizRow'
import { progressSummary } from './quizState'

function Hero({ name }: { name: string }) {
  const { t } = useI18n()
  const hour = ammanHour()
  const greeting = hour < 12 ? 'dash.greeting.morning' : hour < 17 ? 'dash.greeting.afternoon' : 'dash.greeting.evening'
  const firstName = name.trim().split(/\s+/)[0]
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-surface to-ivory lg:grid lg:min-h-80 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative h-36 sm:h-48 lg:order-2 lg:h-auto">
        {/* Blue wave edge from the design mock, mirrored in RTL. */}
        <div className="absolute inset-0 hidden bg-secondary [clip-path:ellipse(100%_140%_at_100%_50%)] lg:block rtl:[clip-path:ellipse(100%_140%_at_0%_50%)]" />
        <img
          src={hero1400}
          srcSet={`${hero800} 800w, ${hero1400} 1400w`}
          sizes="(min-width: 1024px) 50vw, 100vw"
          alt=""
          className="absolute inset-0 size-full object-cover lg:[clip-path:ellipse(97%_140%_at_100%_50%)] rtl:lg:[clip-path:ellipse(97%_140%_at_0%_50%)]"
        />
      </div>
      <div className="relative flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.25em] text-muted uppercase">
          <Sun className="size-5 text-gold" aria-hidden="true" />
          {t(greeting, { name: firstName })}
        </p>
        <h1 className="font-serif text-4xl leading-[1.05] font-bold text-ink sm:text-5xl xl:text-6xl">
          {t('dash.heroTitle')}
          <br />
          <span className="text-gold">{t('dash.heroAccent')}</span>
        </h1>
        <p className="max-w-md text-muted sm:text-lg">{t('dash.heroBody')}</p>
        <div>
          <ButtonLink to="/student/quizzes" size="lg">
            {t('dash.heroCta')}
            <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </Card>
  )
}

interface StatCardProps {
  icon: ReactNode
  label: string
  value: ReactNode
  hint: string
  to: string
  tone: 'sky' | 'gold'
}

function StatCard({ icon, label, value, hint, to, tone }: StatCardProps) {
  return (
    <Link
      to={to}
      className={`group flex min-w-0 flex-col items-start gap-1 rounded-3xl p-3.5 shadow-card transition-shadow hover:shadow-lift sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${
        tone === 'gold' ? 'bg-gold-soft' : 'bg-sky-soft'
      }`}
    >
      <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-surface text-primary shadow-card sm:grid">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs leading-tight text-muted sm:text-sm">{label}</span>
        <span className="block font-serif text-2xl font-bold text-ink sm:text-3xl">{value}</span>
        <span className="hidden truncate text-sm text-muted sm:block">{hint}</span>
      </span>
      <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-surface text-primary transition-transform sm:grid group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
        <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      </span>
    </Link>
  )
}

function relativeDays(iso: string, locale: 'en' | 'ar') {
  const days = Math.round((Date.parse(iso) - serverNow()) / 86_400_000)
  const hours = Math.round((Date.parse(iso) - serverNow()) / 3_600_000)
  const format = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en', { numeric: 'auto' })
  return Math.abs(hours) < 24 ? format.format(hours, 'hour') : format.format(days, 'day')
}

function RecentActivity({ items }: { items: HistoryItem[] }) {
  const { t, locale } = useI18n()
  if (items.length === 0) return <EmptyState title={t('dash.noActivity')} />
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const finished = item.status !== 'IN_PROGRESS'
        const Icon = item.status === 'EXPIRED' ? TimerOff : finished ? CheckCircle2 : ClipboardCheck
        const key =
          item.status === 'EXPIRED'
            ? 'dash.recent.expired'
            : finished
              ? 'dash.recent.completed'
              : 'dash.recent.inProgress'
        return (
          <li key={item.id}>
            <Link
              to={finished ? `/student/attempts/${item.id}/result` : `/student/attempts/${item.id}`}
              className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-ivory"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-ink">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">
                  {t(key, { title: '' })}
                  <bdi dir="auto">{item.quiz.title}</bdi>
                </span>
                {finished && item.score !== null && (
                  <span className="block text-sm text-muted">
                    {t('dash.recent.score', {
                      score: Number(item.score),
                      max: Number(item.maxScore),
                      percent: Math.round(Number(item.percentage)),
                    })}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">{relativeDays(item.submittedAt ?? item.startedAt, locale)}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function DashboardPage() {
  const { t, locale } = useI18n()
  const user = useCurrentUser()
  const available = useAvailableQuizzes()
  const upcoming = useUpcomingQuizzes()
  const history = useHistory()

  const loading = available.isPending || upcoming.isPending || history.isPending
  const error = available.error ?? upcoming.error ?? history.error
  const retry = () => {
    void available.refetch()
    void upcoming.refetch()
    void history.refetch()
  }

  const open = available.data?.items ?? []
  const later = upcoming.data?.items ?? []
  const past = history.data?.items ?? []
  const summary = progressSummary(open, past)
  // Quizzes to act on first: in progress, then open (soonest deadline first), then upcoming.
  const actionable = [...open].sort((a, b) => Number(!!b.attempt && b.attempt.status === 'IN_PROGRESS') - Number(!!a.attempt && a.attempt.status === 'IN_PROGRESS'))
    .filter((quiz) => !quiz.attempt || quiz.attempt.status === 'IN_PROGRESS')
  const listed = [...actionable.map((quiz) => ({ quiz, upcoming: false })), ...later.map((quiz) => ({ quiz, upcoming: true }))].slice(0, 4)
  const nextDeadline = actionable[0]

  return (
    <div className="flex flex-col gap-5">
      <Hero name={user.name} />

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={retry} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              to="/student/quizzes"
              tone="sky"
              icon={<FileText className="size-7" aria-hidden="true" />}
              label={t('dash.stat.open')}
              value={actionable.length}
              hint={later.length ? t('dash.stat.openHintUpcoming', { n: later.length }) : t('dash.stat.openHint')}
            />
            <StatCard
              to="/student/results"
              tone="gold"
              icon={<BarChart3 className="size-7 text-gold" aria-hidden="true" />}
              label={t('dash.stat.average')}
              value={summary.averagePercent === null ? '—' : `${summary.averagePercent}%`}
              hint={
                summary.averagePercent === null
                  ? t('dash.stat.averageNone')
                  : t('dash.stat.averageHint', { n: summary.completed })
              }
            />
            <StatCard
              to="/student/results"
              tone="sky"
              icon={<CheckCircle2 className="size-7" aria-hidden="true" />}
              label={t('dash.stat.completed')}
              value={summary.completed}
              hint={t('dash.stat.completedHint', { n: summary.notStarted + summary.inProgress })}
            />
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
            <div className="flex min-w-0 flex-col gap-5">
              <SectionCard
                title={t('dash.yourQuizzes')}
                action={
                  <Link to="/student/quizzes" className="flex items-center gap-1 text-sm font-semibold text-secondary hover:text-primary">
                    {t('common.viewAll')}
                    <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                }
              >
                {listed.length === 0 ? (
                  <EmptyState title={t('dash.noQuizzes')}>{t('dash.noQuizzesBody')}</EmptyState>
                ) : (
                  <div className="divide-y divide-line">
                    {listed.map(({ quiz, upcoming: isUpcoming }, index) => (
                      <QuizRow key={quiz.id} quiz={quiz} upcoming={isUpcoming} index={index} />
                    ))}
                  </div>
                )}
              </SectionCard>
              <Card className="relative flex items-center gap-4 overflow-hidden bg-gradient-to-r from-sky-soft to-gold-soft p-5 sm:p-6 rtl:bg-gradient-to-l">
                <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-surface text-primary shadow-card">
                  <CalendarClock className="size-8" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-serif text-2xl font-semibold text-ink">{t('dash.stayTitle')}</h2>
                  <p className="text-muted">
                    {nextDeadline ? (
                      <>
                        {t('dash.stayNext', { date: formatDate(nextDeadline.closesAt, locale) })}{' '}
                        <bdi dir="auto" className="font-semibold text-ink">
                          {nextDeadline.title}
                        </bdi>
                      </>
                    ) : (
                      t('dash.stayBody')
                    )}
                  </p>
                </div>
              </Card>
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <SectionCard title={t('dash.progress')}>
                <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
                  <ProgressRing
                    label={t('dash.overall')}
                    segments={[
                      { value: summary.completed, className: 'stroke-primary' },
                      { value: summary.inProgress, className: 'stroke-gold' },
                      { value: summary.notStarted, className: 'stroke-line' },
                    ]}
                  >
                    <div>
                      <p className="font-serif text-3xl font-bold text-ink">{summary.percent}%</p>
                      <p className="text-xs text-muted">{t('dash.overall')}</p>
                    </div>
                  </ProgressRing>
                  <dl className="flex w-full flex-col gap-3 text-sm">
                    {(
                      [
                        ['progress.completed', summary.completed, 'bg-primary'],
                        ['progress.inProgress', summary.inProgress, 'bg-gold'],
                        ['progress.notStarted', summary.notStarted, 'bg-line'],
                      ] as const
                    ).map(([key, value, dot]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className={`size-3 rounded-full ${dot}`} aria-hidden="true" />
                        <dt className="flex-1 text-muted">{t(key)}</dt>
                        <dd className="font-semibold text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gold-soft/70 p-4">
                  <Target className="size-9 shrink-0 text-gold" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-ink">
                      {summary.completed ? t('dash.cheer.title') : t('dash.cheer.startTitle')}
                    </p>
                    <p className="text-sm text-muted">
                      {summary.completed ? t('dash.cheer.body') : t('dash.cheer.startBody')}
                    </p>
                  </div>
                </div>
              </SectionCard>
              <SectionCard
                title={t('dash.recent')}
                action={
                  <Link to="/student/results" className="flex items-center gap-1 text-sm font-semibold text-secondary hover:text-primary">
                    {t('common.viewAll')}
                    <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                }
              >
                <RecentActivity items={past.slice(0, 3)} />
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
