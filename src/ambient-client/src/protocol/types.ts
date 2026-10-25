// Tipos del contrato docs/contracts/display-protocol.md (v1).
// Nombres, casing y límites derivan exactamente de ese documento. No agregar
// campos ni eventos fuera del contrato.

export type Palette = 'aurora' | 'sunset' | 'ocean'
export type AnimationStyle = 'particles'
export type BaseMode = 'art' | 'music'

/** Límites de animation según el contrato. */
export const SPEED_MIN = 0.1
export const SPEED_MAX = 3
export const INTENSITY_MIN = 0
export const INTENSITY_MAX = 1
export const BPM_MIN = 40
export const BPM_MAX = 240

export const PALETTES: readonly Palette[] = ['aurora', 'sunset', 'ocean'] as const

export interface AnimationState {
  readonly style: AnimationStyle
  readonly palette: Palette
  readonly speed: number
  readonly intensity: number
  readonly bpm: number | null
}

export interface MusicState {
  readonly trackId: string
  readonly title: string
  readonly artist: string
  readonly artworkId: 'cover-01' | 'cover-02'
  readonly isPlaying: boolean
}

export interface MessageState {
  readonly id: string
  readonly text: string
  readonly priority: number
  readonly createdAtUtc: string
  readonly expiresAtUtc: string
}

/**
 * Instantánea exacta compartida por GET /api/display/status, el evento
 * StateChanged y el resultado de GetSnapshot. Sin envoltorio.
 */
export interface Snapshot {
  readonly epoch: string
  readonly version: number
  readonly serverTimeUtc: string
  readonly screenOn: boolean
  readonly baseMode: BaseMode
  readonly animation: AnimationState
  readonly music: MusicState | null
  readonly message: MessageState | null
}

/** Cuerpo exacto de POST /api/display/animation (reemplazo completo). */
export interface AnimationCommand {
  readonly style: AnimationStyle
  readonly palette: Palette
  readonly speed: number
  readonly intensity: number
  readonly bpm: number | null
}

/** Forma exacta de error de aplicación. */
export interface ApiErrorBody {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly fields: Record<string, string[]>
  }
}

export interface SessionState {
  readonly authenticated: boolean
}
