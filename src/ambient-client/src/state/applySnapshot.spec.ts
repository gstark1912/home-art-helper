import { describe, expect, it } from 'vitest'
import { decideAccept, type AcceptContext } from './applySnapshot'
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

const base: AcceptContext = {
  currentGeneration: 1,
  incomingGeneration: 1,
  knownEpoch: null,
  appliedVersion: null,
  lastAppliedEpoch: null,
  lastAppliedVersion: null,
}

describe('decideAccept', () => {
  it('descarta instantáneas de una generación anterior', () => {
    const decision = decideAccept(snap(), { ...base, incomingGeneration: 0 })
    expect(decision).toEqual({ kind: 'ignore', reason: 'stale-generation' })
  })

  it('aplica la primera instantánea de la generación y fija el epoch', () => {
    const decision = decideAccept(snap({ version: 0 }), base)
    expect(decision).toEqual({ kind: 'apply', setsEpoch: true })
  })

  it('acepta versiones estrictamente mayores dentro del mismo epoch', () => {
    const ctx: AcceptContext = { ...base, knownEpoch: 'epoch-A', appliedVersion: 3 }
    expect(decideAccept(snap({ version: 4 }), ctx)).toEqual({ kind: 'apply', setsEpoch: false })
  })

  it('ignora una version igual como duplicado', () => {
    const ctx: AcceptContext = { ...base, knownEpoch: 'epoch-A', appliedVersion: 3 }
    expect(decideAccept(snap({ version: 3 }), ctx)).toEqual({
      kind: 'ignore',
      reason: 'duplicate-version',
    })
  })

  it('ignora una version menor como regresión', () => {
    const ctx: AcceptContext = { ...base, knownEpoch: 'epoch-A', appliedVersion: 3 }
    expect(decideAccept(snap({ version: 2 }), ctx)).toEqual({
      kind: 'ignore',
      reason: 'regression-version',
    })
  })

  // Regresión del hallazgo P1: un epoch distinto dentro de la MISMA generación
  // ya NO se aplica alternando el estado; se señala resincronización.
  it('ante un epoch distinto en la generación vigente pide resync (no alterna)', () => {
    const ctx: AcceptContext = { ...base, knownEpoch: 'epoch-A', appliedVersion: 9 }
    expect(decideAccept(snap({ epoch: 'epoch-B', version: 0 }), ctx)).toEqual({
      kind: 'resync',
      reason: 'epoch-mismatch',
    })
  })

  // Regresión del hallazgo P1: la primera captura de una nueva generación con el
  // MISMO epoch no puede retroceder por debajo del piso ya aplicado.
  it('no retrocede la version en la primera captura de una generación nueva (mismo epoch)', () => {
    const ctx: AcceptContext = {
      ...base,
      knownEpoch: null,
      appliedVersion: null,
      lastAppliedEpoch: 'epoch-A',
      lastAppliedVersion: 10,
    }
    // Captura demorada con version menor: regresión.
    expect(decideAccept(snap({ epoch: 'epoch-A', version: 8 }), ctx)).toEqual({
      kind: 'ignore',
      reason: 'regression-version',
    })
    // Misma version que el piso: duplicado.
    expect(decideAccept(snap({ epoch: 'epoch-A', version: 10 }), ctx)).toEqual({
      kind: 'ignore',
      reason: 'duplicate-version',
    })
    // Version mayor: se aplica y fija el epoch de la nueva generación.
    expect(decideAccept(snap({ epoch: 'epoch-A', version: 11 }), ctx)).toEqual({
      kind: 'apply',
      setsEpoch: true,
    })
  })

  it('en una generación nueva con epoch distinto (reinicio real) aplica sin piso', () => {
    const ctx: AcceptContext = {
      ...base,
      knownEpoch: null,
      appliedVersion: null,
      lastAppliedEpoch: 'epoch-A',
      lastAppliedVersion: 10,
    }
    expect(decideAccept(snap({ epoch: 'epoch-B', version: 0 }), ctx)).toEqual({
      kind: 'apply',
      setsEpoch: true,
    })
  })
})
