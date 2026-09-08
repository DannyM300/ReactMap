const DITTO_ID = 132

export const getWildFilterId = (pokemonId, formId = 0, defaultFormId = 0) => {
  const normalizedPokemonId = Number.parseInt(`${pokemonId}`, 10)
  const normalizedFormId = Number.parseInt(`${formId ?? 0}`, 10)
  if (normalizedPokemonId === DITTO_ID) {
    return `${DITTO_ID}-0`
  }
  const normalizedDefaultFormId = Number.parseInt(`${defaultFormId ?? 0}`, 10)
  const canonicalFormId =
    (Number.isNaN(normalizedFormId) || normalizedFormId === 0) &&
    !Number.isNaN(normalizedDefaultFormId) &&
    normalizedDefaultFormId > 0
      ? normalizedDefaultFormId
      : normalizedFormId
  return `${Number.isNaN(normalizedPokemonId) ? 0 : normalizedPokemonId}-${
    Number.isNaN(canonicalFormId) ? 0 : canonicalFormId
  }`
}
