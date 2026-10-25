// Store reactivo del estado del display, compartido por /control y /display.
// Aplica la lógica de decideAccept y expone sólo el estado vigente.

import { readonly, ref, shallowRef } from 'vue'
import type { Snapshot } from '@/protocol/types'
import { decideAccept } from './applySnapshot'

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unauthenticated'

/**
 * Resultado de intentar aplicar una instantánea.
 * - `applied`: se actualizó el estado vigente.
 * - `ignored`: descartada (duplicado, regresión o generación obsoleta).
 * - `resync`: el epoch no coincide con el de la generación vigente; el llamador
 *   debe reiniciar la conexión en vez de aplicar.
 */
export type ApplyOutcome = 'applied' | 'ignored' | 'resync'

function createDisplayStore() {
  const snapshot = shallowRef<Snapshot | null>(null)
  const connectionStatus = ref<ConnectionStatus>('idle')
  const lastError = ref<string | null>(null)

  // Generación de la conexión vigente. Se incrementa en cada nueva conexión.
  let currentGeneration = 0
  // Estado por generación: epoch fijado y última version aplicada en él.
  let knownEpoch: string | null = null
  let appliedVersion: number | null = null
  // Piso persistente entre generaciones: última instantánea aplicada en
  // cualquier generación. Evita que la primera captura de una reconexión
  // retroceda la version dentro del mismo epoch.
  let lastAppliedEpoch: string | null = null
  let lastAppliedVersion: number | null = null

  /** Comienza una nueva generación (nueva conexión/reconexión). */
  function beginGeneration(): number {
    currentGeneration += 1
    // El epoch/version por-generación se reinician, pero el piso persistente
    // (lastApplied*) NO: así se preserva el orden de versiones al reconectar.
    knownEpoch = null
    appliedVersion = null
    return currentGeneration
  }

  function getCurrentGeneration(): number {
    return currentGeneration
  }

  /**
   * Intenta aplicar una instantánea recibida por la generación indicada.
   */
  function applySnapshot(candidate: Snapshot, generation: number): ApplyOutcome {
    const decision = decideAccept(candidate, {
      currentGeneration,
      incomingGeneration: generation,
      knownEpoch,
      appliedVersion,
      lastAppliedEpoch,
      lastAppliedVersion,
    })

    if (decision.kind === 'ignore') {
      return 'ignored'
    }
    if (decision.kind === 'resync') {
      return 'resync'
    }

    if (decision.setsEpoch) {
      knownEpoch = candidate.epoch
    }
    appliedVersion = candidate.version
    lastAppliedEpoch = candidate.epoch
    lastAppliedVersion = candidate.version
    snapshot.value = candidate
    return 'applied'
  }

  function setConnectionStatus(status: ConnectionStatus): void {
    connectionStatus.value = status
  }

  function setError(message: string | null): void {
    lastError.value = message
  }

  /** Limpia todo el estado al cerrar sesión. */
  function reset(): void {
    snapshot.value = null
    knownEpoch = null
    appliedVersion = null
    lastAppliedEpoch = null
    lastAppliedVersion = null
    connectionStatus.value = 'idle'
    lastError.value = null
  }

  return {
    snapshot: readonly(snapshot),
    connectionStatus: readonly(connectionStatus),
    lastError: readonly(lastError),
    beginGeneration,
    getCurrentGeneration,
    applySnapshot,
    setConnectionStatus,
    setError,
    reset,
  }
}

export type DisplayStore = ReturnType<typeof createDisplayStore>

// Instancia única compartida por toda la aplicación.
export const displayStore = createDisplayStore()
