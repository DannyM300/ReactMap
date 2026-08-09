// @ts-check

/**
 * Matches one enabled reward filter, including its optional task-condition
 * and special-background narrowing.
 *
 * @param {{ adv?: string | string[], all?: boolean, backgroundOnly?: boolean } | undefined} filter
 * @param {string} questCondition
 * @param {number | string | null | undefined} background
 */
const matchesQuestRewardFilter = (filter, questCondition, background) => {
  if (!filter) return false
  const selectedConditions = Array.isArray(filter.adv)
    ? filter.adv
    : filter.adv?.split(',')
  const matchesCondition =
    !selectedConditions?.length ||
    filter.all ||
    selectedConditions.includes(questCondition)
  return (
    matchesCondition &&
    (filter.all || !filter.backgroundOnly || Number(background) > 0)
  )
}

/**
 * Global additive match for any confirmed special-background encounter quest.
 *
 * @param {boolean} enabled
 * @param {number | string | null | undefined} rewardType
 * @param {number | string | null | undefined} background
 */
const matchesBackgroundQuest = (enabled, rewardType, background) =>
  !!enabled && Number(rewardType) === 7 && Number(background) > 0

module.exports = { matchesBackgroundQuest, matchesQuestRewardFilter }
