// Paletas de partículas. Recursos puramente locales (colores), sin assets
// externos ni dependencia de red. Colores en RGB para interpolar alfa barato.

import type { Palette } from '@/protocol/types'

export interface PaletteColors {
  readonly background: string
  readonly particles: readonly [number, number, number][]
}

export const PALETTE_COLORS: Record<Palette, PaletteColors> = {
  aurora: {
    background: '#06121a',
    particles: [
      [94, 234, 212],
      [56, 189, 248],
      [167, 139, 250],
    ],
  },
  sunset: {
    background: '#1a0b12',
    particles: [
      [251, 146, 60],
      [244, 63, 94],
      [250, 204, 21],
    ],
  },
  ocean: {
    background: '#041625',
    particles: [
      [34, 211, 238],
      [59, 130, 246],
      [45, 212, 191],
    ],
  },
}
