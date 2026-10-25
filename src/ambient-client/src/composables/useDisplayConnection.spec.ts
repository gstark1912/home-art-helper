import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// HubClient falso: captura callbacks y expone espías para stop/resync.
// Definido con vi.hoisted para poder referenciarlo dentro de vi.mock.
const hub = vi.hoisted(() => {
  const state: {
    lastHub: InstanceType<any> | null
    beginGenerationRef: (() => number) | null
  } = { lastHub: null, beginGenerationRef: null }

  class FakeHub {
    callbacks: unknown
    start = vi.fn()
    stop = vi.fn(async () => undefined)
    resync = vi.fn()
    generation = 7
    getGeneration = vi.fn(() => this.generation)
    constructor(callbacks: unknown, beginGeneration: () => number) {
      this.callbacks = callbacks
      state.beginGenerationRef = beginGeneration
      state.lastHub = this
    }
  }
  return { FakeHub, state }
})

vi.mock('@/api/hub', () => ({
  HubClient: hub.FakeHub,
}))

// jsdom: onBeforeUnmount requiere una instancia de componente; lo evitamos
// probando el composable fuera de setup y comprobando que no lanza.
import { displayStore } from '@/state/displayStore'
import { useDisplayConnection, __resetHubForTests } from './useDisplayConnection'
import type { Snapshot } from '@/protocol/types'

function snap(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    epoch: 'epoch-A',
    version: 0,
    serverTimeUtc: '2026-10-25T18:00:00.000Z',
    screenOn: true,
    baseMode: 'art',
    animation: { style: 'particles', palette: 'aurora', speed: 1, intensity: 0.5, bpm: null },
    music: null,
    message: null,
    ...overrides,
  }
}

describe('useDisplayConnection', () => {
  beforeEach(() => {
    __resetHubForTests()
    hub.state.lastHub = null
    hub.state.beginGenerationRef = null
    displayStore.reset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('expone la generación vigente del hub', () => {
    const conn = useDisplayConnection()
    expect(conn.currentGeneration()).toBe(7)
  })

  // Regresión P2: la instantánea devuelta por un comando HTTP se aplica (no se
  // descarta) cuando corresponde a la generación vigente.
  it('aplica la instantánea de un comando con la generación capturada', () => {
    const conn = useDisplayConnection()
    const gen = displayStore.beginGeneration()
    hub.state.lastHub!.generation = gen

    const outcome = conn.applyCommandResponse(snap({ epoch: 'epoch-A', version: 5 }), gen)
    expect(outcome).toBe('applied')
    expect(displayStore.snapshot.value?.version).toBe(5)
  })

  // Regresión P2: una respuesta HTTP de una generación anterior no sobrescribe
  // el estado vigente.
  it('descarta la respuesta de comando de una generación anterior', () => {
    const conn = useDisplayConnection()
    const oldGen = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 5 }), oldGen)
    displayStore.beginGeneration() // reconexión

    const outcome = conn.applyCommandResponse(snap({ epoch: 'epoch-A', version: 99 }), oldGen)
    expect(outcome).toBe('ignored')
    expect(displayStore.snapshot.value?.version).toBe(5)
  })

  // Regresión P2: si la respuesta trae un epoch distinto del vigente, se fuerza
  // la resincronización por el hub.
  it('fuerza resync si la respuesta de comando trae otro epoch', () => {
    const conn = useDisplayConnection()
    const gen = displayStore.beginGeneration()
    hub.state.lastHub!.generation = gen
    displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 5 }), gen)

    const outcome = conn.applyCommandResponse(snap({ epoch: 'epoch-B', version: 0 }), gen)
    expect(outcome).toBe('resync')
    expect(hub.state.lastHub!.resync).toHaveBeenCalledTimes(1)
  })

  // Regresión P3: disconnect detiene la conexión, avanza la generación (invalida
  // callbacks pendientes) y limpia el estado del store.
  it('disconnect detiene la conexión e invalida el estado', async () => {
    const conn = useDisplayConnection()
    const gen = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ version: 3 }), gen)
    expect(displayStore.snapshot.value).not.toBeNull()

    await conn.disconnect()

    expect(hub.state.lastHub!.stop).toHaveBeenCalledTimes(1)
    expect(displayStore.snapshot.value).toBeNull()
    // La generación avanzó: un callback demorado de la generación previa se
    // ignora.
    expect(displayStore.applySnapshot(snap({ version: 9 }), gen)).toBe('ignored')
    expect(hub.state.beginGenerationRef).not.toBeNull()
  })
})
