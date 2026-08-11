// @ts-check

/** @param {unknown} value */
const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

/**
 * Returns only values that differ from the matching defaults.
 * Unknown keys are deliberately retained for forwards/backwards compatibility.
 *
 * @param {unknown} value
 * @param {unknown} defaults
 * @returns {unknown}
 */
function getDifference(value, defaults) {
  if (Object.is(value, defaults)) return undefined

  if (Array.isArray(value) && Array.isArray(defaults)) {
    if (
      value.length === defaults.length &&
      value.every((entry, index) =>
        Object.is(getDifference(entry, defaults[index]), undefined),
      )
    ) {
      return undefined
    }
    return value
  }

  if (isPlainObject(value) && isPlainObject(defaults)) {
    const difference = {}
    Object.entries(value).forEach(([key, entry]) => {
      const entryDifference = Object.prototype.hasOwnProperty.call(
        defaults,
        key,
      )
        ? getDifference(entry, defaults[key])
        : entry
      if (entryDifference !== undefined) difference[key] = entryDifference
    })
    return Object.keys(difference).length ? difference : undefined
  }

  return value
}

/**
 * Produces a JSON-safe profile payload. Only unchanged, dynamically generated
 * task filters are omitted; useMapData restores those current server defaults
 * when a profile is loaded. Every pre-existing filter category remains a full
 * snapshot, so changing server defaults later cannot alter unrelated settings
 * in an older profile.
 *
 * @param {Record<string, any>} state
 * @param {Record<string, any>} defaultFilters
 */
export function createBackupData(state, defaultFilters) {
  const backup = JSON.parse(JSON.stringify(state))
  const taskFilters = backup.filters?.pokestops?.filter
  const defaultTaskFilters = defaultFilters?.pokestops?.filter
  if (taskFilters && defaultTaskFilters) {
    Object.keys(taskFilters).forEach((key) => {
      if (
        key.startsWith('k') &&
        Object.prototype.hasOwnProperty.call(defaultTaskFilters, key) &&
        getDifference(taskFilters[key], defaultTaskFilters[key]) === undefined
      ) {
        delete taskFilters[key]
      }
    })
  }
  return backup
}
