import { Activity, ArrowRight, BarChart3, ClipboardList, GraduationCap } from 'lucide-react'
import { Link } from 'react-router'
import { useOverview } from '../../api/admin'
import { useCurrentUser } from '../../app/useCurrentUser'
import { Hero } from '../../components/dashboard/Hero'
import {
  ParticipationBar,
  QuizFollowUpList,
  QuizStatusRing,
  RecentSubmissions,
} from '../../components/dashboard/OverviewWidgets'
import { StatCard } from '../../components/dashboard/StatCard'
import { Card, SectionCard } from '../../components/ui/Card'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'

/** A teacher's home: who is keeping up with their quizzes, and who still has to start. */
export function TeacherDashboardPage() {
  const { t } = useI18n()
  const user = useCurrentUser()
  const overview = useOverview(user.id)

  const link = (to: string, label: string) => (
    <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-secondary hover:text-primary">
      {label}
      <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
    </Link>
  )

  return (
    <div className="flex flex-col gap-5">
      <Hero
        name={user.name}
        title={t('teacher.heroTitle')}
        accent={t('teacher.heroAccent')}
        body={t('teacher.heroBody')}
        cta={{ to: '/manage/quizzes/new', label: t('nav.newQuiz') }}
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
              to="/manage/students"
              tone="sky"
              icon={<GraduationCap className="size-7" aria-hidden="true" />}
              label={t('teacher.stat.students')}
              value={overview.data.counts.students}
              hint={t('admin.stat.classes', { n: overview.data.counts.classes })}
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
              to="/manage/students"
              tone="sky"
              icon={<Activity className="size-7" aria-hidden="true" />}
              label={t('admin.stat.participation')}
              value={overview.data.overall.participation === null ? '—' : `${overview.data.overall.participation}%`}
              hint={t('admin.rateDetail', { done: overview.data.overall.completed, expected: overview.data.overall.expected })}
            />
            <StatCard
              to="/manage/quizzes"
              tone="sky"
              icon={<BarChart3 className="size-7" aria-hidden="true" />}
              label={t('dash.stat.average')}
              value={overview.data.overall.averagePercent === null ? '—' : `${overview.data.overall.averagePercent}%`}
              hint={t('teacher.stat.averageHint')}
            />
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
            <div className="flex min-w-0 flex-col gap-5">
              <SectionCard title={t('teacher.followUp')} action={link('/manage/quizzes', t('nav.quizzes'))}>
                <p className="-mt-1 mb-1 text-sm text-muted">{t('teacher.followUpHint')}</p>
                <QuizFollowUpList quizzes={overview.data.quizzes} />
              </SectionCard>
              <SectionCard title={t('admin.byClass')} action={link('/manage/students', t('nav.myStudents'))}>
                {overview.data.classes.length === 0 ? (
                  <EmptyState title={t('teacher.noClasses')}>{t('teacher.noClassesBody')}</EmptyState>
                ) : (
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
                )}
              </SectionCard>
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <SectionCard title={t('admin.quizStatus')}>
                <QuizStatusRing counts={overview.data.counts} />
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
