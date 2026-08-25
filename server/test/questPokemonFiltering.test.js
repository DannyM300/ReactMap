const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
  getCanonicalQuestPokemonKey,
} = require('../src/utils/questPokemonFiltering')

// The 12 live unset-vs-default duplicates from the scanner, as [id, defaultFormId]
// (verified against the masterfile: defaultFormId === the explicit form observed).
const DUPES = [
  [39, 987],
  [133, 1092],
  [495, 1889],
  [498, 1898],
  [501, 1907],
  [568, 2102],
  [702, 2860],
  [722, 3076],
  [725, 3078],
  [728, 3081],
  [759, 3108],
  [767, 3115],
]

test('unset / 0 / undefined all fold onto the default, merging the duplicate', () => {
  DUPES.forEach(([id, def]) => {
    const merged = `${id}-${def}`
    assert.equal(
      getCanonicalQuestPokemonKey(id, null, def),
      merged,
      `null #${id}`,
    )
    assert.equal(
      getCanonicalQuestPokemonKey(id, undefined, def),
      merged,
      `undefined #${id}`,
    )
    assert.equal(getCanonicalQuestPokemonKey(id, 0, def), merged, `zero #${id}`)
    // the other half of the dupe (the explicit default form) already yields the
    // same key, so the two collapse to a single tile:
    assert.equal(
      getCanonicalQuestPokemonKey(id, def, def),
      merged,
      `explicit #${id}`,
    )
  })
})

test('genuine non-zero forms (regionals) are preserved and never merged', () => {
  // Rattata: Kantonian 45 (default) vs Alolan 46
  assert.equal(getCanonicalQuestPokemonKey(19, 45, 45), '19-45')
  assert.equal(getCanonicalQuestPokemonKey(19, 46, 45), '19-46')
  // an unset Rattata folds onto Kantonian, still distinct from Alolan
  assert.equal(getCanonicalQuestPokemonKey(19, null, 45), '19-45')
  assert.notEqual(
    getCanonicalQuestPokemonKey(19, 46, 45),
    getCanonicalQuestPokemonKey(19, null, 45),
  )
  // Growlithe: Kantonian 280 (default) vs Hisuian 2792
  assert.equal(getCanonicalQuestPokemonKey(58, 2792, 280), '58-2792')
  assert.equal(getCanonicalQuestPokemonKey(58, 280, 280), '58-280')
  // Eevee: default 1092 folds; its other forms (2845/2846) stay separate
  assert.equal(getCanonicalQuestPokemonKey(133, null, 1092), '133-1092')
  assert.equal(getCanonicalQuestPokemonKey(133, 2845, 1092), '133-2845')
})

test('no known default -> bare species key (prior behaviour, no mis-merge)', () => {
  assert.equal(getCanonicalQuestPokemonKey(39, null, undefined), '39')
  assert.equal(getCanonicalQuestPokemonKey(39, 0, null), '39')
  // a default of 0 is not a real form, so it must not produce `39-0`
  assert.equal(getCanonicalQuestPokemonKey(39, null, 0), '39')
})

test('invalid id yields no key', () => {
  assert.equal(getCanonicalQuestPokemonKey(0, 5, 5), '')
  assert.equal(getCanonicalQuestPokemonKey(null, 5, 5), '')
  assert.equal(getCanonicalQuestPokemonKey('nope', 5, 5), '')
})
