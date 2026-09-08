const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
  getWildFilterKey,
  getWildFilterPairs,
} = require('../src/filters/pokemon/getWildFilterKey')
const masterfile = require('../../packages/masterfile/lib/data/masterfile.json')

test('masterfile does not define form zero as real beside a non-zero default', () => {
  const conflicts = Object.values(masterfile.pokemon).filter(
    (pokemon) =>
      Number(pokemon.defaultFormId) > 0 &&
      Object.prototype.hasOwnProperty.call(pokemon.forms || {}, '0'),
  )
  assert.deepEqual(conflicts, [])
})

test('unset wild form collapses onto the masterfile default', () => {
  assert.equal(getWildFilterKey(16, 0, 962), '16-962')
  assert.equal(getWildFilterKey(16, null, 962), '16-962')
  assert.equal(getWildFilterKey(16, 962, 962), '16-962')
})

test('genuine alternate wild forms remain separate', () => {
  assert.equal(getWildFilterKey(19, 46, 45), '19-46')
})

test('Ditto keeps its synthetic form-zero filter identity', () => {
  assert.equal(getWildFilterKey(132, 999, 293), '132-0')
  assert.deepEqual(getWildFilterPairs(132, 0, 293), [{ id: 132, form: 0 }])
})

test('default-form MEM filters fetch explicit and unset scanner rows', () => {
  assert.deepEqual(getWildFilterPairs(16, 962, 962), [
    { id: 16, form: 962 },
    { id: 16, form: 0 },
  ])
  assert.deepEqual(getWildFilterPairs(19, 46, 45), [{ id: 19, form: 46 }])
})
