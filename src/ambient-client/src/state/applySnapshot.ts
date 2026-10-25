// Lógica pura de aceptación de instantáneas por generación/epoch/versión.
// Implementa las reglas de "SignalR y orden" del contrato:
//
// - Cada conexión local tiene una generación creciente; se ignoran callbacks de
//   generaciones anteriores.
// - La primera instantánea confirmada de una generación fija el epoch de esa
//   generación (una sola vez por generación).
// - Dentro del mismo epoch sólo se acepta version estrictamente mayor; iguales
//   o menores se ignoran como duplicados/regresiones.
// - Si en la MISMA generación/transporte aparece un epoch distinto del fijado,
//   NO se alterna el estado: se señala resincronización mediante una nueva
//   conexión (el contrato prohíbe oscilar entre epochs sobre el mismo
//   transporte). El reinicio del servidor se adopta cuando una generación nueva
//   confirma el epoch nuevo.
//
// Separado de Vue para poder probarse de forma aislada.

import type { Snapshot } from '@/protocol/types'

export interface AcceptContext {
  /** Generación activa del cliente (la conexión vigente). */
  readonly currentGeneration: number
  /** Generación que produjo la instantánea candidata. */
  readonly incomingGeneration: number
  /** Epoch ya fijado para la generación vigente, o null si aún no se fijó. */
  readonly knownEpoch: string | null
  /** Última version aplicada dentro de knownEpoch. */
  readonly appliedVersion: number | null
  /**
   * Epoch y version de la última instantánea aplicada en CUALQUIER generación.
   * Persisten entre reconexiones para que la primera captura de una nueva
   * generación, si trae el mismo epoch, no pueda retroceder a una version
   * anterior por una respuesta/evento demorado.
   */
  readonly lastAppliedEpoch?: string | null
  readonly lastAppliedVersion?: number | null
}

export type AcceptDecision =
  | { readonly kind: 'apply'; readonly setsEpoch: boolean }
  | { readonly kind: 'ignore'; readonly reason: IgnoreReason }
  // Epoch inesperado en la generación vigente: forzar nueva conexión.
  | { readonly kind: 'resync'; readonly reason: 'epoch-mismatch' }

export type IgnoreReason =
  | 'stale-generation'
  | 'duplicate-version'
  | 'regression-version'

/**
 * Decide qué hacer con una instantánea candidata. No muta nada.
 *
 * - `apply`: aplicar; `setsEpoch` indica si fija el epoch de la generación.
 * - `ignore`: descartar sin tocar el estado vigente.
 * - `resync`: el epoch no coincide con el fijado por esta generación; el
 *   llamador debe reiniciar la conexión en vez de aplicar.
 */
export function decideAccept(candidate: Snapshot, ctx: AcceptContext): AcceptDecision {
  // Respuestas/eventos de una generación anterior se descartan siempre.
  if (ctx.incomingGeneration !== ctx.currentGeneration) {
    return { kind: 'ignore', reason: 'stale-generation' }
  }

  // Primera instantánea confirmada de la generación: fija el epoch.
  if (ctx.knownEpoch === null) {
    // Si esta generación trae el MISMO epoch que ya veníamos aplicando, no
    // permitir que una captura demorada retroceda la version. Una version
    // menor que el piso conocido se ignora como regresión; igual, como
    // duplicado. Un epoch distinto (reinicio) se adopta sin restricción.
    const carriedEpoch = ctx.lastAppliedEpoch ?? null
    const carriedVersion = ctx.lastAppliedVersion ?? null
    if (carriedEpoch !== null && carriedVersion !== null && candidate.epoch === carriedEpoch) {
      if (candidate.version < carriedVersion) {
        return { kind: 'ignore', reason: 'regression-version' }
      }
      if (candidate.version === carriedVersion) {
        return { kind: 'ignore', reason: 'duplicate-version' }
      }
    }
    return { kind: 'apply', setsEpoch: true }
  }

  // Epoch distinto del fijado por esta generación: no alternar estados.
  // Un reinicio del servidor se adopta mediante una conexión nueva (nueva
  // generación), no reescribiendo el epoch de la generación vigente.
  if (candidate.epoch !== ctx.knownEpoch) {
    return { kind: 'resync', reason: 'epoch-mismatch' }
  }

  // Mismo epoch: preservar el orden de versiones. Sólo aceptar version mayor.
  if (ctx.appliedVersion === null) {
    return { kind: 'apply', setsEpoch: false }
  }
  if (candidate.version > ctx.appliedVersion) {
    return { kind: 'apply', setsEpoch: false }
  }
  if (candidate.version === ctx.appliedVersion) {
    return { kind: 'ignore', reason: 'duplicate-version' }
  }
  return { kind: 'ignore', reason: 'regression-version' }
}
