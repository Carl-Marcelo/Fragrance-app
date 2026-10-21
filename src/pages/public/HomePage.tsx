import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CloudRain,
  Compass,
  Droplets,
  GalleryVerticalEnd,
  Moon,
  PartyPopper,
  SprayCan,
  Sun,
} from 'lucide-react'
import { BRAND_SHELVES } from '../../lib/discover/brands'
import { Link } from 'react-router-dom'
import { FragranceCard } from '../../components/fragrance/FragranceCard'
import { ButtonLink } from '../../components/ui/Button'
import { SectionHeading } from '../../components/ui/PageHeader'
import { CardSkeletons } from '../../components/ui/States'
import { usePublicFragrances } from '../../hooks/queries'
import { SCENARIO_LABELS } from '../../lib/constants'
import type { Scenario } from '../../lib/types'
import { useIsOwner } from '../../providers/AuthProvider'

const SCENARIO_LINKS: { scenario: Scenario; icon: typeof Sun; blurb: string }[] = [
  { scenario: 'hot_day', icon: Sun, blurb: 'Midday commute, 33 °C and sticky' },
  { scenario: 'normal_day', icon: Droplets, blurb: 'Errands, in and out of air-con' },
  { scenario: 'office', icon: Briefcase, blurb: 'Shared space, cold recirculated air' },
  { scenario: 'night_date', icon: Moon, blurb: 'Cooler evening, close range' },
  { scenario: 'special', icon: PartyPopper, blurb: 'Weddings and long formal events' },
]

export function HomePage() {
  const catalog = usePublicFragrances()
  const owner = useIsOwner()
  const recent = catalog.data?.slice(0, 4) ?? []

  return (
    <div className="space-y-20 sm:space-y-24">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="fade-in">
          <p className="eyebrow mb-4">A personal fragrance journal</p>
          <h1 className="text-5xl leading-[1.05] sm:text-6xl">
            Scents worth keeping, and how to wear them in the heat.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
            Browse thousands of designer, niche, Middle Eastern and Indonesian fragrances, and find a sensible spray
            count for Philippine weather: heat, humidity, sudden rain and freezing air-conditioning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/discover" icon={<Compass />}>
              Discover fragrances
            </ButtonLink>
            <ButtonLink to="/spray-guide" variant="secondary" icon={<SprayCan />}>
              Open the spray guide
            </ButtonLink>
            {owner && (
              <ButtonLink to="/app" variant="ghost">
                My journal <ArrowRight />
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="card p-2 sm:p-3">
          <p className="eyebrow px-3 pt-3 pb-2">What’s the plan today?</p>
          <ul>
            {SCENARIO_LINKS.map(({ scenario, icon: Icon, blurb }) => (
              <li key={scenario}>
                <Link
                  to={`/spray-guide?scenario=${scenario}`}
                  className="group flex items-center gap-4 rounded-md px-3 py-3 transition-colors hover:bg-sunken"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{SCENARIO_LABELS[scenario]}</span>
                    <span className="block truncate text-xs text-ink-3">{blurb}</span>
                  </span>
                  <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="houses-heading">
        <SectionHeading id="houses-heading" title="Browse by house" action={<Link to="/discover" className="link">Search everything</Link>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BRAND_SHELVES.map((s) => (
            <Link
              key={s.id}
              to={`/discover?shelf=${s.id}`}
              className="card group p-5 transition-colors hover:border-line-strong"
            >
              <p className="font-display text-2xl text-ink">{s.label}</p>
              <p className="mt-1 line-clamp-2 text-sm text-ink-2">{s.brands.slice(0, 4).join(', ')}…</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-accent">
                Explore <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-heading">
        <SectionHeading
          id="recent-heading"
          title="Recently added to the catalog"
          action={
            recent.length > 0 && (
              <Link to="/catalog" className="link">
                View all
              </Link>
            )
          }
        />
        {catalog.isPending ? (
          <CardSkeletons count={4} />
        ) : recent.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((f) => (
              <FragranceCard key={f.id} fragrance={f} to={`/fragrance/${f.id}`} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-2">
            {catalog.isError
              ? 'The catalog can’t be reached right now. The spray guide and fragrance guides still work offline.'
              : 'The public catalog is still being curated. In the meantime, the spray guide works for any perfume.'}
          </p>
        )}
      </section>

      <section className="grid gap-8 border-t border-line pt-12 sm:grid-cols-3">
        {[
          {
            icon: GalleryVerticalEnd,
            title: 'Curated catalog',
            body: 'Fragrances from this journal, with notes, character, performance and a clear mark on what has been verified.',
            to: '/catalog',
            cta: 'Browse the catalog',
          },
          {
            icon: CloudRain,
            title: 'Spray guide for PH weather',
            body: 'Spray counts, placement and technique for hot days, the office, date nights and special events.',
            to: '/spray-guide',
            cta: 'Find your spray count',
          },
          {
            icon: BookOpen,
            title: 'Fragrance basics',
            body: 'Concentrations, the note pyramid, performance terms and keeping bottles safe in tropical heat.',
            to: '/guides',
            cta: 'Read the guides',
          },
        ].map(({ icon: Icon, title, body, to, cta }) => (
          <div key={title}>
            <Icon className="size-5 text-accent" aria-hidden />
            <h2 className="mt-3 text-2xl">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            <Link to={to} className="link mt-3 inline-block text-sm">
              {cta}
            </Link>
          </div>
        ))}
      </section>
    </div>
  )
}
