// @ts-check

import { gql } from '@apollo/client'

export const SHINY_CHECK_CONFIG = gql`
  query ShinyCheckConfig {
    shinyCheckConfig {
      enabled
      ready
      blockingReason
      areaLimitKm2
      shundoAreaLimitKm2
      maxPvpRank
      cooldownSeconds
      cooldownSecondsRemaining
      inProgress
    }
  }
`

export const PERSONAL_SHINY_CONFIG = gql`
  query PersonalShinyConfig {
    personalShinyConfig {
      enabled
      defaultOneInN
      minOneInN
      maxOneInN
      areaLimitKm2
    }
  }
`

export const PERSONAL_SHINY = gql`
  query PersonalShiny($playerId: String, $bbox: JSON, $oneInN: Int) {
    personalShiny(playerId: $playerId, bbox: $bbox, oneInN: $oneInN) {
      status
      message
      scanned
      rolled
      possibleShinies
      candidates {
        id
        lat
        lon
        pokemon_id
        form
        gender
        costume
        seen_type
        expire_timestamp
        expire_timestamp_verified
        first_seen_timestamp
        updated
        iv
        cp
        level
        atk_iv
        def_iv
        sta_iv
        move_1
        move_2
        weather
        cleanPvp
      }
    }
  }
`

export const SHINY_CHECK = gql`
  query ShinyCheck(
    $bbox: JSON
    $shundo: Boolean
    $little_max_level: Int
    $great_max_level: Int
    $ultra_max_level: Int
  ) {
    shinyCheck(
      bbox: $bbox
      shundo: $shundo
      little_max_level: $little_max_level
      great_max_level: $great_max_level
      ultra_max_level: $ultra_max_level
    ) {
      status
      message
      scanned
      possibleShinies
      messagesSent
      cooldownSeconds
      candidates {
        id
        lat
        lon
        pokemon_id
        form
        gender
        costume
        seen_type
        expire_timestamp
        expire_timestamp_verified
        first_seen_timestamp
        updated
        iv
        cp
        level
        atk_iv
        def_iv
        sta_iv
        move_1
        move_2
        weather
        cleanPvp
      }
    }
  }
`
