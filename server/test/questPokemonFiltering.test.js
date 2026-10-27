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

test('absent or non-numeric id yields no key', () => {
  assert.equal(getCanonicalQuestPokemonKey(null, 5, 5), '')
  assert.equal(getCanonicalQuestPokemonKey(undefined, 5, 5), '')
  // '' coerces to 0 via Number(), so it must be rejected before coercion or it
  // would claim the species-0 "Substitute" tile below.
  assert.equal(getCanonicalQuestPokemonKey('', 5, 5), '')
  assert.equal(getCanonicalQuestPokemonKey('nope', 5, 5), '')
  assert.equal(getCanonicalQuestPokemonKey(-1, 5, 5), '')
})

test('species 0 (undisclosed reward) keeps one bare Substitute tile', () => {
  // The game ships a deliberately hidden encounter reward as pokemon_id 0 (e.g.
  // the halloween_26_raid template). It must still get a tile - reward type 7 is
  // excluded from the generic `u<type>` fallback, so an empty key would make
  // every such quest unfilterable and invisible. `poke_0` renders "Substitute".
  assert.equal(getCanonicalQuestPokemonKey(0, null, undefined), '0')
  assert.equal(getCanonicalQuestPokemonKey('0', null, undefined), '0')
  // A form is meaningless for an unknown species: every shape collapses to the
  // same single tile rather than splitting into 0 / 0-5 / 0-<default>.
  assert.equal(getCanonicalQuestPokemonKey(0, 0, 0), '0')
  assert.equal(getCanonicalQuestPokemonKey(0, 5, 5), '0')
  assert.equal(getCanonicalQuestPokemonKey(0, null, 987), '0')
})
