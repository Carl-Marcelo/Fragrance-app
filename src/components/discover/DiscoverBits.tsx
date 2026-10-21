import { Bookmark, Check, GalleryVerticalEnd } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAddDiscovered, useJournalMatch } from '../../hooks/discover'
import { cn } from '../../lib/cn'
import type { DiscoveredFragrance } from '../../lib/discover/types'
import { errorMessage } from '../../lib/format'
import type { CollectionStatus } from '../../lib/types'
import { useIsOwner } from '../../providers/AuthProvider'
import { useToast } from '../../providers/ToastProvider'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { FragranceImage } from '../fragrance/FragranceImage'

/** Base path for discovery links, so the page works inside the public site and the journal. */
export function useDiscoverBase() {
  const { pathname } = useLocation()
  return pathname.startsWith('/app') ? '/app/discover' : '/discover'
}

export function discoverHref(base: string, d: DiscoveredFragrance) {
  return `${base}/${encodeURIComponent(d.ref)}?q=${encodeURIComponent(`${d.brand} ${d.name}`)}`
}

const GENDER_LABEL = { men: 'For men', women: 'For women', unisex: 'Unisex' } as const

const WHERE: Record<CollectionStatus, string> = {
  owned: 'In your collection',
  wishlist: 'On your wishlist',
  previously_owned: 'Previously owned',
}

export function discoverMeta(d: DiscoveredFragrance) {
  return [d.concentrationLabel, d.year, d.gender ? GENDER_LABEL[d.gender] : null].filter(Boolean).join(' · ')
}

/** Owner-only add buttons. Shows where the fragrance already lives instead, if it does. */
export function AddToJournal({ d, compact }: { d: DiscoveredFragrance; compact?: boolean }) {
  const owner = useIsOwner()
  const { entry } = useJournalMatch(d)
  const add = useAddDiscovered()
  const toast = useToast()
  const navigate = useNavigate()

  if (!owner) return null

  if (entry) {
    return (
      <Link
        to={`/app/perfume/${entry.id}`}
        className={cn('inline-flex items-center gap-1.5 text-sm text-accent hover:underline', compact && 'text-xs')}
      >
        <Check className="size-4" aria-hidden /> {WHERE[entry.status]}
      </Link>
    )
  }

  const addAs = (status: CollectionStatus) =>
    add.mutate(
      { d, status },
      {
        onSuccess: (created) =>
          toast.success(
            status === 'wishlist' ? `${d.name} added to your wishlist` : `${d.name} added to your collection`,
            status === 'wishlist' ? 'Note why you want it whenever you like.' : 'Add the price, size and date when you can.',
            { label: 'Add details', onClick: () => navigate(`/app/perfume/${created.id}/edit`) },
          ),
        onError: (e) => toast.error('Couldn’t add it', errorMessage(e)),
      },
    )

  return (
    <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
      <Button
        size="sm"
        variant={compact ? 'secondary' : 'primary'}
        onClick={() => addAs('owned')}
        disabled={add.isPending}
        icon={<GalleryVerticalEnd />}
      >
        I own this
      </Button>
      <Button size="sm" variant="secondary" onClick={() => addAs('wishlist')} disabled={add.isPending} icon={<Bookmark />}>
        Wishlist
      </Button>
    </div>
  )
}

export function DiscoverCard({ d, base }: { d: DiscoveredFragrance; base: string }) {
  const owner = useIsOwner()
  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-soft">
      <Link to={discoverHref(base, d)} className="flex flex-1 flex-col focus-visible:outline-offset-[-2px]">
        <FragranceImage
          fragrance={{ name: d.name, brand: d.brand, image_url: d.imageUrl, image_path: null }}
          className="aspect-[4/3] border-b border-line"
        />
        <div className="flex flex-1 flex-col gap-1 p-4">
          <p className="eyebrow truncate">{d.brand}</p>
          <h3 className="font-display text-[1.375rem] leading-snug text-ink">{d.name}</h3>
          {discoverMeta(d) && <p className="text-xs text-ink-3">{discoverMeta(d)}</p>}
          {d.accords.length > 0 && (
            <p className="mt-1 truncate text-xs text-ink-2 capitalize">{d.accords.slice(0, 3).map((a) => a.name).join(' · ')}</p>
          )}
          {d.country && (
            <div className="mt-auto pt-2">
              <Badge>{d.country}</Badge>
            </div>
          )}
        </div>
      </Link>
      {owner && (
        <div className="border-t border-line px-4 py-2.5">
          <AddToJournal d={d} compact />
        </div>
      )}
    </article>
  )
}
