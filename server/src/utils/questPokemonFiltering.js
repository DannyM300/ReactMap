// @ts-check

/**
 * Reconciles a quest Pokemon-reward form to the masterfile's default form so a
 * species reported with an unset form in one quest and its explicit default
 * form in another collapses to ONE availability tile instead of two.
 *
 * The scanner reports the same species with the form absent/`null` (direct SQL)
 * or `0` (the Golbat endpoint's unset sentinel) in one quest, and its explicit
 * default form (e.g. Jigglypuff `987`) in another. Left alone these build the
 * separate keys `<id>` and `<id>-<default>`, splitting the species' quest tasks
 * across two visually-duplicate tiles. Folding the unset case onto the default
 * form merges them into one tile that carries both tasks.
 *
 * A genuine non-zero form (regional / alternate variants such as Alolan or
 * Galarian) is authoritative and preserved exactly, so two real variants never
 * merge. When no default form is known the bare species key is kept (the prior
 * behaviour), so nothing is mis-merged. Mirrors the Team Rocket reward
 * reconciliation in `getCanonicalRocketPokemonFilterKey`.
 *
 * Species `0` is NOT invalid: the game reports a deliberately undisclosed
 * encounter reward as `pokemon_id: 0` (e.g. the `halloween_26_raid` template,
 * whose reward JSON is `{"pokemon_id":0,"shiny_probability":0.0078125}` and
 * carries no species name anywhere). It keeps the bare `0` key so it still
 * gets an availability tile - `poke_0` translates to "Substitute", which is
 * how a mystery reward is meant to render. Folding it to `''` instead would
 * drop the tile and hide every such quest, since reward type 7 is excluded
 * from the generic `u<type>` fallback. A form is meaningless for an unknown
 * species, so the form is ignored for id `0` to guarantee exactly one tile.
 *
 * @param {number|string|null|undefined} pokemonId
 * @param {number|string|null|undefined} form scanner form; unset = absent/`null`/`0`
 * @param {number|string|null|undefined} defaultForm masterfile `defaultFormId`
 * @returns {string} `''` only when the id is absent or not a number
 */
const getCanonicalQuestPokemonKey = (pokemonId, form, defaultForm) => {
  // `Number(null)`/`Number('')` are both 0, which species 0 now treats as a
  // real (undisclosed) reward - so reject the absent cases before coercing,
  // or a reward with no species at all would claim the Substitute tile.
  if (pokemonId === null || pokemonId === undefined || pokemonId === '')
    return ''
  const id = Number(pokemonId)
  if (!Number.isFinite(id) || id < 0) return ''
  // Undisclosed reward: one "Substitute" tile, regardless of any form.
  if (id === 0) return '0'

  const numericForm = Number(form)
  const hasExplicitForm =
    form !== null &&
    form !== undefined &&
    form !== '' &&
    Number.isFinite(numericForm) &&
    numericForm > 0
  // A genuine non-zero form (regional/alt variant) is authoritative - keep it.
  if (hasExplicitForm) return `${id}-${numericForm}`

  // Unset / `0`: fold onto the species default form when it is a real non-zero
  // form; otherwise keep the bare species key (no merge, no mis-merge).
  const numericDefault = Number(defaultForm)
  const hasDefault =
    defaultForm !== null &&
    defaultForm !== undefined &&
    defaultForm !== '' &&
    Number.isFinite(numericDefault) &&
    numericDefault > 0
  return hasDefault ? `${id}-${numericDefault}` : `${id}`
}

module.exports = { getCanonicalQuestPokemonKey }
