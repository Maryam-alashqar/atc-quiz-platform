import { ArrowRight, Sun } from 'lucide-react'
import studentHero800 from '../../assets/hero-800.webp'
import studentHero1400 from '../../assets/hero-1400.webp'
import { useI18n } from '../../i18n/context'
import { ammanHour } from '../../lib/time'
import { ButtonLink } from '../ui/Button'
import { Card } from '../ui/Card'

interface HeroProps {
  name: string
  title: string
  accent: string
  body: string
  cta: { to: string; label: string }
  /** Photo pair (800w / 1400w). Defaults to the student desk scene. */
  image?: { small: string; large: string }
}

/** The dashboard banner from the design: greeting, two-tone headline and the Amman photo. */
export function Hero({ name, title, accent, body, cta, image }: HeroProps) {
  const { small, large } = image ?? { small: studentHero800, large: studentHero1400 }
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
          src={large}
          srcSet={`${small} 800w, ${large} 1400w`}
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
          {title}
          <br />
          <span className="text-gold">{accent}</span>
        </h1>
        <p className="max-w-md text-muted sm:text-lg">{body}</p>
        <div>
          <ButtonLink to={cta.to} size="lg">
            {cta.label}
            <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </Card>
  )
}
