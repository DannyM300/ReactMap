// @ts-check
import * as React from 'react'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import { useTranslation } from 'react-i18next'

import { useMemory } from '@store/useMemory'
import { useDeepStore } from '@store/useStorage'
import { useTranslateById } from '@hooks/useTranslateById'
import { FCSelect } from '@components/inputs/FCSelect'

/**
 * The reverse of QuestConditionSelector: narrows a task-primary filter
 * (`k<title>-<target>`) down to specific reward keys, instead of narrowing a
 * reward-primary filter down to specific task conditions. Same `.adv`
 * mechanism, same UI shape, opposite direction.
 * @param {{ id: string }} props
 * @returns
 */
export function TaskRewardSelector({ id }) {
  const { t } = useTranslation()
  const { t: tId } = useTranslateById()
  const [filter, setFilter] = useDeepStore(`filters.pokestops.filter.${id}`)
  const value = filter?.adv || ''
  const all = !!filter?.all
  const taskRewards = useMemory((s) => s.available.taskConditions[id]?.rewards)
  const hasQuests = useMemory((s) => s.ui.pokestops?.quests)

  // Prune-only: keep the enabled/all state exactly as-is. Used by the
  // availability-validation effect so a reload never auto-enables a filter
  // that merely carries a (still-valid) narrowing.
  const pruneAdv = React.useCallback(
    (adv) => setFilter((prev) => ({ ...prev, adv })),
    [setFilter],
  )
  // A user actively picking rewards turns the tile blue (enabled + narrowed);
  // picking "All" enables + goes green. Both are also what lets the
  // reward<->task mirror propagate the choice - a disabled source counts as
  // "nothing selected".
  const narrowTo = React.useCallback(
    (adv) => setFilter((prev) => ({ ...prev, adv, enabled: true, all: false })),
    [setFilter],
  )
  const selectAll = React.useCallback(
    () => setFilter((prev) => ({ ...prev, adv: '', enabled: true, all: true })),
    [setFilter],
  )

  const [open, setOpen] = React.useState(false)

  const handleClose = () => setOpen(false)

  const handleOpen = () => setOpen(true)

  // Provides a reset if that reward is no longer available
  React.useEffect(() => {
    if (hasQuests) {
      // user has quest permissions
      if (!taskRewards && value) {
        // reward is no longer available
        pruneAdv('')
      } else {
        // check if the value is still valid
        const filtered = taskRewards
          ? value.split(',').filter((each) => taskRewards.includes(each))
          : []
        pruneAdv(filtered.length ? filtered.join(',') : '')
      }
    } else {
      // user does not have quest permissions
      pruneAdv('')
    }
  }, [taskRewards, id, hasQuests])

  if (!taskRewards) return null

  return (
    <FCSelect
      label={t('task_reward')}
      value={value.split(',')}
      disabled={all}
      fullWidth
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      multiple
      renderValue={(selected) =>
        Array.isArray(selected)
          ? `${selected.length} ${t('selected')}`
          : selected
      }
      onChange={(e, child) => {
        if (
          typeof child === 'object' &&
          'props' in child &&
          child.props.value === ''
        ) {
          selectAll()
          handleClose()
        } else {
          const next = Array.isArray(e.target.value)
            ? e.target.value.filter(Boolean).join(',')
            : e.target.value
          if (next) narrowTo(next)
          else selectAll()
          if (e.target.value.length === 0) handleClose()
        }
      }}
      fcSx={{ my: 1 }}
    >
      <MenuItem value="">
        <Typography variant="caption">{t('all')}</Typography>
      </MenuItem>
      {taskRewards
        .slice()
        .sort((a, b) => tId(a).localeCompare(tId(b)))
        .map((rewardKey) => (
          <MenuItem key={rewardKey} value={rewardKey}>
            {tId(rewardKey, { omitFormSuffix: true })}
          </MenuItem>
        ))}
    </FCSelect>
  )
}
