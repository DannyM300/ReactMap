// @ts-check
import { useStorage } from '@store/useStorage'
import { useMemory } from '@store/useMemory'

import { computeQuestTaskMirror } from './questTaskMirror.core'

export { computeQuestTaskMirror }

/**
 * Register the two-way quest reward <-> task filter sync on the storage store.
 * Every quest-filter mutation (tile click, advanced dialog, "set all") flows
 * through this store, so a single subscription catches them all - nothing in the
 * generic tile/selector components needs to know about the sync. The pure mirror
 * logic lives in `questTaskMirror.core.mjs`.
 *
 * @returns {() => void} unsubscribe
 */
export function subscribeQuestTaskMirror() {
  let syncing = false
  return useStorage.subscribe((state, prev) => {
    if (syncing) return
    const cur = state.filters?.pokestops?.filter
    const old = prev.filters?.pokestops?.filter
    if (!cur || cur === old) return
    const updates = computeQuestTaskMirror(
      cur,
      old,
      useMemory.getState().available,
    )
    if (!Object.keys(updates).length) return
    syncing = true
    useStorage.setState((s) => ({
      filters: {
        ...s.filters,
        pokestops: {
          ...s.filters.pokestops,
          filter: { ...s.filters.pokestops.filter, ...updates },
        },
      },
    }))
    syncing = false
  })
}
