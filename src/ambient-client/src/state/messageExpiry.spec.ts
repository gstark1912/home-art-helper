import { describe, expect, it } from 'vitest'
import { computeTiming, isExpired, remainingMs } from './messageExpiry'
import type { MessageState } from '@/protocol/types'

function message(overrides: Partial<MessageState> = {}): MessageState {
  return {
    id: 'abed0357-663c-4583-850b-e986c75e6ccd',
    text: 'La cena está lista',
    priority: 1,
    createdAtUtc: '2026-10-25T18:00:00.000Z',
    expiresAtUtc: '2026-10-25T18:00:30.000Z',
    ...overrides,
  }
}

describe('messageExpiry', () => {
  it('estima el tiempo restante con el reloj del servidor', () => {
    const timing = computeTiming(message(), '2026-10-25T18:00:00.000Z', 1000)
    expect(timing).not.toBeNull()
    expect(timing!.remainingAtReceiptMs).toBe(30_000)
    expect(timing!.id).toBe('abed0357-663c-4583-850b-e986c75e6ccd')
  })

  it('descuenta el margen de la petición de forma conservadora', () => {
    const timing = computeTiming(message(), '2026-10-25T18:00:00.000Z', 1000, 500)
    expect(timing!.remainingAtReceiptMs).toBe(29_500)
  })

  it('nunca estima un restante negativo si ya venció en el servidor', () => {
    const timing = computeTiming(message(), '2026-10-25T18:00:45.000Z', 1000)
    expect(timing!.remainingAtReceiptMs).toBe(0)
  })

  it('devuelve null ante fechas inválidas', () => {
    expect(computeTiming(message({ expiresAtUtc: 'no-fecha' }), '2026-10-25T18:00:00.000Z', 0)).toBeNull()
  })

  it('reduce el restante según el reloj monótono local', () => {
    const timing = computeTiming(message(), '2026-10-25T18:00:00.000Z', 1000)!
    expect(remainingMs(timing, 1000)).toBe(30_000)
    expect(remainingMs(timing, 11_000)).toBe(20_000)
    expect(isExpired(timing, 11_000)).toBe(false)
    expect(remainingMs(timing, 31_000)).toBe(0)
    expect(isExpired(timing, 31_000)).toBe(true)
  })
})
