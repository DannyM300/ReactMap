const test = require('node:test')
const assert = require('node:assert/strict')

const {
  matchesBackgroundQuest,
  matchesQuestRewardFilter,
} = require('./questBackgroundMatch')

test('background-only species filters require a non-zero background ID', () => {
  const filter = { enabled: true, backgroundOnly: true }
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', 0), false)
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', null), false)
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', 12), true)
})

test('ordinary species filters preserve existing matching', () => {
  const filter = { enabled: true }
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', 0), true)
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', 12), true)
})

test('task-condition narrowing still combines with background-only', () => {
  const filter = {
    enabled: true,
    adv: 'task__1',
    backgroundOnly: true,
  }
  assert.equal(matchesQuestRewardFilter(filter, 'task__2', 12), false)
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', 0), false)
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', 12), true)
})

test('all bypasses advanced and background narrowing', () => {
  const filter = {
    enabled: true,
    all: true,
    adv: 'different__1',
    backgroundOnly: true,
  }
  assert.equal(matchesQuestRewardFilter(filter, 'task__1', 0), true)
})

test('global matching accepts only enabled encounter backgrounds', () => {
  assert.equal(matchesBackgroundQuest(true, 7, 12), true)
  assert.equal(matchesBackgroundQuest(true, '7', '12'), true)
  assert.equal(matchesBackgroundQuest(false, 7, 12), false)
  assert.equal(matchesBackgroundQuest(true, 7, 0), false)
  assert.equal(matchesBackgroundQuest(true, 2, 12), false)
})
