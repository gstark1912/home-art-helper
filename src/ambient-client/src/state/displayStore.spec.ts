import { beforeEach, describe, expect, it } from 'vitest'
import { displayStore } from './displayStore'
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

describe('displayStore', () => {
  beforeEach(() => {
    displayStore.reset()
  })

  it('aplica la primera instantánea de una generación', () => {
    const gen = displayStore.beginGeneration()
    expect(displayStore.applySnapshot(snap({ version: 0 }), gen)).toBe('applied')
    expect(displayStore.snapshot.value?.version).toBe(0)
  })

  it('descarta instantáneas de una generación obsoleta tras reconectar', () => {
    const oldGen = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ version: 1 }), oldGen)

    // Nueva conexión: la generación anterior ya no debe aplicar.
    displayStore.beginGeneration()
    expect(displayStore.applySnapshot(snap({ version: 5 }), oldGen)).toBe('ignored')
  })

  it('ignora duplicados y regresiones dentro del mismo epoch', () => {
    const gen = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ version: 2 }), gen)
    expect(displayStore.applySnapshot(snap({ version: 2 }), gen)).toBe('ignored')
    expect(displayStore.applySnapshot(snap({ version: 1 }), gen)).toBe('ignored')
    expect(displayStore.applySnapshot(snap({ version: 3 }), gen)).toBe('applied')
  })

  // Regresión P1: el escenario reportado A/10 -> B/0 -> A/9 ya no debe terminar
  // en A/9. Un epoch distinto en la misma generación pide resync y no alterna.
  it('no alterna epochs dentro de la misma generación (resync)', () => {
    const gen = displayStore.beginGeneration()
    expect(displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 10 }), gen)).toBe('applied')
    expect(displayStore.applySnapshot(snap({ epoch: 'epoch-B', version: 0 }), gen)).toBe('resync')
    // El estado vigente sigue siendo A/10; B nunca se aplicó.
    expect(displayStore.snapshot.value?.epoch).toBe('epoch-A')
    expect(displayStore.snapshot.value?.version).toBe(10)
    // Un evento posterior A/9 es una regresión y se ignora.
    expect(displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 9 }), gen)).toBe('ignored')
    expect(displayStore.snapshot.value?.version).toBe(10)
  })

  // Regresión P1: tras reconectar (nueva generación) con el MISMO epoch, una
  // primera captura demorada con version menor no debe retroceder el contenido.
  it('preserva el orden de versiones al reconectar con el mismo epoch', () => {
    const gen1 = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 10 }), gen1)

    const gen2 = displayStore.beginGeneration()
    // Captura demorada del mismo epoch con version anterior: ignorada.
    expect(displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 8 }), gen2)).toBe('ignored')
    expect(displayStore.snapshot.value?.version).toBe(10)
    // La captura real, con version mayor, sí se aplica.
    expect(displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 11 }), gen2)).toBe('applied')
    expect(displayStore.snapshot.value?.version).toBe(11)
  })

  it('adopta un epoch nuevo real tras reconexión (reinicio del servidor)', () => {
    const gen1 = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 10 }), gen1)

    const gen2 = displayStore.beginGeneration()
    // Nueva generación confirma epoch distinto: reinicio, se adopta aunque la
    // version sea menor.
    expect(displayStore.applySnapshot(snap({ epoch: 'epoch-B', version: 0 }), gen2)).toBe('applied')
    expect(displayStore.snapshot.value?.epoch).toBe('epoch-B')
    expect(displayStore.snapshot.value?.version).toBe(0)
  })

  it('reset limpia también el piso persistente de versiones', () => {
    const gen1 = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 10 }), gen1)

    displayStore.reset()

    // Tras reset, sin piso, una generación nueva acepta cualquier version.
    const gen2 = displayStore.beginGeneration()
    expect(displayStore.applySnapshot(snap({ epoch: 'epoch-A', version: 3 }), gen2)).toBe('applied')
    expect(displayStore.snapshot.value?.version).toBe(3)
  })

  it('refleja el apagado lógico en la instantánea aplicada', () => {
    const gen = displayStore.beginGeneration()
    displayStore.applySnapshot(snap({ version: 1, screenOn: true }), gen)
    displayStore.applySnapshot(snap({ version: 2, screenOn: false }), gen)
    expect(displayStore.snapshot.value?.screenOn).toBe(false)
  })
})
