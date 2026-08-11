const test = require('node:test')
const assert = require('node:assert/strict')

const { mapAvailablePokestops } = require('./pokestopAvailableMapper')

const emptyAvailable = (invasions) => ({
  quests: [],
  invasions,
  lures: [],
  showcases: [],
})

const ctx = {
  invasions: {
    20: { firstReward: true },
  },
}

test('Golbat availability builds one task identity with every observed reward', () => {
  const result = mapAvailablePokestops(
    {
      ...emptyAvailable([]),
      quests: [
        {
          with_ar: true,
          reward_type: 2,
          item_id: 1,
          amount: 1,
          pokemon_id: 0,
          form_id: 0,
          title: 'catch_pokemon',
          target: 10,
        },
        {
          with_ar: true,
          reward_type: 7,
          item_id: 0,
          amount: 1,
          pokemon_id: 25,
          form_id: 0,
          title: 'catch_pokemon',
          target: 10,
        },
      ],
    },
    ctx,
  )
  assert.equal(result.available.includes('kcatch_pokemon-10'), true)
  assert.deepEqual(result.taskConditions['kcatch_pokemon-10'], {
    title: 'catch_pokemon',
    target: 10,
    rewards: { q1: true, 25: true },
  })
})

test('Golbat availability keeps identical titles with different targets separate', () => {
  const quests = [3, 5].map((target) => ({
    with_ar: true,
    reward_type: 2,
    item_id: 1,
    amount: 1,
    pokemon_id: 0,
    form_id: 0,
    title: 'spin_pokestops',
    target,
  }))
  const result = mapAvailablePokestops({ ...emptyAvailable([]), quests }, ctx)
  assert.equal(result.available.includes('kspin_pokestops-3'), true)
  assert.equal(result.available.includes('kspin_pokestops-5'), true)
})
