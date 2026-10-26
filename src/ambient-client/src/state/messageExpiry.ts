// Lógica pura de expiración local del mensaje temporal.
// Implementa la estimación del contrato: el tiempo restante se calcula con
// (expiresAtUtc - serverTimeUtc) y un reloj monótono local desde la recepción,
// sin depender de la precisión del reloj absoluto del dispositivo. Desconectado
// el mensaje vence localmente; NO muta la versión del servidor. Al reconectar,
// la instantánea del servidor reemplaza la estimación.

import type { MessageState } from '@/protocol/types'

export interface MessageTiming {
  /** id del mensaje que esta temporización representa. */
  readonly id: string
  /** Marca monótona local (performance.now) al recibir la instantánea. */
  readonly receivedAtMonotonic: number
  /**
   * Milisegundos restantes estimados en el momento de recepción. Puede ser 0 si
   * el mensaje ya venció según el reloj del servidor.
   */
  readonly remainingAtReceiptMs: number
}

/**
 * Calcula la temporización local de un mensaje a partir de la instantánea.
 * `serverTimeUtc` es el reloj del servidor al capturar la instantánea;
 * `expiresAtUtc` el vencimiento. Un margen opcional (p. ej. el tiempo que tardó
 * la petición GetSnapshot) se descuenta de forma conservadora.
 */
export function computeTiming(
  message: MessageState,
  serverTimeUtc: string,
  nowMonotonic: number,
  marginMs = 0,
): MessageTiming | null {
  const expires = Date.parse(message.expiresAtUtc)
  const serverNow = Date.parse(serverTimeUtc)
  if (!Number.isFinite(expires) || !Number.isFinite(serverNow)) return null

  const remaining = expires - serverNow - Math.max(0, marginMs)
  return {
    id: message.id,
    receivedAtMonotonic: nowMonotonic,
    remainingAtReceiptMs: Math.max(0, remaining),
  }
}

/**
 * Milisegundos restantes según el reloj monótono local. Nunca negativo.
 */
export function remainingMs(timing: MessageTiming, nowMonotonic: number): number {
  const elapsed = Math.max(0, nowMonotonic - timing.receivedAtMonotonic)
  return Math.max(0, timing.remainingAtReceiptMs - elapsed)
}

/** True si el mensaje ya venció según la estimación local. */
export function isExpired(timing: MessageTiming, nowMonotonic: number): boolean {
  return remainingMs(timing, nowMonotonic) <= 0
}
