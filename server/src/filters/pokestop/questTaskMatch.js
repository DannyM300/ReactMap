// @ts-check

/**
 * Shared core of the reward-primary and task-primary quest filter checks.
 *
 * A filter is enabled on its own (no `.adv` narrowing) matches unconditionally
 * - that's the normal "I want this reward" / "I want this task" case. If
 * `.adv` is set, the filter has been narrowed to a specific set of values on
 * the OTHER axis (a reward filter narrowed to specific task conditions, or a
 * task filter narrowed to specific reward keys) - only match if `matchValue`
 * is in that set. `.all` bypasses narrowing entirely, matching the "Set All"
 * bulk-enable semantics used elsewhere.
 * @param {{ adv?: string | string[], all?: boolean } | undefined} filter
 * @param {string} matchValue
 */
const matchesAdvancedFilter = (filter, matchValue) => {
  if (!filter || !filter.adv || filter.all) return !!filter
  const selected = Array.isArray(filter.adv)
    ? filter.adv
    : filter.adv.split(',')
  return !selected.length || selected.includes(matchValue)
}

/**
 * Applies the encounter-only options that belong to a reward-primary quest
 * filter. `all` keeps its existing meaning and bypasses every narrowing
 * option; otherwise `backgroundOnly` requires a non-zero location-card ID.
 *
 * @param {{ adv?: string | string[], all?: boolean, backgroundOnly?: boolean } | undefined} filter
 * @param {string} matchValue
 * @param {number | string | null | undefined} background
 */
const matchesQuestRewardFilter = (filter, matchValue, background) =>
  matchesAdvancedFilter(filter, matchValue) &&
  (filter.all || !filter.backgroundOnly || Number(background) > 0)

/**
 * Global additive match for any confirmed special-background encounter quest.
 *
 * @param {boolean} enabled
 * @param {number | string | null | undefined} rewardType
 * @param {number | string | null | undefined} background
 */
const matchesBackgroundQuest = (enabled, rewardType, background) =>
  !!enabled && Number(rewardType) === 7 && Number(background) > 0

/**
 * Builds the canonical identity used by task filters. A quest task is defined
 * by BOTH its untranslated title key and target; rewards are deliberately not
 * part of the identity because the same task can grant different rewards.
 *
 * @param {string | number | null | undefined} title
 * @param {number | string | null | undefined} target
 * @returns {string | null}
 */
const getQuestTaskKey = (title, target) => {
  const normalizedTitle = `${title ?? ''}`
  const normalizedTarget = Number(target)
  if (!normalizedTitle || !Number.isFinite(normalizedTarget)) return null
  return `k${normalizedTitle}-${normalizedTarget}`
}

/**
 * Parses a persisted task key without making assumptions about punctuation in
 * its title. Splitting at the final dash keeps titles containing dashes valid.
 *
 * @param {string} key
 * @returns {{ title: string, target: number } | null}
 */
const parseQuestTaskKey = (key) => {
  if (typeof key !== 'string' || !key.startsWith('k')) return null
  const separator = key.lastIndexOf('-')
  if (separator <= 1 || separator === key.length - 1) return null
  const title = key.slice(1, separator)
  const target = Number(key.slice(separator + 1))
  return title && Number.isFinite(target) ? { title, target } : null
}

/**
 * Returns the valid task identities present in the enabled wire filters.
 * Disabled filters never reach the server because trimFilters removes them.
 *
 * @param {Record<string, any>} filters
 * @returns {{ key: string, title: string, target: number, filter: any }[]}
 */
const getQuestTaskFilters = (filters) =>
  Object.entries(filters || {}).flatMap(([key, filter]) => {
    const task = parseQuestTaskKey(key)
    return task ? [{ key, ...task, filter }] : []
  })

/**
 * Adds task identity pairs to an existing Knex OR group. The caller supplies
 * base or alternative quest columns, allowing both scanner schemas to use the
 * same exact title+target semantics without an additional database query.
 *
 * @param {any} builder Knex query/group builder
 * @param {{ title: string, target: number }[]} tasks
 * @param {string} titleColumn
 * @param {string} targetColumn
 */
const addQuestTaskSqlClauses = (builder, tasks, titleColumn, targetColumn) => {
  tasks.forEach(({ title, target }) => {
    builder.orWhere((task) => {
      task.where(titleColumn, title).andWhere(targetColumn, target)
    })
  })
}

/**
 * Accumulates one reward key onto its task's entry, mutating `taskConditions`
 * in place. Mirrors the reward-primary `conditions[rewardKey][conditionKey]`
 * map in the opposite direction: one entry per distinct (title, target) pair
 * - unlike a reward, which can come from many tasks, a task key IS one task,
 * so `title`/`target` are stored once and `rewards` accumulates every reward
 * key seen for it across however many quest rows share that task.
 * @param {Record<string, {title: string, target: number, rewards: Record<string, boolean>}>} taskConditions
 * @param {string} key reward key, e.g. `7-0`, `q123`, `a633-2291`
 * @param {string} title
 * @param {number} target
 * @returns {string} the task key that was added/updated, e.g. `kcatch_pokemon-10`
 */
const addTaskCondition = (taskConditions, key, title, target) => {
  const taskKey = getQuestTaskKey(title, target)
  if (!taskKey) return ''
  if (taskKey in taskConditions) {
    taskConditions[taskKey].rewards[key] = true
  } else {
    taskConditions[taskKey] = { title, target, rewards: { [key]: true } }
  }
  return taskKey
}

module.exports = {
  addTaskCondition,
  addQuestTaskSqlClauses,
  getQuestTaskFilters,
  getQuestTaskKey,
  matchesAdvancedFilter,
  matchesBackgroundQuest,
  matchesQuestRewardFilter,
  parseQuestTaskKey,
}
