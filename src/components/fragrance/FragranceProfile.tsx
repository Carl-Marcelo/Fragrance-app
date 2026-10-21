import type { ReactNode } from 'react'
import type { Fragrance, Scenario, SprayOverrides, SprayProfile } from '../../lib/types'
import { SprayGuidePanel } from '../spray/SprayGuidePanel'
import {
  AccordList,
  CharacterScales,
  EstimateBadge,
  InfoStatusBadge,
  LookupLinks,
  NotesPyramid,
  SourceLinks,
  SuitabilityTable,
} from './FragranceBits'

export function ProfileSection({
  title,
  aside,
  children,
  id,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className="border-t border-line pt-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id={id ? `${id}-title` : undefined} className="text-[1.75rem]">
          {title}
        </h2>
        {aside && <div className="flex flex-wrap items-center gap-2 text-sm">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

/** Reference sections shared by the public fragrance page and the private perfume page. */
export function FragranceProfile({
  fragrance,
  sprayProfile,
  sprayOverrides,
  onCustomizeSpray,
  showLookup,
  sprayFirst,
}: {
  fragrance: Fragrance
  sprayProfile?: SprayProfile
  sprayOverrides?: SprayOverrides
  onCustomizeSpray?: (scenario: Scenario) => void
  showLookup?: boolean
  sprayFirst?: boolean
}) {
  const spray = (
    <ProfileSection
      id="spray"
      title="Spray guide for Philippine weather"
      aside={<span className="text-xs text-ink-3">Works offline · practical estimates</span>}
    >
      <SprayGuidePanel
        input={fragrance}
        profile={sprayProfile}
        overrides={sprayOverrides}
        onCustomize={onCustomizeSpray}
      />
    </ProfileSection>
  )

  return (
    <div className="space-y-10">
      {sprayFirst && spray}

      <div className="grid gap-10 lg:grid-cols-2">
        <ProfileSection id="notes" title="Notes" aside={<InfoStatusBadge status={fragrance.info_status} />}>
          <NotesPyramid fragrance={fragrance} />
          <div className="mt-6">
            <p className="eyebrow mb-2">Main accords</p>
            <AccordList accords={fragrance.accords} />
          </div>
          {fragrance.perfumers.length > 0 && (
            <p className="mt-6 text-sm text-ink-2">
              <span className="eyebrow mr-2">Perfumer{fragrance.perfumers.length > 1 ? 's' : ''}</span>
              {fragrance.perfumers.join(', ')}
            </p>
          )}
        </ProfileSection>

        <ProfileSection id="character" title="Character & performance" aside={<EstimateBadge basis={fragrance.ratings_basis} />}>
          <CharacterScales fragrance={fragrance} />
          <p className="mt-5 text-xs text-ink-3">
            These are subjective ratings, not measurements. Performance varies with skin, climate and batch.
          </p>
        </ProfileSection>
      </div>

      <ProfileSection id="suitability" title="When it works" aside={<EstimateBadge basis={fragrance.ratings_basis} />}>
        <SuitabilityTable fragrance={fragrance} />
      </ProfileSection>

      {!sprayFirst && spray}

      <ProfileSection id="sources" title="Sources" aside={<InfoStatusBadge status={fragrance.info_status} />}>
        <SourceLinks fragrance={fragrance} />
        {fragrance.image_credit && <p className="mt-3 text-xs text-ink-3">Image: {fragrance.image_credit}</p>}
        {showLookup && (
          <div className="mt-4">
            <LookupLinks name={fragrance.name} brand={fragrance.brand} />
          </div>
        )}
      </ProfileSection>
    </div>
  )
}
