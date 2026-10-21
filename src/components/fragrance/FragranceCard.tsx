import { Heart } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { statusLabel } from '../../lib/constants'
import { formatMoney, formatRating } from '../../lib/format'
import type { CollectionItem, Fragrance } from '../../lib/types'
import { Badge } from '../ui/Badge'
import { BottleLevel } from '../ui/Scale'
import { FragranceMeta } from './FragranceBits'
import { FragranceImage } from './FragranceImage'

interface FragranceCardProps {
  fragrance: Fragrance
  item?: CollectionItem | null
  to: string
  lowThreshold?: number
  onToggleFavorite?: () => void
  showStatus?: boolean
  footer?: ReactNode
}

export function FragranceCard({
  fragrance,
  item,
  to,
  lowThreshold = 20,
  onToggleFavorite,
  showStatus,
  footer,
}: FragranceCardProps) {
  const low = item?.status === 'owned' && item.remaining_percent != null && item.remaining_percent <= lowThreshold
  return (
    <article className="group card relative flex flex-col overflow-hidden transition-shadow hover:shadow-soft">
      <Link to={to} className="flex flex-1 flex-col focus-visible:outline-offset-[-2px]">
        <FragranceImage
          fragrance={fragrance}
          bottlePhotoPath={item?.bottle_image_path}
          className="aspect-[4/3] border-b border-line"
        />
        <div className="flex flex-1 flex-col gap-1 p-4">
          <p className="eyebrow truncate">{fragrance.brand}</p>
          <h3 className="font-display text-[1.375rem] leading-snug text-ink">{fragrance.name}</h3>
          <FragranceMeta fragrance={fragrance} />
          {fragrance.accords.length > 0 && (
            <p className="mt-1 truncate text-xs text-ink-2 capitalize">{fragrance.accords.slice(0, 3).join(' · ')}</p>
          )}

          {item && (
            <div className="mt-auto space-y-2 pt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {showStatus && <Badge>{statusLabel(item.status)}</Badge>}
                {low && <Badge tone="warning">Running low</Badge>}
                {item.status === 'wishlist' && item.wishlist_priority === 1 && <Badge tone="accent">High priority</Badge>}
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-2">
                  {item.personal_rating != null ? (
                    <>
                      <span className="font-medium text-ink">{formatRating(item.personal_rating)}</span>
                    </>
                  ) : (
                    <span className="text-ink-3">Not rated</span>
                  )}
                </span>
                {item.purchase_price != null && (
                  <span className="text-ink-2 tabular-nums">{formatMoney(item.purchase_price, item.currency)}</span>
                )}
              </div>
              {item.status === 'owned' && <BottleLevel percent={item.remaining_percent} low={low} />}
            </div>
          )}
        </div>
      </Link>
      {footer && <div className="border-t border-line px-4 py-2.5">{footer}</div>}
      {item && onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={item.is_favorite}
          aria-label={item.is_favorite ? `Remove ${fragrance.name} from favourites` : `Add ${fragrance.name} to favourites`}
          className={cn(
            'absolute top-3 right-3 rounded-full border border-line bg-surface/90 p-2 backdrop-blur transition-colors',
            item.is_favorite ? 'text-danger' : 'text-ink-3 hover:text-ink',
          )}
        >
          <Heart className={cn('size-4', item.is_favorite && 'fill-current')} />
        </button>
      )}
    </article>
  )
}

/** Compact row used in dashboard lists. */
export function FragranceRow({
  fragrance,
  item,
  to,
  trailing,
}: {
  fragrance: Fragrance
  item?: CollectionItem | null
  to: string
  trailing?: ReactNode
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-sunken">
      <FragranceImage
        fragrance={fragrance}
        bottlePhotoPath={item?.bottle_image_path}
        sizes="thumb"
        className="size-12 shrink-0 rounded-md border border-line"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{fragrance.name}</p>
        <p className="truncate text-xs text-ink-3">{fragrance.brand}</p>
      </div>
      {trailing && <div className="shrink-0 text-right text-sm">{trailing}</div>}
    </Link>
  )
}
