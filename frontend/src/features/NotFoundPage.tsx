import { homePath } from '../components/layout/navigation'
import { ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useCurrentUser } from '../app/useCurrentUser'
import { useI18n } from '../i18n/context'

export function NotFoundPage() {
  const { t } = useI18n()
  const user = useCurrentUser()
  return (
    <Card className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <p className="font-serif text-5xl font-bold text-secondary">404</p>
      <h1 className="font-serif text-2xl font-semibold">{t('notFound.title')}</h1>
      <p className="text-muted">{t('notFound.body')}</p>
      <ButtonLink to={homePath(user.role)} className="mt-2">
        {t('notFound.home')}
      </ButtonLink>
    </Card>
  )
}
