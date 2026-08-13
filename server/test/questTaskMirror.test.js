const assert = require('node:assert/strict')
const { test } = require('node:test')

// The mirror logic is pure and framework-free, but lives in the client tree as
// ESM (`.mjs`) so it can be shared with the browser bundle. Dynamic-import it
// from this CJS test.
const corePromise = import(
  // eslint-disable-next-line import/extensions -- node needs the explicit .mjs
  '../../src/services/questTaskMirror.core.mjs'
).then((m) => m.computeQuestTaskMirror)

/**
 * Two quests:
 *  - catch_5 (target 5) rewards Deino (633-0) and Larvitar (246-0)
 *  - hatch_1 (target 1) rewards Deino (633-0)
 * So Deino comes from two tasks; catch_5 gives two rewards.
 */
const available = {
  questConditions: {
    '633-0': [
      { title: 'catch_5', target: 5 },
      { title: 'hatch_1', target: 1 },
    ],
    '246-0': [{ title: 'catch_5', target: 5 }],
  },
  taskConditions: {
    'kcatch_5-5': { title: 'catch_5', target: 5, rewards: ['633-0', '246-0'] },
    'khatch_1-1': { title: 'hatch_1', target: 1, rewards: ['633-0'] },
  },
}

const off = { enabled: false, all: false, adv: '' }

/** Build a full filter map with every key off, then override some. */
const mapWith = (overrides) => ({
  '633-0': { ...off },
  '246-0': { ...off },
  'kcatch_5-5': { ...off },
  'khatch_1-1': { ...off },
  ...overrides,
})

test('narrowing a reward to one task ticks only that task (blue), not siblings', async () => {
  const compute = await corePromise
  const prev = mapWith({})
  // User narrows Deino to catch_5 only (blue).
  const cur = mapWith({
    '633-0': { enabled: true, all: false, adv: 'catch_5__5' },
  })
  const updates = compute(cur, prev, available)
  // catch_5 gains Deino, becomes blue (it also has Larvitar, so a subset).
  assert.deepEqual(updates['kcatch_5-5'], {
    enabled: true,
    all: false,
    adv: '633-0',
  })
  // hatch_1 also gives Deino but was NOT selected, stays off (no spill).
  assert.ok(
    !('khatch_1-1' in updates) || updates['khatch_1-1'].enabled === false,
  )
})

test('turning a reward fully on (green) ticks all its tasks', async () => {
  const compute = await corePromise
  const prev = mapWith({})
  const cur = mapWith({ '633-0': { enabled: true, all: true, adv: '' } })
  const updates = compute(cur, prev, available)
  // catch_5 has two rewards, only Deino selected -> blue with Deino.
  assert.deepEqual(updates['kcatch_5-5'], {
    enabled: true,
    all: false,
    adv: '633-0',
  })
  // hatch_1's only reward is Deino -> fully selected -> green.
  assert.deepEqual(updates['khatch_1-1'], {
    enabled: true,
    all: true,
    adv: '',
  })
})

test('turning a reward off removes it; task with no ticks left goes red, others keep theirs', async () => {
  const compute = await corePromise
  // Start consistent: Deino green everywhere; catch_5 blue [Deino], hatch_1 green.
  const prev = mapWith({
    '633-0': { enabled: true, all: true, adv: '' },
    'kcatch_5-5': { enabled: true, all: false, adv: '633-0' },
    'khatch_1-1': { enabled: true, all: true, adv: '' },
  })
  // User turns Deino off.
  const cur = { ...prev, '633-0': { ...off } }
  const updates = compute(cur, prev, available)
  // hatch_1 had only Deino -> now empty -> disabled.
  assert.equal(updates['khatch_1-1'].enabled, false)
  // catch_5 loses Deino but... it had only Deino ticked -> now empty -> disabled.
  assert.equal(updates['kcatch_5-5'].enabled, false)
})

test('a task edit mirrors back onto its reward tiles', async () => {
  const compute = await corePromise
  const prev = mapWith({})
  // User turns catch_5 fully on (green = both its rewards).
  const cur = mapWith({ 'kcatch_5-5': { enabled: true, all: true, adv: '' } })
  const updates = compute(cur, prev, available)
  // Larvitar's only task is catch_5 -> fully selected -> green.
  assert.deepEqual(updates['246-0'], { enabled: true, all: true, adv: '' })
  // Deino has two tasks, only catch_5 selected -> blue with catch_5.
  assert.deepEqual(updates['633-0'], {
    enabled: true,
    all: false,
    adv: 'catch_5__5',
  })
})

test('already-consistent input produces no writes', async () => {
  const compute = await corePromise
  // Deino narrowed to catch_5, catch_5 narrowed to Deino - a stable pair.
  const stable = mapWith({
    '633-0': { enabled: true, all: false, adv: 'catch_5__5' },
    'kcatch_5-5': { enabled: true, all: false, adv: '633-0' },
  })
  // Re-run against itself as prev: nothing changed, so no updates.
  assert.deepEqual(compute(stable, stable, available), {})
})

test('a change to an unrelated (non-quest) key is ignored', async () => {
  const compute = await corePromise
  const prev = { ...mapWith({}), l501: { ...off } }
  const cur = { ...prev, l501: { enabled: true, all: true, adv: '' } }
  assert.deepEqual(compute(cur, prev, available), {})
})
