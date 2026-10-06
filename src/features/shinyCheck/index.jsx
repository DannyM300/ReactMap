// @ts-check
import * as React from 'react'
import { Marker, Popup, Rectangle, useMapEvents } from 'react-leaflet'
import { useLazyQuery } from '@apollo/client'
import List from '@mui/material/List'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import ClearIcon from '@mui/icons-material/Clear'
import { Trans, useTranslation } from 'react-i18next'

import { fallbackMarker } from '@assets/fallbackMarker'
import { DividerWithMargin } from '@components/StyledDivider'
import { SHINY_CHECK, SHINY_CHECK_CONFIG } from '@services/queries/shinyCheck'
import {
  StyledListItem,
  StyledListButton,
  StyledListItemText,
} from '@features/scanner/Shared'

import { useShinyCheckStore } from './hooks/store'
import { getCheckArea } from './utils'
import { ShinyCheckResults } from './ShinyCheckResults'

const LEAGUES = /** @type {const} */ ([
  'little_max_level',
  'great_max_level',
  'ultra_max_level',
])

const RECTANGLE_STYLE = { color: '#FFD700', weight: 2 }

/**
 * @param {{ maxPvpRank: number }} props
 * @returns {React.JSX.Element}
 */
function PvpFilters({ maxPvpRank }) {
  const { t } = useTranslation()
  const store = useShinyCheckStore()

  return (
    <>
      {LEAGUES.map((league) => (
        <StyledListItem key={league}>
          <ListItemText primary={t(`shiny_check_${league}`)} />
          <Select
            size="small"
            variant="standard"
            value={store[league]}
            onChange={({ target }) =>
              useShinyCheckStore.setState({ [league]: Number(target.value) })
            }
          >
            {Array.from({ length: maxPvpRank + 1 }, (_, i) => (
              <MenuItem key={i} value={i}>
                {i === 0 ? t('shiny_check_rank_off') : i}
              </MenuItem>
            ))}
          </Select>
        </StyledListItem>
      ))}
    </>
  )
}

/**
 * The shiny check control. Mirrors the scanNext/scanZone flow - a map overlay
 * with its own popup rather than a modal - so the map stays interactive while
 * the area is chosen.
 *
 * @returns {React.JSX.Element}
 */
export function ShinyCheck() {
  const { t } = useTranslation()
  const mode = useShinyCheckStore((s) => s.mode)
  const shundo = useShinyCheckStore((s) => s.shundo)
  const cooldown = useShinyCheckStore((s) => s.cooldown)
  const error = useShinyCheckStore((s) => s.error)

  const [bounds, setBounds] = React.useState(
    /** @type {import('leaflet').LatLngBounds | null} */ (null),
  )

  const map = useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
  })

  const [getConfig, { data: configData }] = useLazyQuery(SHINY_CHECK_CONFIG, {
    fetchPolicy: 'network-only',
  })
  const remoteConfig = configData?.shinyCheckConfig

  const [runCheck, { loading }] = useLazyQuery(SHINY_CHECK, {
    fetchPolicy: 'network-only',
    onCompleted: ({ shinyCheck }) => {
      if (!shinyCheck || shinyCheck.status !== 'ok') {
        useShinyCheckStore.setState({
          mode: 'setArea',
          error: shinyCheck?.message || 'shiny_check_failed',
        })
        return
      }
      useShinyCheckStore.setState({
        mode: '',
        error: '',
        results: shinyCheck.candidates || [],
        scanned: shinyCheck.scanned,
        possibleShinies: shinyCheck.possibleShinies,
        messagesSent: shinyCheck.messagesSent,
        cooldown: shinyCheck.cooldownSeconds
          ? Date.now() + shinyCheck.cooldownSeconds * 1000
          : 0,
      })
    },
    onError: (e) =>
      useShinyCheckStore.setState({ mode: 'setArea', error: e.message }),
  })

  React.useEffect(() => {
    if (mode === 'setArea') {
      getConfig()
      setBounds(map.getBounds())
    }
  }, [mode, getConfig, map])

  // The cooldown is shared with the Discord bot, so the backend is the only
  // honest source for what is left of it.
  React.useEffect(() => {
    if (remoteConfig) {
      useShinyCheckStore.setState({
        cooldown: remoteConfig.cooldownSecondsRemaining
          ? Date.now() + remoteConfig.cooldownSecondsRemaining * 1000
          : 0,
      })
    }
  }, [remoteConfig])

  const [remainder, setRemainder] = React.useState(0)
  React.useEffect(() => {
    if (cooldown - Date.now() > 0) {
      const timeout = setTimeout(
        () => setRemainder(cooldown - Date.now()),
        1000,
      )
      return () => clearTimeout(timeout)
    }
    setRemainder(0)
    return undefined
  }, [remainder, cooldown])

  const limitKm2 = shundo
    ? remoteConfig?.shundoAreaLimitKm2 || 100
    : remoteConfig?.areaLimitKm2 || 25

  const area = React.useMemo(
    () => (bounds ? getCheckArea(bounds, limitKm2) : null),
    [bounds, limitKm2],
  )

  if (mode !== 'setArea' || !area) {
    return <ShinyCheckResults />
  }

  const center = /** @type {[number, number]} */ ([
    (area.bbox.min.lat + area.bbox.max.lat) / 2,
    (area.bbox.min.lon + area.bbox.max.lon) / 2,
  ])

  return (
    <>
      <ShinyCheckResults />
      <Rectangle
        bounds={[
          [area.bbox.min.lat, area.bbox.min.lon],
          [area.bbox.max.lat, area.bbox.max.lon],
        ]}
        pathOptions={RECTANGLE_STYLE}
      />
      <Marker
        icon={fallbackMarker}
        position={center}
        ref={(ref) => {
          if (ref && !ref.isPopupOpen()) ref.openPopup()
        }}
      >
        <Popup minWidth={180} maxWidth={260} autoPan={false}>
          <List>
            <StyledListItemText
              className="no-leaflet-margin"
              secondary={t('shiny_check_choose')}
            />
            <DividerWithMargin />
            <StyledListItem>
              <ListItemText
                primary={
                  <Trans
                    i18nKey="shiny_check_area"
                    values={{
                      area: area.areaKm2.toFixed(1),
                      limit: limitKm2,
                    }}
                  />
                }
                secondary={area.clamped ? t('shiny_check_clamped') : ''}
                secondaryTypographyProps={{ component: 'span' }}
              />
            </StyledListItem>
            <StyledListItem>
              <ListItemText primary={t('shiny_check_shundo')} />
              <Switch
                checked={shundo}
                onChange={({ target }) =>
                  useShinyCheckStore.setState({ shundo: target.checked })
                }
              />
            </StyledListItem>
            <PvpFilters maxPvpRank={remoteConfig?.maxPvpRank || 10} />
            {!!error && (
              <StyledListItemText secondary={t(error)} role="alert" />
            )}
            <DividerWithMargin />
            <StyledListButton
              color="secondary"
              disabled={loading || remainder > 0 || remoteConfig?.inProgress}
              onClick={() => {
                const state = useShinyCheckStore.getState()
                useShinyCheckStore.setState({ mode: 'loading', error: '' })
                runCheck({
                  variables: {
                    bbox: area.bbox,
                    shundo: state.shundo,
                    little_max_level: state.little_max_level,
                    great_max_level: state.great_max_level,
                    ultra_max_level: state.ultra_max_level,
                  },
                })
              }}
            >
              <ListItemIcon>
                <AutoAwesome color="secondary" />
              </ListItemIcon>
              <ListItemText
                primary={
                  remainder > 0 ? (
                    <Trans
                      i18nKey="scanner_countdown"
                      values={{ time: Math.round(remainder / 1000) }}
                    />
                  ) : (
                    t('shiny_check_run')
                  )
                }
              />
            </StyledListButton>
            <StyledListButton
              color="primary"
              onClick={() =>
                useShinyCheckStore.setState({ mode: '', error: '' })
              }
            >
              <ListItemIcon>
                <ClearIcon color="primary" />
              </ListItemIcon>
              <ListItemText primary={t('cancel')} />
            </StyledListButton>
          </List>
        </Popup>
      </Marker>
    </>
  )
}
