const test = require('node:test')
const assert = require('node:assert/strict')

const { buildPokestopDnfFilters } = require('./pokestop')

const QUEST_REWARD_TYPES = { 1: {}, 2: {}, 3: {}, 4: {}, 7: {}, 9: {} }

test('a broad task falls back to match-all if reward metadata is unavailable', () => {
  const filters = {
    onlyQuests: true,
    'kcatch_pokemon-10': { all: false, adv: '' },
  }
  const clauses = buildPokestopDnfFilters(filters, {})
  assert.deepEqual(clauses, [])
})

test('an unnarrowed task fetches every quest type, not its previous rewards', () => {
  const filters = {
    onlyQuests: true,
    'kcatch_pokemon-10': { all: false, adv: '' },
  }
  const clauses = buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES)
  assert.deepEqual(clauses, [{ quest_reward_type: [1, 2, 3, 4, 7, 9] }])
})

test('a task narrowed via .adv expands to only the selected rewards', () => {
  const filters = {
    onlyQuests: true,
    'kcatch_pokemon-10': { all: false, adv: 'q1' },
  }
  const clauses = buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES)
  assert.deepEqual(clauses, [
    { quest_reward_type: [2], quest_reward_item_id: [1] },
  ])
})

test('.all on a task bypasses narrowing, same as reward filters', () => {
  const filters = {
    onlyQuests: true,
    'kcatch_pokemon-10': { all: true, adv: 'q1' },
  }
  const clauses = buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES)
  assert.deepEqual(clauses, [{ quest_reward_type: [1, 2, 3, 4, 7, 9] }])
})

test('an explicit reward filter already present is not overridden by expansion', () => {
  const filters = {
    onlyQuests: true,
    'kcatch_pokemon-10': { all: false, adv: 'q2' },
    // User separately narrowed the reward filter itself to a specific task -
    // expansion must not clobber that with a blank synthetic entry.
    q1: { all: false, adv: 'other_task__5' },
  }
  const clauses = buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES)
  const itemClause = clauses.find((c) => c.quest_reward_type?.[0] === 2)
  assert.deepEqual(itemClause, {
    quest_reward_type: [2],
    quest_reward_item_id: [1, 2],
  })
})

test('a malformed task key is ignored instead of becoming a pokemon filter', () => {
  const clauses = buildPokestopDnfFilters(
    { onlyQuests: true, kinvalid: { all: false, adv: '' } },
    {},
    QUEST_REWARD_TYPES,
  )
  assert.deepEqual(clauses, [])
})

test('a previously unseen task remains filterable across reward rotations', () => {
  const filters = {
    onlyQuests: true,
    'kmystery_task-1': { all: false, adv: '' },
  }
  const clauses = buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES)
  assert.deepEqual(clauses, [{ quest_reward_type: [1, 2, 3, 4, 7, 9] }])
})

test('a live reward type newer than the masterfile is included', () => {
  const filters = {
    onlyQuests: true,
    'knew_task-1': { all: false, adv: '' },
  }
  const taskConditions = {
    'knew_task-1': { rewards: ['u99'] },
  }
  const clauses = buildPokestopDnfFilters(
    filters,
    {},
    QUEST_REWARD_TYPES,
    taskConditions,
  )
  assert.deepEqual(clauses, [{ quest_reward_type: [1, 2, 3, 4, 7, 9, 99] }])
})

test('an unknown live reward shape fails open to match-all', () => {
  const filters = {
    onlyQuests: true,
    'kfuture_task-1': { all: false, adv: '' },
  }
  const taskConditions = {
    'kfuture_task-1': { rewards: ['future-format'] },
  }
  assert.deepEqual(
    buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES, taskConditions),
    [],
  )
})

test('observed mega task rewards cover both supported reward encodings', () => {
  const filters = {
    onlyQuests: true,
    'kpower_up-1': { all: false, adv: '' },
  }
  const taskConditions = {
    'kpower_up-1': { rewards: ['m6-25'] },
  }
  assert.deepEqual(buildPokestopDnfFilters(filters, {}, {}, taskConditions), [
    { quest_reward_type: [12, 20] },
  ])
})

test('a disabled task key (absent from filters) contributes nothing', () => {
  // Matches the wire contract: disabled filters are never sent at all.
  const filters = { onlyQuests: true }
  const clauses = buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES)
  assert.deepEqual(clauses, [])
})

test('task expansion respects onlyQuests being off, same as any reward key', () => {
  const filters = {
    onlyQuests: false,
    'kcatch_pokemon-10': { all: false, adv: '' },
  }
  const clauses = buildPokestopDnfFilters(filters, {}, QUEST_REWARD_TYPES)
  assert.deepEqual(clauses, [])
})

test('show backgrounds fetches all encounter quests for residual matching', () => {
  const clauses = buildPokestopDnfFilters({
    onlyQuests: true,
    onlyShowBackgrounds: true,
  })
  assert.deepEqual(clauses, [{ quest_reward_type: [7] }])
})

test('show backgrounds contributes nothing while quests are off', () => {
  const clauses = buildPokestopDnfFilters({
    onlyQuests: false,
    onlyShowBackgrounds: true,
  })
  assert.deepEqual(clauses, [])
})

test('a default-form encounter key ALSO fetches the unset (form 0) stops', () => {
  const clauses = buildPokestopDnfFilters(
    { onlyQuests: true, '39-987': { all: false, adv: '' } },
    {},
    undefined,
    undefined,
    { 39: { defaultFormId: 987 } },
  )
  const enc = clauses.find((c) => Array.isArray(c.quest_reward_pokemon))
  assert.deepEqual(enc.quest_reward_pokemon, [
    { pokemon_id: 39, form: 987 },
    { pokemon_id: 39, form: 0 },
  ])
})

test('a non-default (regional) encounter key does NOT fetch form 0', () => {
  const clauses = buildPokestopDnfFilters(
    { onlyQuests: true, '19-46': { all: false, adv: '' } },
    {},
    undefined,
    undefined,
    { 19: { defaultFormId: 45 } }, // 46 (Alolan) is not the default (45)
  )
  const enc = clauses.find((c) => Array.isArray(c.quest_reward_pokemon))
  assert.deepEqual(enc.quest_reward_pokemon, [{ pokemon_id: 19, form: 46 }])
})

test('without masterfile defaults a default-form key stays form-exact', () => {
  const clauses = buildPokestopDnfFilters({
    onlyQuests: true,
    '39-987': { all: false, adv: '' },
  })
  const enc = clauses.find((c) => Array.isArray(c.quest_reward_pokemon))
  assert.deepEqual(enc.quest_reward_pokemon, [{ pokemon_id: 39, form: 987 }])
})
