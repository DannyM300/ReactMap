// @ts-check

import { create } from 'zustand'

/**
 * Shiny check results belong to the signed-in account only - the backend works
 * out what would be shiny for that player - so they are deliberately kept in
 * their own transient store rather than merged into the shared Pokemon layer.
 *
 * @typedef {{
 *  mode: '' | 'setArea' | 'loading' | 'error',
 *  shundo: boolean,
 *  little_max_level: number,
 *  great_max_level: number,
 *  ultra_max_level: number,
 *  cooldown: number,
 *  results: import('@rm/types').Pokemon[],
 *  scanned: number,
 *  possibleShinies: number,
 *  messagesSent: number,
 *  error: string,
 * }} UseShinyCheckStore
 * @type {import("zustand").UseBoundStore<import("zustand").StoreApi<UseShinyCheckStore>>}
 */
export const useShinyCheckStore = create(() => ({
  mode: '',
  shundo: false,
  little_max_level: 0,
  great_max_level: 0,
  ultra_max_level: 0,
  cooldown: 0,
  results: [],
  scanned: 0,
  possibleShinies: 0,
  messagesSent: 0,
  error: '',
}))
