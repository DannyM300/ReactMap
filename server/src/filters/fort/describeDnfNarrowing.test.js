const test = require('node:test')
const assert = require('node:assert/strict')

const { describeDnfNarrowing } = require('./describeDnfNarrowing')

test('includes raw Golbat envelope counters when available', () => {
  const description = describeDnfNarrowing(
    'POKESTOP',
    [{ quest_reward_type: [1, 2, 3] }],
    1200,
    250,
    4,
    { total: 1400, skipped: 200 },
  )
  assert.match(description, /250 matched -> 4/)
  assert.match(description, /quest_reward_type\[3\]/)
  assert.match(description, /1200 scanned/)
  assert.match(description, /1400 total, 200 skipped/)
})

test('keeps the existing output shape for endpoints without counters', () => {
  const description = describeDnfNarrowing('GYM', [], 10, 8, 5)
  assert.match(description, /match-all/)
  assert.doesNotMatch(description, /total|skipped/)
})
