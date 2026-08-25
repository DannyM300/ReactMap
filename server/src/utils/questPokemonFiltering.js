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
 * @param {number|string|null|undefined} pokemonId
 * @param {number|string|null|undefined} form scanner form; unset = absent/`null`/`0`
 * @param {number|string|null|undefined} defaultForm masterfile `defaultFormId`
 * @returns {string} `''` when the id is invalid
 */
const getCanonicalQuestPokemonKey = (pokemonId, form, defaultForm) => {
  const id = Number(pokemonId)
  if (!Number.isFinite(id) || id <= 0) return ''

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
