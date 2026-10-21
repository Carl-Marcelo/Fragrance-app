import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filtersFromParams, filtersToParams, type FilterState } from '../lib/filters'

/** Filter state stored in the URL so results survive refresh, back/forward and bookmarks. */
export function useFilterState(base: FilterState) {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => filtersFromParams(params, base), [params, base])

  const update = useCallback(
    (patch: Partial<FilterState> | ((s: FilterState) => Partial<FilterState>)) => {
      setParams(
        (current) => {
          const now = filtersFromParams(current, base)
          const next = { ...now, ...(typeof patch === 'function' ? patch(now) : patch) }
          return filtersToParams(next, base)
        },
        { replace: true },
      )
    },
    [base, setParams],
  )

  const clear = useCallback(() => {
    // Keep the chosen sort; clear everything else.
    setParams(
      (current) => {
        const now = filtersFromParams(current, base)
        return filtersToParams({ ...base, sort: now.sort, dir: now.dir }, base)
      },
      { replace: true },
    )
  }, [base, setParams])

  return { state, update, clear }
}
