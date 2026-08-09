const test = require('node:test')
const assert = require('node:assert/strict')

const { buildPokestopDnfFilters } = require('./pokestop')

test('show backgrounds fetches encounter quests for residual matching', () => {
  assert.deepEqual(
    buildPokestopDnfFilters({
      onlyQuests: true,
      onlyShowBackgrounds: true,
    }),
    [{ quest_reward_type: [7] }],
  )
})

test('show backgrounds contributes nothing while quests are off', () => {
  assert.deepEqual(
    buildPokestopDnfFilters({
      onlyQuests: false,
      onlyShowBackgrounds: true,
    }),
    [],
  )
})
