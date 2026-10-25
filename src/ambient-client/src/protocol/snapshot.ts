// Validación defensiva de instantáneas recibidas y utilidades de versión/epoch.
// El servidor es la autoridad del estado; el cliente sólo comprueba que la
// forma recibida sea coherente con el contrato antes de aplicarla.

import type {
  AnimationState,
  BaseMode,
  MessageState,
  MusicState,
  Palette,
  Snapshot,
} from './types'
import {
  BPM_MAX,
  BPM_MIN,
  INTENSITY_MAX,
  INTENSITY_MIN,
  PALETTES,
  SPEED_MAX,
  SPEED_MIN,
} from './types'

export const MAX_SAFE_VERSION = 9007199254740991

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function parseAnimation(value: unknown): AnimationState | null {
  if (!isRecord(value)) return null
  if (value.style !== 'particles') return null
  if (!PALETTES.includes(value.palette as Palette)) return null
  if (!isFiniteNumberInRange(value.speed, SPEED_MIN, SPEED_MAX)) return null
  if (!isFiniteNumberInRange(value.intensity, INTENSITY_MIN, INTENSITY_MAX)) return null

  const bpm = value.bpm
  if (bpm !== null) {
    if (!isFiniteNumberInRange(bpm, BPM_MIN, BPM_MAX) || !Number.isInteger(bpm)) return null
  }

  return {
    style: 'particles',
    palette: value.palette as Palette,
    speed: value.speed,
    intensity: value.intensity,
    bpm: bpm as number | null,
  }
}

function parseMusic(value: unknown): MusicState | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  if (!isNonEmptyString(value.trackId)) return undefined
  if (!isNonEmptyString(value.title)) return undefined
  if (!isNonEmptyString(value.artist)) return undefined
  if (value.artworkId !== 'cover-01' && value.artworkId !== 'cover-02') return undefined
  if (typeof value.isPlaying !== 'boolean') return undefined

  return {
    trackId: value.trackId,
    title: value.title,
    artist: value.artist,
    artworkId: value.artworkId,
    isPlaying: value.isPlaying,
  }
}

function parseMessage(value: unknown): MessageState | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  if (!isNonEmptyString(value.id)) return undefined
  if (typeof value.text !== 'string' || value.text.length === 0) return undefined
  if (!isFiniteNumberInRange(value.priority, 0, 2) || !Number.isInteger(value.priority)) {
    return undefined
  }
  if (!isNonEmptyString(value.createdAtUtc)) return undefined
  if (!isNonEmptyString(value.expiresAtUtc)) return undefined

  return {
    id: value.id,
    text: value.text,
    priority: value.priority,
    createdAtUtc: value.createdAtUtc,
    expiresAtUtc: value.expiresAtUtc,
  }
}

/**
 * Convierte un valor arbitrario recibido por HTTP o SignalR en una instantánea
 * válida, o null si no cumple el contrato. No lanza: una instantánea malformada
 * se descarta sin romper el cliente.
 */
export function parseSnapshot(value: unknown): Snapshot | null {
  if (!isRecord(value)) return null
  if (!isNonEmptyString(value.epoch)) return null
  if (
    typeof value.version !== 'number' ||
    !Number.isInteger(value.version) ||
    value.version < 0 ||
    value.version > MAX_SAFE_VERSION
  ) {
    return null
  }
  if (!isNonEmptyString(value.serverTimeUtc)) return null
  if (typeof value.screenOn !== 'boolean') return null
  if (value.baseMode !== 'art' && value.baseMode !== 'music') return null

  const animation = parseAnimation(value.animation)
  if (animation === null) return null

  const music = parseMusic(value.music)
  if (music === undefined) return null

  const message = parseMessage(value.message)
  if (message === undefined) return null

  return {
    epoch: value.epoch,
    version: value.version,
    serverTimeUtc: value.serverTimeUtc,
    screenOn: value.screenOn,
    baseMode: value.baseMode as BaseMode,
    animation,
    music,
    message,
  }
}
