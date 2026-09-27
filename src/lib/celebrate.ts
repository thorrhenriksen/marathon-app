// Tiny event bus for the celebration overlay: any code path (session
// completion, achievement collection, shop previews) can fire a celebration
// without threading props. CelebrationHost listens and renders it.

import type { CelebrationStyle } from '../types'

export const CELEBRATE_EVENT = 'marathon:celebrate'

export interface CelebrateDetail {
  /** Overrides the user's selected style (used by shop previews). */
  style?: CelebrationStyle
}

export function celebrate(detail: CelebrateDetail = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail }))
}
