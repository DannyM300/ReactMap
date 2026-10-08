// @ts-check
import * as React from 'react'
import { Marker, Popup } from 'react-leaflet'

import { useMemory } from '@store/useMemory'
import { fancyPokemonMarker } from '@features/pokemon/pokemonMarker'
import { PokemonPopup } from '@features/pokemon/PokemonPopup'

import { useShinyCheckStore } from './hooks/store'

const SHINY_GLOW = '#FFD700'

/**
 * One shiny candidate, drawn with the map's own Pokemon marker and popup. The
 * server already mapped it onto ReactMap's Pokemon shape, so IVs, PvP ranks and
 * the despawn timer all render through the normal popup.
 *
 * @param {{ pokemon: import('@rm/types').Pokemon }} props
 * @returns {React.JSX.Element}
 */
function ShinyCandidate({ pokemon }) {
  const Icons = useMemory((s) => s.Icons)

  // The seventh argument is `shiny`: every candidate would be shiny for this
  // player, which is the whole point of the check.
  const iconUrl = Icons.getPokemon(
    pokemon.pokemon_id,
    pokemon.form,
    0,
    pokemon.gender,
    pokemon.costume,
    0,
    true,
  )
  const size = Icons.getSize('pokemon', 'md')

  return (
    <Marker
      position={[pokemon.lat, pokemon.lon]}
      icon={fancyPokemonMarker({
        pkmn: pokemon,
        iconUrl,
        iconSize: size,
        // The map already glows hundos red; gold reads as shiny and does not
        // collide with any rule the Pokemon layer uses.
        showGlow: SHINY_GLOW,
        showWeather: false,
        badge: '',
        opacity: 1,
        timeOfDay: 'day',
      })}
    >
      <Popup position={[pokemon.lat, pokemon.lon]}>
        <PokemonPopup pokemon={pokemon} iconUrl={iconUrl} />
      </Popup>
    </Marker>
  )
}

const MemoShinyCandidate = React.memo(
  ShinyCandidate,
  (prev, next) => prev.pokemon.id === next.pokemon.id,
)

/**
 * Candidates expire like any other spawn, so they are pruned on their own
 * timer rather than lingering until the next check.
 *
 * @returns {React.JSX.Element}
 */
export function ShinyCheckResults() {
  const results = useShinyCheckStore((s) => s.results)

  React.useEffect(() => {
    if (!results.length) return undefined
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const alive = useShinyCheckStore
        .getState()
        .results.filter((x) => !x.expire_timestamp || x.expire_timestamp > now)
      if (alive.length !== useShinyCheckStore.getState().results.length) {
        useShinyCheckStore.setState({ results: alive })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [results.length])

  return (
    <>
      {results.map((pokemon) => (
        <MemoShinyCandidate key={pokemon.id} pokemon={pokemon} />
      ))}
    </>
  )
}
