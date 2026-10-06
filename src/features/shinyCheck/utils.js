// @ts-check

const EARTH_RADIUS_KM = 6371

/**
 * @typedef {{ lat: number, lon: number }} ShinyCheckPoint
 * @typedef {{ min: ShinyCheckPoint, max: ShinyCheckPoint }} ShinyCheckBbox
 */

/**
 * @param {number} degrees
 * @returns {number}
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * Spherical area of a lat/lon box in km². Matches the server and the octillery
 * backend exactly, so the number shown here is the number that gets enforced.
 *
 * @param {import('./utils').ShinyCheckBbox} bbox
 * @returns {number}
 */
export function getAreaKm2(bbox) {
  const latitudeBand = Math.abs(
    Math.sin(toRadians(bbox.max.lat)) - Math.sin(toRadians(bbox.min.lat)),
  )
  const longitudeSpan = Math.abs(toRadians(bbox.max.lon - bbox.min.lon))
  return EARTH_RADIUS_KM * EARTH_RADIUS_KM * latitudeBand * longitudeSpan
}

/**
 * A square-ish box of `km2` around a point, used to shrink an over-sized
 * viewport down to the largest area the backend will accept.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} km2
 * @returns {import('./utils').ShinyCheckBbox}
 */
export function boxAround(lat, lon, km2) {
  const sideKm = Math.sqrt(km2)
  const halfLat = (sideKm / 2 / EARTH_RADIUS_KM) * (180 / Math.PI)
  const cosLat = Math.max(Math.cos(toRadians(lat)), 0.01)
  const halfLon = halfLat / cosLat
  return {
    min: {
      lat: Math.max(lat - halfLat, -90),
      lon: Math.max(lon - halfLon, -180),
    },
    max: {
      lat: Math.min(lat + halfLat, 90),
      lon: Math.min(lon + halfLon, 180),
    },
  }
}

/**
 * Turns the current viewport into the box we will actually check: the view
 * itself when it is small enough, otherwise the biggest allowed box centred on
 * it. Returning a valid box always beats refusing the request.
 *
 * @param {import('leaflet').LatLngBounds} bounds
 * @param {number} limitKm2
 * @returns {{ bbox: import('./utils').ShinyCheckBbox, areaKm2: number, clamped: boolean }}
 */
export function getCheckArea(bounds, limitKm2) {
  const bbox = {
    min: { lat: bounds.getSouth(), lon: bounds.getWest() },
    max: { lat: bounds.getNorth(), lon: bounds.getEast() },
  }
  const areaKm2 = getAreaKm2(bbox)
  if (areaKm2 <= limitKm2) {
    return { bbox, areaKm2, clamped: false }
  }
  const center = bounds.getCenter()
  const clampedBox = boxAround(center.lat, center.lng, limitKm2)
  return { bbox: clampedBox, areaKm2: getAreaKm2(clampedBox), clamped: true }
}
