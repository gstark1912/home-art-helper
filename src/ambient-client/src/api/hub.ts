// Gestión de la conexión SignalR al hub /hubs/display.
// Implementa las reglas de reconexión y orden del contrato:
//
// - Registrar el handler StateChanged antes de start().
// - En cada conexión y onreconnected invocar GetSnapshot además de aceptar
//   StateChanged.
// - Reintentar también el start inicial fallido con esperas 0, 2, 5, 10 y 30 s,
//   con una sola conexión activa.
// - Cancelar timers al desmontar/logout; onclose reanuda salvo 401/logout.
// - Cada conexión usa una generación creciente provista por el store.

import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import type { Snapshot } from '@/protocol/types'
import { parseSnapshot } from '@/protocol/snapshot'
import { getCsrfToken } from './client'

const HUB_URL = '/hubs/display'
export const RETRY_DELAYS_MS = [0, 2000, 5000, 10000, 30000] as const

export interface HubCallbacks {
  /** Instantánea recibida (de StateChanged o GetSnapshot) con su generación. */
  onSnapshot(snapshot: Snapshot, generation: number): void
  onConnecting(): void
  onConnected(): void
  onReconnecting(): void
  onDisconnected(): void
  /** Sesión vencida (401): detener reintentos y pedir emparejamiento. */
  onUnauthenticated(): void
}

export class HubClient {
  private connection: HubConnection | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryIndex = 0
  private stopped = false
  private generation = 0

  constructor(
    private readonly callbacks: HubCallbacks,
    private readonly beginGeneration: () => number,
  ) { }

  /** Inicia el ciclo de conexión. Idempotente mientras esté activo. */
  start(): void {
    this.stopped = false
    this.retryIndex = 0
    this.scheduleConnect(0)
  }

  /** Generación de la conexión vigente (para etiquetar respuestas HTTP). */
  getGeneration(): number {
    return this.generation
  }

  /**
   * Fuerza una resincronización: cierra la conexión actual y abre una nueva
   * (nueva generación). Se usa cuando aparece un epoch inesperado en el
   * transporte o en una respuesta HTTP, según el contrato.
   */
  resync(): void {
    if (this.stopped) return
    this.clearRetryTimer()
    const connection = this.connection
    this.connection = null
    if (connection) {
      void connection.stop().catch(() => undefined)
    }
    this.retryIndex = 0
    this.scheduleConnect(0)
  }

  /** Detiene reintentos y cierra la conexión. Para desmontar o logout. */
  async stop(): Promise<void> {
    this.stopped = true
    this.clearRetryTimer()
    const connection = this.connection
    this.connection = null
    if (connection) {
      try {
        await connection.stop()
      } catch {
        // Ignorar errores al cerrar.
      }
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private scheduleConnect(delayMs: number): void {
    if (this.stopped) return
    this.clearRetryTimer()
    if (delayMs > 0) {
      // Hay una espera antes del próximo intento: estado de reconexión.
      this.callbacks.onReconnecting()
    }
    this.retryTimer = setTimeout(() => {
      void this.connect()
    }, delayMs)
  }

  private nextRetryDelay(): number {
    const delay = RETRY_DELAYS_MS[Math.min(this.retryIndex, RETRY_DELAYS_MS.length - 1)]
    this.retryIndex += 1
    return delay ?? 30000
  }

  private buildConnection(): HubConnection {
    // No forzar WebSocket ni skipNegotiation. El header CSRF y la cookie del
    // mismo origen viajan en la negociación/transporte.
    return new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        headers: { 'X-CSRF-Token': getCsrfToken() ?? '' },
      })
      .configureLogging(LogLevel.Warning)
      .build()
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      return
    }

    // Nueva generación para esta conexión; invalida callbacks anteriores.
    this.generation = this.beginGeneration()
    const generation = this.generation

    const connection = this.buildConnection()
    this.connection = connection
    this.callbacks.onConnecting()

    // Handler registrado antes de start().
    connection.on('StateChanged', (payload: unknown) => {
      if (!this.isCurrentInvocation(connection, generation)) return
      const snapshot = parseSnapshot(payload)
      if (snapshot !== null) {
        this.callbacks.onSnapshot(snapshot, generation)
      }
    })

    connection.onclose((error) => {
      if (this.stopped) return
      if (this.connection !== connection) return
      if (this.isUnauthenticated(error)) {
        this.handleUnauthenticated()
        return
      }
      this.callbacks.onDisconnected()
      // Reanudar el ciclo inicial de reintentos.
      this.scheduleConnect(this.nextRetryDelay())
    })

    try {
      await connection.start()
      if (!this.isCurrentInvocation(connection, generation)) {
        // Otra generación/conexión tomó el relevo mientras conectábamos.
        await connection.stop().catch(() => undefined)
        return
      }
      this.retryIndex = 0
      this.callbacks.onConnected()
      await this.invokeSnapshot(connection, generation)
    } catch (error) {
      // Un fallo de start de una conexión ya superada no debe tocar la vigente.
      if (!this.isCurrentInvocation(connection, generation)) return
      if (this.isUnauthenticated(error)) {
        this.handleUnauthenticated()
        return
      }
      this.callbacks.onDisconnected()
      this.scheduleConnect(this.nextRetryDelay())
    }
  }

  private async invokeSnapshot(connection: HubConnection, generation: number): Promise<void> {
    try {
      const payload = await connection.invoke<unknown>('GetSnapshot')
      if (!this.isCurrentInvocation(connection, generation)) return
      const snapshot = parseSnapshot(payload)
      if (snapshot !== null) {
        this.callbacks.onSnapshot(snapshot, generation)
      }
    } catch (error) {
      // Descartar errores de invocaciones obsoletas: si el cliente se detuvo o
      // esta invocación pertenece a una generación/conexión anterior (p. ej. un
      // GetSnapshot demorado que rechaza tras stop/start o resync), NO debe
      // tocar la sesión vigente. De lo contrario un rechazo tardío invalidaría
      // la conexión nueva.
      if (!this.isCurrentInvocation(connection, generation)) return
      if (this.isUnauthenticated(error)) {
        this.handleUnauthenticated()
      }
      // Un GetSnapshot fallido no fuerza reconexión por sí solo; StateChanged
      // inicial o el siguiente ciclo cubren la recuperación.
    }
  }

  /**
   * Una invocación sigue vigente sólo si el cliente no fue detenido, su
   * generación es la actual y la conexión sigue siendo la activa.
   */
  private isCurrentInvocation(connection: HubConnection, generation: number): boolean {
    return !this.stopped && generation === this.generation && this.connection === connection
  }

  private isUnauthenticated(error: unknown): boolean {
    if (error === null || error === undefined) return false
    const message = error instanceof Error ? error.message : String(error)
    return message.includes('unauthenticated') || message.includes('401')
  }

  private handleUnauthenticated(): void {
    this.stopped = true
    this.clearRetryTimer()
    this.callbacks.onUnauthenticated()
  }
}
