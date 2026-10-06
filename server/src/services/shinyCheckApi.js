// @ts-check
const { randomUUID } = require('crypto')
const { default: fetch } = require('node-fetch')

const config = require('@rm/config')
const { log, TAGS } = require('@rm/logger')

const EARTH_RADIUS_KM = 6371

const LEAGUES = ['little_max_level', 'great_max_level', 'ultra_max_level']

/** @returns {any} */
const getConfig = () => config.getSafe('scanner.shinyCheck')

/**
 * The backend wants a Golbat endpoint and secret to read from. Most maps
 * already have exactly that in their database schemas, so fall back to it
 * rather than making admins copy the same credentials into a second place.
 *
 * @returns {{ endpoint: string, secret: string } | null}
 */
function getGolbat() {
  const { golbat } = getConfig()
  if (golbat?.endpoint) return golbat

  const schema = config
    .getSafe('database.schemas')
    .find((db) => db.type === 'golbat' && db.endpoint)
  return schema
    ? { endpoint: schema.endpoint, secret: schema.secret ?? '' }
    : null
}

/**
 * @param {number} degrees
 * @returns {number}
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * Spherical area of a lat/lon box in km². Deliberately the same formula the
 * octillery frontend uses, so the limit we show is the limit the backend
 * enforces - a mismatch would reject the request after the round trip.
 *
 * @param {{ min: { lat: number, lon: number }, max: { lat: number, lon: number } }} bbox
 * @returns {number}
 */
function getAreaKm2(bbox) {
  const latitudeBand = Math.abs(
    Math.sin(toRadians(bbox.max.lat)) - Math.sin(toRadians(bbox.min.lat)),
  )
  const longitudeSpan = Math.abs(toRadians(bbox.max.lon - bbox.min.lon))
  return EARTH_RADIUS_KM * EARTH_RADIUS_KM * latitudeBand * longitudeSpan
}

/**
 * @param {boolean} shundo
 * @returns {number}
 */
function getAreaLimitKm2(shundo) {
  const { areaLimitKm2, shundoAreaLimitKm2 } = getConfig()
  return shundo ? shundoAreaLimitKm2 : areaLimitKm2
}

/**
 * @param {unknown} value
 * @param {number} limit
 * @returns {number | null}
 */
function readCoordinate(value, limit) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null
  return parsed
}

/**
 * Validates the browser's request and returns the fields the backend wants.
 * Identity is never read from here - the resolver supplies the Discord ID.
 *
 * @param {Record<string, any>} args
 * @returns {{ error: string } | { fields: Record<string, any> }}
 */
function buildRequest(args) {
  const { maxPvpRank, areaTolerance } = getConfig()
  const golbat = getGolbat()

  if (!golbat) {
    return { error: 'shiny_check_not_configured' }
  }

  const minLat = readCoordinate(args.bbox?.min?.lat, 90)
  const minLon = readCoordinate(args.bbox?.min?.lon, 180)
  const maxLat = readCoordinate(args.bbox?.max?.lat, 90)
  const maxLon = readCoordinate(args.bbox?.max?.lon, 180)

  if (
    minLat === null ||
    minLon === null ||
    maxLat === null ||
    maxLon === null ||
    minLat >= maxLat ||
    minLon >= maxLon
  ) {
    return { error: 'shiny_check_invalid_area' }
  }

  const shundo = !!args.shundo
  const filters = { shundo }
  LEAGUES.forEach((league) => {
    const rank = Number(args[league]) || 0
    filters[league] = Math.min(Math.max(Math.trunc(rank), 0), maxPvpRank)
  })

  const bbox = {
    min: { lat: minLat, lon: minLon },
    max: { lat: maxLat, lon: maxLon },
  }
  const areaKm2 = getAreaKm2(bbox)
  const limitKm2 = getAreaLimitKm2(shundo)
  if (areaKm2 > limitKm2 * areaTolerance) {
    return { error: 'shiny_check_area_too_large' }
  }

  return { fields: { bbox, ...filters, golbat } }
}

/**
 * Every call to the octillery backend goes through here so the API secret is
 * only ever read server side. The backend trusts whatever discord_id it is
 * given once that secret matches, so callers must pass the signed-in user's ID
 * and never anything supplied by the browser.
 *
 * @param {'GET' | 'POST'} method
 * @param {string} path
 * @param {Record<string, any>} [body]
 * @returns {Promise<{ statusCode: number, payload: any }>}
 */
async function callBackend(method, path, body) {
  const { backendUrl, apiSecret, requestTimeoutMs } = getConfig()
  if (!backendUrl || backendUrl.includes('ip:port')) {
    throw new Error('shiny_check_not_configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

  try {
    const response = await fetch(`${backendUrl}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(apiSecret ? { 'x-octillery-api-secret': apiSecret } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (response.status === 401) {
      log.warn(
        TAGS.scanner,
        'octillery rejected the shiny check API secret, check scanner.shinyCheck.apiSecret',
      )
      throw new Error('shiny_check_rejected')
    }
    return { statusCode: response.status, payload }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * The cooldown is shared with the Discord bot, so the backend is the only
 * source of truth for it - never start the countdown from a local timer.
 *
 * @param {string} discordId
 * @returns {Promise<{ cooldownSeconds: number, cooldownSecondsRemaining: number, inProgress: boolean, allowed: boolean }>}
 */
async function getStatus(discordId) {
  const { defaultCooldownSeconds } = getConfig()
  const fallback = {
    cooldownSeconds: defaultCooldownSeconds,
    cooldownSecondsRemaining: 0,
    inProgress: false,
    allowed: false,
  }
  if (!discordId) return fallback

  try {
    const { statusCode, payload } = await callBackend(
      'GET',
      `/api/v5/shinycheck/status/${encodeURIComponent(discordId)}`,
    )
    if (statusCode < 200 || statusCode >= 300 || !payload?.data) return fallback
    return {
      cooldownSeconds:
        Number(payload.data.cooldown_seconds) || defaultCooldownSeconds,
      cooldownSecondsRemaining:
        Number(payload.data.cooldown_seconds_remaining) || 0,
      inProgress: !!payload.data.in_progress,
      allowed: payload.data.allowed !== false,
    }
  } catch (e) {
    log.warn(TAGS.scanner, 'shiny check status failed:', e.message)
    return fallback
  }
}

/**
 * Maps one backend candidate onto ReactMap's own Pokemon shape so the existing
 * marker and popup render it. The pvp payload comes from the same Golbat these
 * maps already read, so it is passed through untouched.
 *
 * @param {Record<string, any>} candidate
 * @param {number} index
 * @returns {Record<string, any>}
 */
function toPokemon(candidate, index) {
  const atk = candidate.attack_iv
  const def = candidate.defense_iv
  const sta = candidate.stamina_iv
  const hasIvs = [atk, def, sta].every((x) => x !== null && x !== undefined)
  const expire = Number(candidate.expire_timestamp) || 0

  return {
    id: `shinyCheck-${candidate.id ?? candidate.encounter_id ?? index}`,
    encounter_id: Number(candidate.encounter_id) || 0,
    lat: Number(candidate.latitude),
    lon: Number(candidate.longitude),
    pokemon_id: Number(candidate.pokemon_id) || 0,
    form: Number(candidate.form) || 0,
    costume: Number(candidate.costume) || 0,
    gender: Number(candidate.gender) || 0,
    cp: Number(candidate.cp) || null,
    level: Number(candidate.level) || null,
    atk_iv: hasIvs ? Number(atk) : null,
    def_iv: hasIvs ? Number(def) : null,
    sta_iv: hasIvs ? Number(sta) : null,
    iv: hasIvs
      ? Math.round(((Number(atk) + Number(def) + Number(sta)) / 45) * 10000) /
        100
      : null,
    move_1: Number(candidate.move_1) || null,
    move_2: Number(candidate.move_2) || null,
    weather: Number(candidate.weather) || 0,
    seen_type: 'encounter',
    expire_timestamp: expire,
    expire_timestamp_verified: expire > 0,
    first_seen_timestamp: Number(candidate.first_seen_timestamp) || 0,
    updated: Math.floor(Date.now() / 1000),
    cleanPvp:
      candidate.pvp && typeof candidate.pvp === 'object' ? candidate.pvp : {},
  }
}

/**
 * Runs a shiny check for the signed-in user.
 *
 * @param {string} discordId the signed-in user's Discord ID, server side only
 * @param {Record<string, any>} args
 * @returns {Promise<Record<string, any>>}
 */
async function shinyCheckApi(discordId, args) {
  const { frontendId } = getConfig()

  if (!discordId) {
    return {
      status: 'error',
      message: 'shiny_check_no_discord',
      candidates: [],
    }
  }

  const built = buildRequest(args)
  if ('error' in built) {
    return { status: 'error', message: built.error, candidates: [] }
  }

  try {
    const { statusCode, payload } = await callBackend(
      'POST',
      '/api/v5/shinycheck/check',
      {
        ...built.fields,
        request_id: randomUUID(),
        discord_id: discordId,
        frontend_id: frontendId,
      },
    )

    if (statusCode < 200 || statusCode >= 300) {
      log.warn(
        TAGS.scanner,
        'shiny check failed for',
        discordId,
        statusCode,
        payload?.error?.code || '',
      )
      return {
        status: 'error',
        message: payload?.error?.message || 'shiny_check_failed',
        candidates: [],
      }
    }

    const result = payload?.data ?? {}
    const candidates = Array.isArray(result.candidates) ? result.candidates : []

    return {
      status: 'ok',
      message: '',
      scanned: Number(result.scanned) || 0,
      possibleShinies: Number(result.possible_shinies) || candidates.length,
      messagesSent: Number(result.messages_sent) || 0,
      candidates: candidates.map(toPokemon),
    }
  } catch (e) {
    log.warn(TAGS.scanner, 'shiny check error:', e.message)
    return { status: 'error', message: e.message, candidates: [] }
  }
}

module.exports = {
  shinyCheckApi,
  getStatus,
  getAreaKm2,
  getAreaLimitKm2,
  buildRequest,
}
