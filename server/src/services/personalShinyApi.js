// @ts-check
const config = require('@rm/config')
const { log, TAGS } = require('@rm/logger')

const { shinyRoll, isRollable } = require('../utils/shinyRoll')
const { getAreaKm2 } = require('./shinyCheckApi')

/** @returns {any} */
const getConfig = () => config.getSafe('scanner.shinyCheck.personal')

/**
 * The spawn source. Personal rolls need the encounter ID, which Golbat returns
 * as the row's `id` - it does not send an `encounter_id` field at all.
 *
 * @returns {{ endpoint: string, secret: string } | null}
 */
function getGolbat() {
  const configured = config.getSafe('scanner.shinyCheck').golbat
  if (configured?.endpoint) return configured
  const schema = config
    .getSafe('database.schemas')
    .find((db) => db.type === 'golbat' && db.endpoint)
  return schema
    ? { endpoint: schema.endpoint, secret: schema.secret ?? '' }
    : null
}

/**
 * Maps a raw Golbat row onto ReactMap's Pokemon shape. Golbat rows are already
 * almost exactly that shape - this mostly namespaces the id and lifts `pvp`
 * onto `cleanPvp` so the normal popup renders.
 *
 * @param {Record<string, any>} spawn
 * @param {number} roll
 * @returns {Record<string, any>}
 */
function toPokemon(spawn, roll) {
  return {
    ...spawn,
    id: `personalShiny-${spawn.id}`,
    encounter_id: String(spawn.id),
    shinyRoll: roll,
    cleanPvp: spawn.pvp && typeof spawn.pvp === 'object' ? spawn.pvp : {},
  }
}

/**
 * Finds the spawns in `bbox` that would be shiny for `playerId`.
 *
 * Nothing here touches the octillery backend: the roll is computed locally from
 * the encounter ID and the player's own ID, so this needs no API secret and has
 * no cooldown.
 *
 * @param {string} playerId the account's raw player ID, supplied by the user
 * @param {{ min: { lat: number, lon: number }, max: { lat: number, lon: number } }} bbox
 * @param {number} oneInN the odds denominator, e.g. 512 for a 1/512 rate
 * @returns {Promise<Record<string, any>>}
 */
async function personalShinyApi(playerId, bbox, oneInN) {
  const { enabled, areaLimitKm2, maxSpawns, minOneInN, maxOneInN } = getConfig()

  if (!enabled) {
    return {
      status: 'error',
      message: 'personal_shiny_disabled',
      candidates: [],
    }
  }
  if (typeof playerId !== 'string' || !playerId.trim()) {
    return {
      status: 'error',
      message: 'personal_shiny_no_player_id',
      candidates: [],
    }
  }

  const denominator = Math.round(Number(oneInN) || 0)
  if (
    !Number.isFinite(denominator) ||
    denominator < minOneInN ||
    denominator > maxOneInN
  ) {
    return {
      status: 'error',
      message: 'personal_shiny_bad_odds',
      candidates: [],
    }
  }

  const areaKm2 = getAreaKm2(bbox)
  if (!Number.isFinite(areaKm2) || areaKm2 <= 0) {
    return {
      status: 'error',
      message: 'personal_shiny_invalid_area',
      candidates: [],
    }
  }
  if (areaKm2 > areaLimitKm2) {
    return {
      status: 'error',
      message: 'personal_shiny_area_too_large',
      candidates: [],
    }
  }

  const golbat = getGolbat()
  if (!golbat) {
    return {
      status: 'error',
      message: 'personal_shiny_no_source',
      candidates: [],
    }
  }

  let rows
  try {
    const response = await fetch(`${golbat.endpoint}/api/pokemon/v2/scan`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(golbat.secret ? { 'X-Golbat-Secret': golbat.secret } : {}),
      },
      body: JSON.stringify({
        min: { latitude: bbox.min.lat, longitude: bbox.min.lon },
        max: { latitude: bbox.max.lat, longitude: bbox.max.lon },
        limit: maxSpawns,
        filters: [{ pokemon: [{ id: 0 }] }],
      }),
      signal: AbortSignal.timeout(20000),
    })
    rows = await response.json()
  } catch (e) {
    log.warn(TAGS.scanner, 'personal shiny source failed:', e.message)
    return {
      status: 'error',
      message: 'personal_shiny_source_failed',
      candidates: [],
    }
  }

  if (!Array.isArray(rows)) {
    return {
      status: 'error',
      message: 'personal_shiny_source_failed',
      candidates: [],
    }
  }

  const rate = 1 / denominator
  const trimmed = playerId.trim()
  const rollable = rows.filter(isRollable)

  const candidates = rollable.reduce((acc, spawn) => {
    try {
      const roll = shinyRoll(trimmed, String(spawn.id))
      if (roll < rate) acc.push(toPokemon(spawn, roll))
    } catch {
      // A malformed encounter ID just means this spawn cannot be rolled.
    }
    return acc
  }, /** @type {Record<string, any>[]} */ ([]))

  const rolled = rollable.length

  return {
    status: 'ok',
    message: '',
    scanned: rows.length,
    rolled,
    possibleShinies: candidates.length,
    candidates,
  }
}

module.exports = { personalShinyApi }
