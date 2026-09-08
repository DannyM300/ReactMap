const DITTO_ID = 132

const normalizePokemonId = (pokemonId) => {
  const parsedPokemonId = Number.parseInt(`${pokemonId}`, 10)
  return Number.isNaN(parsedPokemonId) ? 0 : parsedPokemonId
}

const normalizePokemonForm = (pokemonId, formId = 0) => {
  if (normalizePokemonId(pokemonId) === DITTO_ID) {
    // Confirmed wild Ditto is already treated as species-based upstream.
    // Golbat/MEM keeps the scanner lookup on `pokemon_id = 132, form = 0`,
    // while the raw form field may still carry the disguise form for display.
    return 0
  }
  const parsedFormId = Number.parseInt(`${formId ?? 0}`, 10)
  return Number.isNaN(parsedFormId) ? 0 : parsedFormId
}

const getWildFilterForm = (pokemonId, formId = 0, defaultFormId = 0) => {
  const normalizedForm = normalizePokemonForm(pokemonId, formId)
  const normalizedDefault = normalizePokemonForm(pokemonId, defaultFormId)
  return normalizePokemonId(pokemonId) !== DITTO_ID &&
    normalizedForm === 0 &&
    normalizedDefault > 0
    ? normalizedDefault
    : normalizedForm
}

const getWildFilterKey = (pokemonId, formId = 0, defaultFormId = 0) =>
  `${normalizePokemonId(pokemonId)}-${getWildFilterForm(
    pokemonId,
    formId,
    defaultFormId,
  )}`

/**
 * Golbat filters remain form-exact, so a canonical default-form selection
 * must request both the explicit default and scanner form 0. Final matching
 * canonicalises both rows back onto the one drawer key.
 */
const getWildFilterPairs = (pokemonId, formId = 0, defaultFormId = 0) => {
  const id = normalizePokemonId(pokemonId)
  const form = getWildFilterForm(id, formId, defaultFormId)
  const pairs = [{ id, form }]
  if (id !== DITTO_ID && form > 0 && form === Number(defaultFormId)) {
    pairs.push({ id, form: 0 })
  }
  return pairs
}

module.exports = {
  DITTO_ID,
  getWildFilterKey,
  getWildFilterPairs,
}
