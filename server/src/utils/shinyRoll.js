// @ts-check
/* eslint-disable no-bitwise -- the roll is defined as bit operations on a 48-bit LCG */
/* global BigInt */
const { createHash } = require('crypto')

const JAVA_MULTIPLIER = 0x5deece66dn
const JAVA_INCREMENT = 11n
const MASK_48 = (1n << 48n) - 1n
const TWO_24 = 16777216

/**
 * Reproduces the first `java.util.Random.nextFloat()` seeded from the
 * encounter's little-endian bytes followed by the account's raw player ID.
 *
 * This is the same roll implemented by PoracleNG's personalshiny service and
 * Diadem's roll-core; both agree byte for byte. Returns a number in [0, 1):
 * the spawn is shiny for that account when the roll is below the species rate.
 *
 * @param {string} playerId the account's raw player ID
 * @param {string | number | bigint} encounterId the spawn's encounter ID
 * @returns {number}
 */
function shinyRoll(playerId, encounterId) {
  if (typeof playerId !== 'string' || !playerId) {
    throw new Error('shiny_roll_invalid_player')
  }
  const asString = String(encounterId)
  if (!/^\d{1,20}$/.test(asString)) {
    throw new Error('shiny_roll_invalid_encounter')
  }
  const encounter = BigInt(asString)
  if (encounter > 0xffffffffffffffffn) {
    throw new Error('shiny_roll_invalid_encounter')
  }

  const bytes = Buffer.alloc(8)
  bytes.writeBigUInt64LE(encounter)

  const seed = createHash('sha1')
    .update(bytes)
    .update(playerId, 'utf8')
    .digest()
    .readBigUInt64LE()

  const state =
    ((seed ^ JAVA_MULTIPLIER) * JAVA_MULTIPLIER + JAVA_INCREMENT) & MASK_48

  return Number(state >> 24n) / TWO_24
}

/**
 * Whether a spawn can be rolled at all. Mirrors PoracleNG: Ditto is excluded
 * because its roll follows the disguise, and a spawn with no encounter has no
 * ID to seed from.
 *
 * @param {Record<string, any>} spawn a raw Golbat pokemon row
 * @returns {boolean}
 */
function isRollable(spawn) {
  if (!spawn) return false
  const id = String(spawn.id ?? '')
  if (!/^\d{1,20}$/.test(id)) return false
  if (Number(spawn.pokemon_id) === 132 || spawn.is_ditto) return false
  if (spawn.seen_type !== 'wild' && spawn.seen_type !== 'encounter')
    return false
  const display = Number(spawn.display_pokemon_id) || 0
  return display === 0 || display === Number(spawn.pokemon_id)
}

module.exports = { shinyRoll, isRollable }
