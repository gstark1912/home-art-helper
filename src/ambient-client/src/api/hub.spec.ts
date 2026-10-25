import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Conexión falsa controlable para simular fallos de start y cierres.
class FakeConnection {
  handlers = new Map<string, (payload: unknown) => void>()
  closeHandler: ((error?: Error) => void) | null = null
  startBehavior: 'ok' | 'fail' | 'unauthenticated' = 'ok'
  snapshotPayload: unknown = null
  state = 0
  // Cuando es true, invoke('GetSnapshot') no resuelve: queda pendiente y se
  // controla manualmente con resolveSnapshot()/rejectSnapshot().
  deferSnapshot = false
  private pendingResolve: ((value: unknown) => void) | null = null
  private pendingReject: ((reason: unknown) => void) | null = null

  on(event: string, handler: (payload: unknown) => void): void {
    this.handlers.set(event, handler)
  }
  onclose(handler: (error?: Error) => void): void {
    this.closeHandler = handler
  }
  async start(): Promise<void> {
    if (this.startBehavior === 'fail') throw new Error('network')
    if (this.startBehavior === 'unauthenticated') throw new Error('unauthenticated')
    this.state = 1
  }
  async stop(): Promise<void> {
    this.state = 0
  }
  invoke<T>(_method: string): Promise<T> {
    if (this.deferSnapshot) {
      return new Promise<T>((resolve, reject) => {
        this.pendingResolve = resolve as (value: unknown) => void
        this.pendingReject = reject
      })
    }
    return Promise.resolve(this.snapshotPayload as T)
  }
  rejectSnapshot(error: Error): void {
    this.pendingReject?.(error)
  }
  resolveSnapshot(payload: unknown): void {
    this.pendingResolve?.(payload)
  }
}

const fakeConnections: FakeConnection[] = []

vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    withUrl(): this {
      return this
    }
    configureLogging(): this {
      return this
    }
    build(): FakeConnection {
      const connection = new FakeConnection()
      fakeConnections.push(connection)
      return connection
    }
  }
  return {
    HubConnectionBuilder,
    HubConnectionState: { Disconnected: 0, Connected: 1 },
    LogLevel: { Warning: 3 },
  }
})

vi.mock('./client', () => ({
  getCsrfToken: () => 'test-token',
}))

import { HubClient, RETRY_DELAYS_MS, type HubCallbacks } from './hub'

function makeCallbacks(): HubCallbacks & { events: string[] } {
  const events: string[] = []
  return {
    events,
    onSnapshot: () => events.push('snapshot'),
    onConnecting: () => events.push('connecting'),
    onConnected: () => events.push('connected'),
    onReconnecting: () => events.push('reconnecting'),
    onDisconnected: () => events.push('disconnected'),
    onUnauthenticated: () => events.push('unauthenticated'),
  }
}

describe('HubClient', () => {
  beforeEach(() => {
    fakeConnections.length = 0
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('conecta, emite GetSnapshot y notifica instantánea', async () => {
    const callbacks = makeCallbacks()
    let generation = 0
    const client = new HubClient(callbacks, () => ++generation)

    // Toda conexión creada por el builder responde GetSnapshot con una
    // instantánea válida del contrato.
    const originalPush = fakeConnections.push.bind(fakeConnections)
    vi.spyOn(fakeConnections, 'push').mockImplementation((...items: FakeConnection[]) => {
      for (const item of items) {
        item.snapshotPayload = {
          epoch: 'e', version: 0, serverTimeUtc: '2026-10-25T18:00:00.000Z',
          screenOn: true, baseMode: 'art',
          animation: { style: 'particles', palette: 'aurora', speed: 1, intensity: 0.5, bpm: null },
          music: null, message: null,
        }
      }
      return originalPush(...items)
    })

    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(callbacks.events).toContain('connected')
    expect(callbacks.events).toContain('snapshot')
    await client.stop()
  })

  it('reintenta el start inicial fallido con las esperas del contrato', async () => {
    const callbacks = makeCallbacks()
    const client = new HubClient(callbacks, (() => {
      let g = 0
      return () => ++g
    })())

    // Forzar que cada conexión creada falle al conectar.
    const originalPush = fakeConnections.push.bind(fakeConnections)
    vi.spyOn(fakeConnections, 'push').mockImplementation((...items: FakeConnection[]) => {
      for (const item of items) item.startBehavior = 'fail'
      return originalPush(...items)
    })

    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    // Primer intento inmediato (delay 0) ya ocurrió -> una conexión creada.
    expect(fakeConnections.length).toBeGreaterThanOrEqual(1)
    expect(callbacks.events).toContain('disconnected')

    // Avanzar la segunda espera (2 s) y comprobar nuevo intento.
    const before = fakeConnections.length
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1])
    await Promise.resolve()
    await Promise.resolve()
    expect(fakeConnections.length).toBeGreaterThan(before)

    await client.stop()
  })

  it('detiene reintentos ante sesión no autenticada', async () => {
    const callbacks = makeCallbacks()
    const client = new HubClient(callbacks, (() => {
      let g = 0
      return () => ++g
    })())

    const originalPush = fakeConnections.push.bind(fakeConnections)
    vi.spyOn(fakeConnections, 'push').mockImplementation((...items: FakeConnection[]) => {
      for (const item of items) item.startBehavior = 'unauthenticated'
      return originalPush(...items)
    })

    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(callbacks.events).toContain('unauthenticated')
    const countAfterAuthFail = fakeConnections.length
    // No debe programar nuevos intentos.
    await vi.advanceTimersByTimeAsync(60000)
    expect(fakeConnections.length).toBe(countAfterAuthFail)

    await client.stop()
  })

  // Regresión: un GetSnapshot demorado de una conexión anterior que rechaza con
  // 'unauthenticated' tras stop()+start() NO debe invalidar la sesión nueva.
  it('ignora el rechazo tardío de GetSnapshot de una conexión anterior', async () => {
    const callbacks = makeCallbacks()
    let generation = 0
    const client = new HubClient(callbacks, () => ++generation)

    // Sólo la PRIMERA conexión difiere su GetSnapshot.
    const originalPush = fakeConnections.push.bind(fakeConnections)
    let created = 0
    vi.spyOn(fakeConnections, 'push').mockImplementation((...items: FakeConnection[]) => {
      for (const item of items) {
        created += 1
        if (created === 1) item.deferSnapshot = true
      }
      return originalPush(...items)
    })

    // Primera conexión (generación 1): GetSnapshot queda pendiente.
    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()
    const firstConnection = fakeConnections[0]!
    expect(client.getGeneration()).toBe(1)

    // Reemplazo de conexión: stop() + start() => segunda conexión (generación 2).
    await client.stop()
    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()
    expect(client.getGeneration()).toBe(2)

    // La invocación vieja rechaza ahora con sesión no autenticada.
    firstConnection.rejectSnapshot(new Error('unauthenticated'))
    await Promise.resolve()
    await Promise.resolve()

    // No debe emitirse onUnauthenticated: el rechazo pertenece a la conexión
    // anterior ya detenida.
    expect(callbacks.events).not.toContain('unauthenticated')

    await client.stop()
  })

  // Regresión: tras resync, el rechazo tardío de la conexión previa se ignora.
  it('ignora el rechazo tardío de GetSnapshot tras resync', async () => {
    const callbacks = makeCallbacks()
    let generation = 0
    const client = new HubClient(callbacks, () => ++generation)

    const originalPush = fakeConnections.push.bind(fakeConnections)
    let created = 0
    vi.spyOn(fakeConnections, 'push').mockImplementation((...items: FakeConnection[]) => {
      for (const item of items) {
        created += 1
        if (created === 1) item.deferSnapshot = true
      }
      return originalPush(...items)
    })

    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()
    const firstConnection = fakeConnections[0]!
    const genBefore = client.getGeneration()

    // resync cierra la conexión vigente y abre otra (generación mayor).
    client.resync()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()
    expect(client.getGeneration()).toBeGreaterThan(genBefore)

    firstConnection.rejectSnapshot(new Error('unauthenticated'))
    await Promise.resolve()
    await Promise.resolve()

    expect(callbacks.events).not.toContain('unauthenticated')

    await client.stop()
  })

  // Contraprueba: un GetSnapshot que rechaza con 'unauthenticated' en la
  // conexión VIGENTE sí invalida la sesión.
  it('sí invalida la sesión si la conexión vigente recibe unauthenticated', async () => {
    const callbacks = makeCallbacks()
    let generation = 0
    const client = new HubClient(callbacks, () => ++generation)

    const originalPush = fakeConnections.push.bind(fakeConnections)
    vi.spyOn(fakeConnections, 'push').mockImplementation((...items: FakeConnection[]) => {
      for (const item of items) item.deferSnapshot = true
      return originalPush(...items)
    })

    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()
    const current = fakeConnections[0]!

    current.rejectSnapshot(new Error('unauthenticated'))
    await Promise.resolve()
    await Promise.resolve()

    expect(callbacks.events).toContain('unauthenticated')

    await client.stop()
  })

  // Regresión P1: resync cierra la conexión actual y abre una nueva (nueva
  // generación), en vez de alternar estados sobre el mismo transporte.
  it('resync abre una conexión nueva con una generación mayor', async () => {
    const callbacks = makeCallbacks()
    let generation = 0
    const client = new HubClient(callbacks, () => ++generation)

    client.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    const connectionsAfterStart = fakeConnections.length
    const genAfterStart = client.getGeneration()

    client.resync()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(fakeConnections.length).toBeGreaterThan(connectionsAfterStart)
    expect(client.getGeneration()).toBeGreaterThan(genAfterStart)

    await client.stop()
  })
})
