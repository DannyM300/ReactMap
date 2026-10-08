// @ts-check
/* global BigInt */
const test = require('node:test')
const assert = require('node:assert')

const { shinyRoll, isRollable } = require('../src/utils/shinyRoll')

test('matches the published reference vector', () => {
  // The worked example both upstream implementations agree on.
  const roll = shinyRoll('example-player-id', '12345678901234567890')
  assert.strictEqual(roll.toFixed(6), '0.910662')
})

test('is deterministic for the same inputs', () => {
  const a = shinyRoll('player-a', '2059543502667849236')
  const b = shinyRoll('player-a', '2059543502667849236')
  assert.strictEqual(a, b)
})

test('gives a different roll per player for the same spawn', () => {
  const a = shinyRoll('player-a', '2059543502667849236')
  const b = shinyRoll('player-b', '2059543502667849236')
  assert.notStrictEqual(a, b)
})

test('stays inside [0, 1)', () => {
  for (let i = 0; i < 2000; i += 1) {
    const roll = shinyRoll(
      'player-a',
      (2059543502667849236n + BigInt(i)).toString(),
    )
    assert.ok(roll >= 0 && roll < 1, `roll out of range: ${roll}`)
  }
})

test('is roughly uniform, so the hit rate tracks the configured odds', () => {
  const n = 40000
  let hits = 0
  for (let i = 0; i < n; i += 1) {
    const roll = shinyRoll(
      'player-a',
      (1000000000000000000n + BigInt(i) * 7919n).toString(),
    )
    if (roll < 1 / 512) hits += 1
  }
  const expected = n / 512
  // Poisson noise: +/- 4 sigma is ~25 either side of 78.
  assert.ok(
    Math.abs(hits - expected) < 4 * Math.sqrt(expected),
    `hits ${hits} too far from expected ${expected}`,
  )
})

test('rejects malformed input', () => {
  assert.throws(() => shinyRoll('', '123'))
  assert.throws(() => shinyRoll('player', 'not-a-number'))
  assert.throws(() => shinyRoll('player', '123456789012345678901'))
})

test('isRollable follows the upstream eligibility rules', () => {
  const base = {
    id: '2059543502667849236',
    pokemon_id: 25,
    seen_type: 'wild',
    display_pokemon_id: null,
  }
  assert.ok(isRollable(base))
  assert.ok(isRollable({ ...base, seen_type: 'encounter' }))
  assert.ok(!isRollable({ ...base, seen_type: 'nearby_stop' }))
  assert.ok(!isRollable({ ...base, pokemon_id: 132 }))
  assert.ok(!isRollable({ ...base, is_ditto: true }))
  assert.ok(!isRollable({ ...base, display_pokemon_id: 132 }))
  assert.ok(isRollable({ ...base, display_pokemon_id: 25 }))
  assert.ok(!isRollable({ ...base, id: 'abc' }))
})
