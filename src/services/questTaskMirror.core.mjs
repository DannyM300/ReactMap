// @ts-check
/**
 * Pure logic for the two-way quest reward <-> task filter sync. No store or
 * framework imports, so it is importable from a plain node test as well as the
 * client. The store wiring lives in `questTaskMirror.js`.
 *
 * The two quest drawer tabs filter the same quests from opposite ends and are
 * exact duals: a reward `R` (key `<id>-<form>`/`q123`/...) listing a task as
 * `title__target` in its `.adv` is the mirror of task `k<title>-<target>`
 * listing reward `R` in its `.adv`. Both directions are materialised in the
 * `available.questConditions` (reward -> tasks) and `available.taskConditions`
 * (task -> reward keys) maps the server builds from the same quest rows, so no
 * key parsing is needed - `title`/`target` are read straight off the maps.
 *
 * Each tile's tri-state is DERIVED from how many of its pairs are selected
 * (all -> green, some -> blue, none -> red), matching SelectorItem's colour rule
 * and the server's `!adv || all` broad-match.
 */

/** @param {string} key */
const isTaskKey = (key) => typeof key === 'string' && key.startsWith('k')

/** @param {any} filter @returns {boolean} */
const isEnabled = (filter) => !!(filter && filter.enabled)

/**
 * The peer keys currently selected by a tile: none when off (red), every peer
 * when `all` (green), else the `.adv` list (blue).
 * @param {any} filter
 * @param {string[]} allPeers
 * @returns {Set<string>}
 */
const selectedPeersOf = (filter, allPeers) => {
  if (!isEnabled(filter)) return new Set()
  // This must use the same broad-match rule as the server: an enabled filter
  // with no `.adv` value selects every peer, regardless of `.all`. `all` also
  // bypasses an existing narrowing. Treating the intermediate
  // `{ enabled: true, all: false, adv: '' }` state as empty made the source
  // tile stay blue while every mirrored tile was switched off.
  if (filter.all || !filter.adv) return new Set(allPeers)
  return new Set(String(filter.adv).split(',').filter(Boolean))
}

/**
 * Re-derive a tile from which of its peers are selected, preserving any other
 * fields (size, etc.) already on the tile.
 * @param {any} current
 * @param {string[]} selected peers still selected, in `.adv` format
 * @param {number} total number of peers the tile has
 */
const deriveTile = (current, selected, total) => {
  const base = { ...(current || {}) }
  if (selected.length === 0)
    return { ...base, enabled: false, all: false, adv: '' }
  if (selected.length >= total)
    return { ...base, enabled: true, all: true, adv: '' }
  return { ...base, enabled: true, all: false, adv: selected.join(',') }
}

/** Compare only the fields the mirror controls; treats missing as off/empty. */
const sameTile = (a, b) => {
  const na = {
    enabled: isEnabled(a),
    all: !!(a && a.all),
    adv: (a && a.adv) || '',
  }
  const nb = {
    enabled: isEnabled(b),
    all: !!(b && b.all),
    adv: (b && b.adv) || '',
  }
  return na.enabled === nb.enabled && na.all === nb.all && na.adv === nb.adv
}

/**
 * Given the current and previous pokestop filter maps and the availability
 * linkage, return only the filter entries that must change to keep the reward
 * and task tabs mirrored. Pure and side-effect free.
 *
 * @param {Record<string, any>} cur current `filters.pokestops.filter`
 * @param {Record<string, any> | undefined} prev previous map (to find edits)
 * @param {{ questConditions?: Record<string, {title: string, target?: number}[]>, taskConditions?: Record<string, {title: string, target?: number, rewards?: string[]}> }} available
 * @returns {Record<string, any>}
 */
export function computeQuestTaskMirror(cur, prev, available) {
  if (!cur) return {}
  const questConditions = (available && available.questConditions) || {}
  const taskConditions = (available && available.taskConditions) || {}
  /** @type {Record<string, any>} */
  const updates = {}

  const advKey = (title, target) => `${title}__${target}`

  Object.keys(cur).forEach((key) => {
    if (cur[key] === (prev ? prev[key] : undefined)) return

    if (isTaskKey(key)) {
      // A task tile changed -> write its selection onto each of its rewards.
      const task = taskConditions[key]
      if (!task || !Array.isArray(task.rewards)) return
      const entry = advKey(task.title, task.target)
      const selectedRewards = selectedPeersOf(cur[key], task.rewards)
      task.rewards.forEach((rewardKey) => {
        const conds = questConditions[rewardKey]
        if (!Array.isArray(conds)) return
        const currentReward = updates[rewardKey] || cur[rewardKey]
        const allEntries = conds.map(({ title, target }) =>
          advKey(title, target),
        )
        const advSet = selectedPeersOf(currentReward, allEntries)
        if (selectedRewards.has(rewardKey)) advSet.add(entry)
        else advSet.delete(entry)
        const stillSelected = allEntries.filter((e) => advSet.has(e))
        const derived = deriveTile(
          currentReward,
          stillSelected,
          allEntries.length,
        )
        if (!sameTile(derived, cur[rewardKey])) updates[rewardKey] = derived
      })
    } else {
      // A reward tile changed -> write its selection onto each of its tasks.
      const conds = questConditions[key]
      if (!Array.isArray(conds)) return
      const allEntries = conds.map(({ title, target }) => advKey(title, target))
      const selectedTasks = selectedPeersOf(cur[key], allEntries)
      conds.forEach(({ title, target }) => {
        const taskKey = `k${title}-${target}`
        const task = taskConditions[taskKey]
        if (!task || !Array.isArray(task.rewards)) return
        const currentTask = updates[taskKey] || cur[taskKey]
        const advSet = selectedPeersOf(currentTask, task.rewards)
        if (selectedTasks.has(advKey(title, target))) advSet.add(key)
        else advSet.delete(key)
        const stillSelected = task.rewards.filter((r) => advSet.has(r))
        const derived = deriveTile(
          currentTask,
          stillSelected,
          task.rewards.length,
        )
        if (!sameTile(derived, cur[taskKey])) updates[taskKey] = derived
      })
    }
  })

  return updates
}
