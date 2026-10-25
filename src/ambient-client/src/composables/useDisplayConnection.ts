// Composable que une el store, el cliente HTTP y el hub SignalR.
// Lo usan /control y /display. Expone el estado reactivo y el ciclo de vida.

import { getCurrentInstance, onBeforeUnmount } from 'vue'
import { displayStore, type ApplyOutcome } from '@/state/displayStore'
import { HubClient } from '@/api/hub'
import type { Snapshot } from '@/protocol/types'

let hub: HubClient | null = null

function ensureHub(): HubClient {
  if (hub === null) {
    const client = new HubClient(
      {
        onSnapshot(snapshot: Snapshot, generation: number) {
          const outcome = displayStore.applySnapshot(snapshot, generation)
          // Epoch inesperado en el transporte: reconectar en vez de alternar.
          if (outcome === 'resync') {
            client.resync()
          }
        },
        onConnecting() {
          displayStore.setConnectionStatus('connecting')
        },
        onConnected() {
          displayStore.setConnectionStatus('connected')
          displayStore.setError(null)
        },
        onReconnecting() {
          displayStore.setConnectionStatus('reconnecting')
        },
        onDisconnected() {
          displayStore.setConnectionStatus('disconnected')
        },
        onUnauthenticated() {
          displayStore.setConnectionStatus('unauthenticated')
        },
      },
      () => displayStore.beginGeneration(),
    )
    hub = client
  }
  return hub
}

export function useDisplayConnection() {
  const client = ensureHub()

  function connect(): void {
    client.start()
  }

  /**
   * Detiene reintentos, cierra la conexión y limpia el estado local. Para
   * logout o desmontaje definitivo. Tras esto, los callbacks de la conexión
   * anterior quedan invalidados por la generación del store.
   */
  async function disconnect(): Promise<void> {
    await client.stop()
    // Invalida callbacks pendientes (GetSnapshot/StateChanged en vuelo) al
    // avanzar la generación, y borra el estado mostrado.
    displayStore.beginGeneration()
    displayStore.reset()
  }

  /**
   * Aplica la instantánea devuelta por un comando HTTP, etiquetada con la
   * generación vigente en el momento de enviarlo. Devuelve el resultado para
   * que el llamador reaccione (p. ej. forzar resync ante epoch distinto).
   */
  function applyCommandResponse(snapshot: Snapshot, generation: number): ApplyOutcome {
    const outcome = displayStore.applySnapshot(snapshot, generation)
    if (outcome === 'resync') {
      client.resync()
    }
    return outcome
  }

  /** Generación vigente, para capturarla antes de enviar un comando HTTP. */
  function currentGeneration(): number {
    return client.getGeneration()
  }

  // El componente que arranca la conexión la detiene al desmontar; así se
  // cancelan timers y se libera el socket (requisito del contrato y del diseño).
  // Sólo se registra si hay instancia de componente activa (en setup()).
  if (getCurrentInstance() !== null) {
    onBeforeUnmount(() => {
      void client.stop()
    })
  }

  return {
    snapshot: displayStore.snapshot,
    connectionStatus: displayStore.connectionStatus,
    lastError: displayStore.lastError,
    connect,
    disconnect,
    applyCommandResponse,
    currentGeneration,
  }
}

/** Para pruebas: reinicia el singleton del hub. */
export function __resetHubForTests(): void {
  hub = null
}
