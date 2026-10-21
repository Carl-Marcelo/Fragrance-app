import { ArrowLeft, Bookmark, EyeOff, GalleryVerticalEnd, Pencil, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FragranceMeta } from '../../components/fragrance/FragranceBits'
import { FragranceCard } from '../../components/fragrance/FragranceCard'
import { FragranceImage } from '../../components/fragrance/FragranceImage'
import { FragranceProfile, ProfileSection } from '../../components/fragrance/FragranceProfile'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState, ErrorState, LoadingBlock } from '../../components/ui/States'
import { useAddToCollection, useEntries, useFragrance, usePublicFragrances, useSettings } from '../../hooks/queries'
import { statusLabel } from '../../lib/constants'
import { blankItem } from '../../lib/defaults'
import { errorMessage } from '../../lib/format'
import { mostSimilar } from '../../lib/similarity'
import type { CollectionStatus } from '../../lib/types'
import { useIsOwner } from '../../providers/AuthProvider'
import { useToast } from '../../providers/ToastProvider'

export default function FragrancePage() {
  const { id } = useParams()
  const fragrance = useFragrance(id)
  const catalog = usePublicFragrances()
  const owner = useIsOwner()
  const entries = useEntries()
  const { settings } = useSettings()
  const add = useAddToCollection()
  const toast = useToast()
  const navigate = useNavigate()

  const f = fragrance.data
  const entry = owner ? entries.data?.find((e) => e.fragrance_id === id) : undefined
  const similar = useMemo(() => (f ? mostSimilar(f, catalog.data ?? [], 3, 0.2) : []), [f, catalog.data])

  if (fragrance.isPending) return <LoadingBlock label="Loading fragrance" />
  if (fragrance.isError) return <ErrorState error={fragrance.error} onRetry={() => fragrance.refetch()} />
  if (!f) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Fragrance not found"
        description="It may have been removed or isn’t public."
        action={
          <ButtonLink to="/catalog" variant="secondary">
            Back to the catalog
          </ButtonLink>
        }
      />
    )
  }

  const addAs = async (status: CollectionStatus) => {
    try {
      const created = await add.mutateAsync({ fragranceId: f.id, item: blankItem(status, settings.currency) })
      toast.success(status === 'wishlist' ? 'Added to your wishlist' : 'Added to your collection')
      navigate(`/app/perfume/${created.id}/edit`)
    } catch (e) {
      toast.error('Couldn’t add it', errorMessage(e))
    }
  }

  return (
    <article className="space-y-12">
      <Link to="/catalog" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Catalog
      </Link>

      <header className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-12">
        <FragranceImage fragrance={f} sizes="hero" className="card aspect-[4/5]" />
        <div className="flex flex-col justify-center">
          <p className="eyebrow">{f.brand}</p>
          <h1 className="mt-2 text-5xl leading-[1.05]">{f.name}</h1>
          <FragranceMeta fragrance={f} className="mt-3 text-sm" />
          {!f.is_public && (
            <div className="mt-3">
              <Badge tone="warning">
                <EyeOff /> Private: only you can see this page
              </Badge>
            </div>
          )}
          {f.description && <p className="mt-6 max-w-prose text-[0.9375rem] leading-relaxed text-ink-2">{f.description}</p>}

          {owner && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {entry ? (
                <>
                  <ButtonLink to={`/app/perfume/${entry.id}`} icon={<GalleryVerticalEnd />}>
                    Open in my journal
                  </ButtonLink>
                  <span className="text-sm text-ink-3">{statusLabel(entry.status)}</span>
                </>
              ) : (
                <>
                  <Button onClick={() => addAs('owned')} loading={add.isPending} icon={<GalleryVerticalEnd />}>
                    I own this
                  </Button>
                  <Button variant="secondary" onClick={() => addAs('wishlist')} disabled={add.isPending} icon={<Bookmark />}>
                    Add to wishlist
                  </Button>
                </>
              )}
              <ButtonLink to={`/app/library/${f.id}/edit`} variant="ghost" icon={<Pencil />}>
                Edit details
              </ButtonLink>
            </div>
          )}
        </div>
      </header>

      <FragranceProfile fragrance={f} showLookup={owner} />

      {similar.length > 0 && (
        <ProfileSection title="Similar in the catalog">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map(({ target, score }) => (
              <FragranceCard
                key={target.id}
                fragrance={target}
                to={`/fragrance/${target.id}`}
                footer={<span className="text-xs text-ink-3">{Math.round(score * 100)}% similar by notes and accords</span>}
              />
            ))}
          </div>
        </ProfileSection>
      )}
    </article>
  )
}
