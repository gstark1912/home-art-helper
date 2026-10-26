import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { MessageState } from '@/protocol/types'
import MessageOverlay from './MessageOverlay.vue'

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

describe('MessageOverlay', () => {
  let monotonic = 0

  beforeEach(() => {
    monotonic = 0
    vi.useFakeTimers()
    // Reloj monótono determinista: performance.now avanza con los timers falsos.
    vi.spyOn(performance, 'now').mockImplementation(() => monotonic)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  async function advance(ms: number): Promise<void> {
    monotonic += ms
    vi.advanceTimersByTime(ms)
    await flushPromises()
  }

  it('muestra el texto como texto plano, sin interpretar HTML', () => {
    const wrapper = mount(MessageOverlay, {
      props: {
        message: message({ text: '<img src=x onerror="alert(1)">' }),
        serverTimeUtc: '2026-10-25T18:00:00.000Z',
      },
    })
    // No debe crearse ningún elemento img a partir del texto.
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.message-overlay__text').text()).toBe('<img src=x onerror="alert(1)">')
  })

  it('oculta el mensaje localmente al vencer sin tocar el servidor', async () => {
    const wrapper = mount(MessageOverlay, {
      props: { message: message(), serverTimeUtc: '2026-10-25T18:00:00.000Z' },
    })
    expect(wrapper.find('.message-overlay').exists()).toBe(true)

    await advance(29_000)
    expect(wrapper.find('.message-overlay').exists()).toBe(true)

    await advance(1_000)
    expect(wrapper.find('.message-overlay').exists()).toBe(false)
  })

  it('no muestra un mensaje ya vencido según el reloj del servidor', () => {
    const wrapper = mount(MessageOverlay, {
      props: { message: message(), serverTimeUtc: '2026-10-25T18:01:00.000Z' },
    })
    expect(wrapper.find('.message-overlay').exists()).toBe(false)
  })

  it('libera el timer al desmontar', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const wrapper = mount(MessageOverlay, {
      props: { message: message(), serverTimeUtc: '2026-10-25T18:00:00.000Z' },
    })
    wrapper.unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})
