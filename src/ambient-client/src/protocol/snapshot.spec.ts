import { describe, expect, it } from 'vitest'
import { parseSnapshot } from './snapshot'

function validRaw(): Record<string, unknown> {
  return {
    epoch: '4d637ea1-bdca-4e08-8b56-43e8a35292c4',
    version: 0,
    serverTimeUtc: '2026-10-25T18:00:00.000Z',
    screenOn: true,
    baseMode: 'art',
    animation: { style: 'particles', palette: 'aurora', speed: 1, intensity: 0.5, bpm: null },
    music: null,
    message: null,
  }
}

describe('parseSnapshot', () => {
  it('acepta la instantánea de ejemplo del contrato', () => {
    const snapshot = parseSnapshot(validRaw())
    expect(snapshot).not.toBeNull()
    expect(snapshot?.animation.palette).toBe('aurora')
  })

  it('rechaza una paleta fuera del enum', () => {
    expect(parseSnapshot({ ...validRaw(), animation: { style: 'particles', palette: 'neon', speed: 1, intensity: 0.5, bpm: null } })).toBeNull()
  })

  it('rechaza speed fuera de rango', () => {
    expect(parseSnapshot({ ...validRaw(), animation: { style: 'particles', palette: 'ocean', speed: 5, intensity: 0.5, bpm: null } })).toBeNull()
  })

  it('rechaza version negativa o no entera', () => {
    expect(parseSnapshot({ ...validRaw(), version: -1 })).toBeNull()
    expect(parseSnapshot({ ...validRaw(), version: 1.5 })).toBeNull()
  })

  it('rechaza un style distinto de particles', () => {
    expect(parseSnapshot({ ...validRaw(), animation: { style: 'waves', palette: 'ocean', speed: 1, intensity: 0.5, bpm: null } })).toBeNull()
  })

  it('acepta bpm entero dentro de rango y rechaza fuera de rango', () => {
    expect(parseSnapshot({ ...validRaw(), animation: { style: 'particles', palette: 'ocean', speed: 1, intensity: 0.5, bpm: 120 } })).not.toBeNull()
    expect(parseSnapshot({ ...validRaw(), animation: { style: 'particles', palette: 'ocean', speed: 1, intensity: 0.5, bpm: 10 } })).toBeNull()
  })

  it('acepta un objeto music válido y rechaza artworkId arbitrario', () => {
    const withMusic = parseSnapshot({
      ...validRaw(),
      music: { trackId: 'demo-01', title: 'T', artist: 'A', artworkId: 'cover-01', isPlaying: true },
    })
    expect(withMusic?.music?.trackId).toBe('demo-01')
    expect(
      parseSnapshot({
        ...validRaw(),
        music: { trackId: 'demo-01', title: 'T', artist: 'A', artworkId: 'http://x', isPlaying: true },
      }),
    ).toBeNull()
  })

  it('rechaza valores no objeto', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('x')).toBeNull()
    expect(parseSnapshot([])).toBeNull()
  })
})
