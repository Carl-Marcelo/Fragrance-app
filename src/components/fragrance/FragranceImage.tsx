import { useState } from 'react'
import { api } from '../../api'
import { useSignedUrl } from '../../hooks/queries'
import { cn } from '../../lib/cn'
import type { Fragrance } from '../../lib/types'

/** Reference image → uploaded reference image → elegant placeholder. A private bottle photo wins when given. */
export function FragranceImage({
  fragrance,
  bottlePhotoPath,
  className,
  sizes = 'card',
}: {
  fragrance: Pick<Fragrance, 'name' | 'brand' | 'image_url' | 'image_path'>
  bottlePhotoPath?: string | null
  className?: string
  sizes?: 'card' | 'thumb' | 'hero'
}) {
  const signed = useSignedUrl(bottlePhotoPath)
  const reference = fragrance.image_url || (fragrance.image_path ? api.publicUrl(fragrance.image_path) : null)
  const src = (bottlePhotoPath && signed.data) || reference
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = src && failed !== src

  return (
    <div className={cn('relative overflow-hidden bg-sunken', className)}>
      {showImage ? (
        <img
          src={src}
          alt={`${fragrance.name} by ${fragrance.brand}`}
          loading={sizes === 'hero' ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
          className="absolute inset-0 size-full object-contain p-[6%] mix-blend-multiply dark:mix-blend-normal"
        />
      ) : (
        <Placeholder brand={fragrance.brand} size={sizes} />
      )}
    </div>
  )
}

function Placeholder({ brand, size }: { brand: string; size: 'card' | 'thumb' | 'hero' }) {
  const initials = brand
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-3" aria-hidden>
      <svg
        viewBox="0 0 48 64"
        className={cn('stroke-current opacity-60', size === 'thumb' ? 'h-7' : size === 'hero' ? 'h-24' : 'h-14')}
        fill="none"
        strokeWidth="1.25"
      >
        <rect x="19" y="3" width="10" height="7" rx="1.5" />
        <path d="M21 10v5M27 10v5" />
        <rect x="7" y="15" width="34" height="45" rx="7" />
        <path d="M13 28h22" opacity=".5" />
      </svg>
      {size !== 'thumb' && (
        <span className="font-display text-sm tracking-[0.2em] opacity-80">{initials || '—'}</span>
      )}
    </div>
  )
}
