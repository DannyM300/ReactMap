const test = require('node:test')
const assert = require('node:assert/strict')

const {
  addQuestTaskSqlClauses,
  addTaskCondition,
  getQuestTaskFilters,
  getQuestTaskKey,
  matchesAdvancedFilter,
  matchesBackgroundQuest,
  matchesQuestRewardFilter,
  parseQuestTaskKey,
} = require('./questTaskMatch')

// --- canonical task identity ---

test('task identity includes both title and target', () => {
  assert.equal(getQuestTaskKey('catch_pokemon', 10), 'kcatch_pokemon-10')
  assert.notEqual(
    getQuestTaskKey('catch_pokemon', 10),
    getQuestTaskKey('catch_pokemon', 25),
  )
})

test('task keys round-trip titles containing dashes', () => {
  const key = getQuestTaskKey('route-event-task', 3)
  assert.equal(key, 'kroute-event-task-3')
  assert.deepEqual(parseQuestTaskKey(key), {
    title: 'route-event-task',
    target: 3,
  })
})

test('malformed task keys are rejected', () => {
  assert.equal(parseQuestTaskKey('kinvalid'), null)
  assert.equal(parseQuestTaskKey('k-title'), null)
  assert.equal(parseQuestTaskKey('kvalid-nope'), null)
  assert.equal(parseQuestTaskKey('q1'), null)
})

test('only valid enabled task filters are returned', () => {
  assert.deepEqual(
    getQuestTaskFilters({
      'kcatch_pokemon-10': { adv: '' },
      kinvalid: { adv: '' },
      q1: { adv: '' },
    }),
    [
      {
        key: 'kcatch_pokemon-10',
        title: 'catch_pokemon',
        target: 10,
        filter: { adv: '' },
      },
    ],
  )
})

test('SQL task clauses bind exact title and target pairs', () => {
  const calls = []
  const makeBuilder = () => ({
    orWhere(callback) {
      const nested = makeBuilder()
      callback(nested)
      calls.push(['orWhere'])
      return this
    },
    where(column, value) {
      calls.push(['where', column, value])
      return this
    },
    andWhere(column, value) {
      calls.push(['andWhere', column, value])
      return this
    },
  })
  addQuestTaskSqlClauses(
    makeBuilder(),
    [
      { title: 'catch_pokemon', target: 10 },
      { title: 'spin_stops', target: 3 },
    ],
    'quest_title',
    'quest_target',
  )
  assert.deepEqual(
    calls.filter(([method]) => method !== 'orWhere'),
    [
      ['where', 'quest_title', 'catch_pokemon'],
      ['andWhere', 'quest_target', 10],
      ['where', 'quest_title', 'spin_stops'],
      ['andWhere', 'quest_target', 3],
    ],
  )
})

// --- matchesAdvancedFilter ---

test('no filter never matches', () => {
  assert.equal(matchesAdvancedFilter(undefined, 'anything'), false)
})

test('enabled filter with no narrowing matches unconditionally', () => {
  assert.equal(matchesAdvancedFilter({}, 'anything'), true)
  assert.equal(matchesAdvancedFilter({ enabled: true }, 'anything'), true)
})

test('.all bypasses narrowing entirely', () => {
  assert.equal(matchesAdvancedFilter({ adv: 'x,y', all: true }, 'z'), true)
})

test('.adv as a comma string narrows to the listed values', () => {
  const filter = { adv: 'a,b,c' }
  assert.equal(matchesAdvancedFilter(filter, 'b'), true)
  assert.equal(matchesAdvancedFilter(filter, 'z'), false)
})

test('.adv as an array narrows the same way as a comma string', () => {
  const filter = { adv: ['a', 'b', 'c'] }
  assert.equal(matchesAdvancedFilter(filter, 'b'), true)
  assert.equal(matchesAdvancedFilter(filter, 'z'), false)
})

test('empty .adv (empty string) matches unconditionally', () => {
  // split(',') on '' yields [''], and the falsy first element is filtered
  // out by the caller before .adv is ever set to '' - but guard it anyway.
  assert.equal(matchesAdvancedFilter({ adv: '' }, 'anything'), true)
})

// --- addTaskCondition ---

test('creates a new task entry on first sight', () => {
  const taskConditions = {}
  const key = addTaskCondition(taskConditions, '7-0', 'catch_pokemon', 10)
  assert.equal(key, 'kcatch_pokemon-10')
  assert.deepEqual(taskConditions, {
    'kcatch_pokemon-10': {
      title: 'catch_pokemon',
      target: 10,
      rewards: { '7-0': true },
    },
  })
})

test('accumulates multiple reward keys onto the same task', () => {
  const taskConditions = {}
  addTaskCondition(taskConditions, '7-0', 'catch_pokemon', 10)
  addTaskCondition(taskConditions, 'q1', 'catch_pokemon', 10)
  addTaskCondition(taskConditions, 'a633-2291', 'catch_pokemon', 10)
  assert.deepEqual(
    Object.keys(taskConditions['kcatch_pokemon-10'].rewards).sort(),
    ['7-0', 'a633-2291', 'q1'].sort(),
  )
})

test('the same reward seen twice for one task only appears once', () => {
  const taskConditions = {}
  addTaskCondition(taskConditions, '7-0', 'catch_pokemon', 10)
  addTaskCondition(taskConditions, '7-0', 'catch_pokemon', 10)
  assert.deepEqual(Object.keys(taskConditions['kcatch_pokemon-10'].rewards), [
    '7-0',
  ])
})

test('distinct (title, target) pairs stay in separate entries', () => {
  const taskConditions = {}
  addTaskCondition(taskConditions, '7-0', 'catch_pokemon', 10)
  addTaskCondition(taskConditions, '7-0', 'catch_pokemon', 5)
  addTaskCondition(taskConditions, '7-0', 'catch_water_pokemon', 10)
  assert.deepEqual(Object.keys(taskConditions).sort(), [
    'kcatch_pokemon-10',
    'kcatch_pokemon-5',
    'kcatch_water_pokemon-10',
  ])
})

test('round trip: a reward key added via addTaskCondition matches via matchesAdvancedFilter', () => {
  const taskConditions = {}
  const taskKey = addTaskCondition(taskConditions, '7-0', 'catch_pokemon', 10)
  // Simulate a user narrowing the task filter to just this one reward.
  const filters = { [taskKey]: { adv: '7-0' } }
  assert.equal(matchesAdvancedFilter(filters[taskKey], '7-0'), true)
  assert.equal(matchesAdvancedFilter(filters[taskKey], 'q1'), false)
})

// --- matchesQuestRewardFilter ---

test('background-only reward filters reject encounters without a background', () => {
  const filter = { enabled: true, backgroundOnly: true }
  assert.equal(matchesQuestRewardFilter(filter, 'task', 0), false)
  assert.equal(matchesQuestRewardFilter(filter, 'task', null), false)
  assert.equal(matchesQuestRewardFilter(filter, 'task', 12), true)
  assert.equal(matchesQuestRewardFilter(filter, 'task', '12'), true)
})

test('ordinary reward filters accept encounters with or without a background', () => {
  const filter = { enabled: true, backgroundOnly: false }
  assert.equal(matchesQuestRewardFilter(filter, 'task', 0), true)
  assert.equal(matchesQuestRewardFilter(filter, 'task', 12), true)
})

test('all bypasses background-only and advanced reward narrowing', () => {
  const filter = {
    enabled: true,
    all: true,
    adv: 'different-task',
    backgroundOnly: true,
  }
  assert.equal(matchesQuestRewardFilter(filter, 'task', 0), true)
})

// --- matchesBackgroundQuest ---

test('global background matching accepts only enabled encounter backgrounds', () => {
  assert.equal(matchesBackgroundQuest(true, 7, 12), true)
  assert.equal(matchesBackgroundQuest(true, '7', '12'), true)
  assert.equal(matchesBackgroundQuest(false, 7, 12), false)
  assert.equal(matchesBackgroundQuest(true, 7, 0), false)
  assert.equal(matchesBackgroundQuest(true, 2, 12), false)
})
