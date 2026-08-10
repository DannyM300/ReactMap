// @ts-check
import * as React from 'react'
import TuneIcon from '@mui/icons-material/Tune'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'

import { useTranslateById } from '@hooks/useTranslateById'
import { useMemory } from '@store/useMemory'
import { ColoredTile } from '@components/virtual/ColoredTile'
import { ToggleTypography } from '@components/ToggleTypography'
import { SQUARE_ITEM } from '@components/virtual/VirtualGrid'
import { StatusIcon } from '@components/StatusIcon'
import { useTranslation } from 'react-i18next'

/**
 * @template {string} T
 * @typedef {{
 *  id: string,
 *  category: T,
 *  caption?: boolean
 * }} BaseProps
 */

/**
 * @typedef {{
 *  id: string,
 *  filter: any, // TODO: fix this
 *  setFilter: (value: any) => void
 *  onClick: () => void
 *  hasAll?: boolean
 *  easyMode?: boolean
 *  caption?: boolean
 * }} FullProps
 */

/** @param {FullProps} props */
export function SelectorItem({
  id,
  category,
  filter,
  setFilter,
  onClick,
  hasAll,
  easyMode,
}) {
  const { t } = useTranslateById({
    alt: true,
    newLine: true,
    quest: category === 'pokestops',
    omitFormSuffix: true,
    showDefaultForms: id.startsWith('a'),
  })
  const title = t(id)
  const url = useMemory((s) => s.Icons.getIconById(id))
  const isTask = id.startsWith('k')

  const color = filter?.enabled
    ? filter?.all || !hasAll || easyMode
      ? 'success.main'
      : 'info.main'
    : 'error.dark'

  const handleClick = React.useCallback(() => {
    const newFilter = { all: false, enabled: false, ...filter }
    // red => green => blue => red
    if (newFilter.all && hasAll) {
      newFilter.all = false
      newFilter.enabled = !easyMode
    } else if (newFilter.enabled) {
      newFilter.enabled = false
    } else {
      if (hasAll) newFilter.all = true
      newFilter.enabled = true
    }
    setFilter(newFilter)
  }, [filter, setFilter, hasAll, easyMode])

  /** @type {import('@mui/material').IconButtonProps['onClick']} */
  const handleIconClick = React.useCallback(
    (e) => {
      e.stopPropagation()
      onClick()
    },
    [onClick],
  )

  const status =
    hasAll && !easyMode
      ? filter?.all || filter?.enabled
        ? filter?.all && filter?.enabled
          ? true
          : null
        : false
      : filter?.enabled

  return (
    <Box
      className="vgrid-item"
      position="relative"
      minWidth="100%"
      minHeight="100%"
      sx={SQUARE_ITEM}
      onClick={handleClick}
    >
      <ColoredTile bgcolor={color} />
      {isTask ? (
        <TaskRewardCollage id={id} title={title} fallbackUrl={url} />
      ) : (
        <Tooltip
          title={process.env.NODE_ENV === 'development' ? id : title}
          arrow
          className="vgrid-image"
        >
          <Box
            component="img"
            alt={title}
            src={url}
            maxHeight="50%"
            maxWidth="50%"
            zIndex={10}
            sx={{ aspectRatio: '1/1', objectFit: 'contain' }}
          />
        </Tooltip>
      )}
      <IconButton className="vgrid-icon" size="small" onClick={handleIconClick}>
        <TuneIcon fontSize="small" />
      </IconButton>
      <Status status={status} />
      <ToggleTypography
        className="vgrid-caption"
        variant="caption"
        fontWeight="bold"
        zIndex={10}
        alignSelf="end"
        px={1}
      >
        {title && title.split('\n').at(-1).replace(/[()]/g, '')}
      </ToggleTypography>
    </Box>
  )
}

/** @param {{ id: string, title: string, fallbackUrl: string }} props */
function TaskRewardCollage({ id, title, fallbackUrl }) {
  const Icons = useMemory((s) => s.Icons)
  const taskRewards = useMemory((s) => s.available.taskConditions[id]?.rewards)
  const rewards = taskRewards || []
  const hasOverflow = rewards.length > 4
  const visibleRewards = hasOverflow ? rewards.slice(0, 3) : rewards.slice(0, 4)
  const slots = visibleRewards.length + (hasOverflow ? 1 : 0)
  const columns = visibleRewards.length === 1 ? 1 : 2
  const rows = slots > 2 ? 2 : 1

  return (
    <Tooltip
      title={process.env.NODE_ENV === 'development' ? id : title}
      arrow
      className="vgrid-image"
    >
      {visibleRewards.length ? (
        <Box
          display="grid"
          gridTemplateColumns={`repeat(${columns}, 1fr)`}
          gridTemplateRows={`repeat(${rows}, 1fr)`}
          gap="2px"
          width="54%"
          height="54%"
          zIndex={10}
        >
          {visibleRewards.map((reward) => (
            <Box
              component="img"
              key={reward}
              alt=""
              src={Icons.getIconById(reward)}
              width="100%"
              height="100%"
              minWidth={0}
              sx={{ objectFit: 'contain' }}
            />
          ))}
          {hasOverflow && (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="50%"
              bgcolor="rgba(0, 0, 0, 0.65)"
              color="common.white"
              fontSize="0.7rem"
              fontWeight="bold"
              sx={{ aspectRatio: '1/1' }}
            >
              +{rewards.length - visibleRewards.length}
            </Box>
          )}
        </Box>
      ) : (
        <Box
          component="img"
          alt={title}
          src={fallbackUrl}
          maxHeight="50%"
          maxWidth="50%"
          zIndex={10}
          sx={{ aspectRatio: '1/1', objectFit: 'contain' }}
        />
      )}
    </Tooltip>
  )
}

/** @param {{ status: null | boolean }} props */
function Status({ status }) {
  const { t } = useTranslation()
  return (
    <Tooltip
      title={
        status === null
          ? t('individual_filters')
          : status
            ? t('enabled')
            : t('disabled')
      }
    >
      <StatusIcon
        className="vgrid-color-blind-icon"
        fontSize="small"
        color="action"
        status={status}
      />
    </Tooltip>
  )
}
