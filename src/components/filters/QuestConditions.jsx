// @ts-check
import * as React from 'react'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import { useTranslation } from 'react-i18next'

import { useMemory } from '@store/useMemory'
import { useDeepStore } from '@store/useStorage'
import { QuestTitle } from '@components/QuestTitle'
import { FCSelect } from '@components/inputs/FCSelect'

/**
 *
 * @param {{ id: string }} props
 * @returns
 */
export function QuestConditionSelector({ id }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useDeepStore(`filters.pokestops.filter.${id}`)
  const value = filter?.adv || ''
  const all = !!filter?.all
  const questConditions = useMemory((s) => s.available.questConditions[id])
  const hasQuests = useMemory((s) => s.ui.pokestops?.quests)

  // Prune-only: keep the enabled/all state exactly as-is. Used by the
  // availability-validation effect below so a reload never auto-enables a
  // filter just because it carries a (still-valid) narrowing.
  const pruneAdv = React.useCallback(
    (adv) => setFilter((prev) => ({ ...prev, adv })),
    [setFilter],
  )
  // A user actively picking conditions should turn the tile blue (enabled +
  // narrowed), not leave a phantom selection on an off tile. Picking "All"
  // enables + goes green. Both are also what lets the reward<->task mirror
  // propagate the choice - a disabled source counts as "nothing selected".
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

  // Provides a reset if that condition is no longer available
  React.useEffect(() => {
    if (hasQuests) {
      // user has quest permissions
      if (!questConditions && value) {
        // condition is no longer available
        pruneAdv('')
      } else {
        // check if the value is still valid
        const filtered = questConditions
          ? value
              .split(',')
              .filter((each) =>
                questConditions.find(
                  ({ title, target }) => `${title}__${target}` === each,
                ),
              )
          : []
        pruneAdv(filtered.length ? filtered.join(',') : '')
      }
    } else {
      // user does not have quest permissions
      pruneAdv('')
    }
  }, [questConditions, id, hasQuests])

  if (!questConditions) return null

  return (
    <FCSelect
      label={t('quest_condition')}
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
      {questConditions
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(({ title, target }) => (
          <MenuItem key={`${title}-${target}`} value={`${title}__${target}`}>
            <QuestTitle questTitle={title} questTarget={target} />
          </MenuItem>
        ))}
    </FCSelect>
  )
}
