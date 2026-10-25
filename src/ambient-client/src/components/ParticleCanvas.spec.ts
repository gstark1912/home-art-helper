import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AnimationState } from '@/protocol/types'

const instances: Array<{
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  setAnimation: ReturnType<typeof vi.fn>
}> = []

vi.mock('@/canvas/ParticleRenderer', () => {
  class ParticleRenderer {
    start = vi.fn()
    stop = vi.fn()
    destroy = vi.fn()
    setAnimation = vi.fn()
    constructor() {
      instances.push(this)
    }
  }
  return { ParticleRenderer }
})

import ParticleCanvas from './ParticleCanvas.vue'

const animation: AnimationState = {
  style: 'particles',
  palette: 'aurora',
  speed: 1,
  intensity: 0.5,
  bpm: null,
}

describe('ParticleCanvas', () => {
  afterEach(() => {
    instances.length = 0
    vi.clearAllMocks()
  })

  it('arranca el render cuando está activo', () => {
    mount(ParticleCanvas, { props: { animation, active: true } })
    const renderer = instances[0]!
    expect(renderer.start).toHaveBeenCalledTimes(1)
    expect(renderer.stop).not.toHaveBeenCalled()
  })

  it('detiene el render al apagar y lo reanuda al encender', async () => {
    const wrapper = mount(ParticleCanvas, { props: { animation, active: true } })
    const renderer = instances[0]!

    await wrapper.setProps({ active: false })
    expect(renderer.stop).toHaveBeenCalled()

    await wrapper.setProps({ active: true })
    expect(renderer.start).toHaveBeenCalledTimes(2)
  })

  it('libera recursos al desmontar', () => {
    const wrapper = mount(ParticleCanvas, { props: { animation, active: true } })
    const renderer = instances[0]!
    wrapper.unmount()
    expect(renderer.destroy).toHaveBeenCalledTimes(1)
  })

  it('propaga cambios de animación al renderer', async () => {
    const wrapper = mount(ParticleCanvas, { props: { animation, active: true } })
    const renderer = instances[0]!
    await wrapper.setProps({ animation: { ...animation, palette: 'ocean' } })
    expect(renderer.setAnimation).toHaveBeenCalled()
  })
})
