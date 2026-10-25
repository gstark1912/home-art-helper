// Renderizador de partículas sobre Canvas 2D. Framework-agnóstico.
//
// Cumple los requisitos de rendimiento del diseño:
// - Límite de partículas y densidad por área.
// - devicePixelRatio acotado para no reventar la GPU de una tablet barata.
// - Objetivo de ~30 FPS: se descarta el frame si no pasó el intervalo mínimo.
// - start()/stop() controlan requestAnimationFrame; destroy() libera recursos.
//
// El apagado lógico (screenOn=false) se maneja deteniendo el renderer desde el
// componente, no dibujando negro en bucle.

import type { AnimationState } from '@/protocol/types'
import { PALETTE_COLORS } from './palettes'

const TARGET_FPS = 30
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS
const MAX_PARTICLES = 220
const PARTICLES_PER_MEGAPIXEL = 140
const MAX_PIXEL_RATIO = 2

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  colorIndex: number
  phase: number
}

export class ParticleRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private animation: AnimationState
  private particles: Particle[] = []
  private rafId: number | null = null
  private lastFrameTime = 0
  private running = false
  private cssWidth = 0
  private cssHeight = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    animation: AnimationState,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (ctx === null) {
      throw new Error('Canvas 2D no disponible.')
    }
    this.ctx = ctx
    this.animation = animation
    this.resize()
    this.seedParticles()
    this.observeResize()
  }

  /** Cantidad de partículas acotada por área y por tope absoluto. */
  private targetParticleCount(): number {
    const megapixels = (this.cssWidth * this.cssHeight) / 1_000_000
    const byDensity = Math.round(megapixels * PARTICLES_PER_MEGAPIXEL)
    const byIntensity = Math.round(byDensity * (0.3 + 0.7 * this.animation.intensity))
    return Math.max(12, Math.min(MAX_PARTICLES, byIntensity))
  }

  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return
    this.resizeObserver = new ResizeObserver(() => {
      this.resize()
      this.reconcileParticleCount()
    })
    this.resizeObserver.observe(this.canvas)
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(
      MAX_PIXEL_RATIO,
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    )
    this.cssWidth = Math.max(1, rect.width)
    this.cssHeight = Math.max(1, rect.height)
    this.canvas.width = Math.round(this.cssWidth * dpr)
    this.canvas.height = Math.round(this.cssHeight * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private createParticle(): Particle {
    const colors = PALETTE_COLORS[this.animation.palette].particles
    return {
      x: Math.random() * this.cssWidth,
      y: Math.random() * this.cssHeight,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      radius: 1.5 + Math.random() * 3.5,
      colorIndex: Math.floor(Math.random() * colors.length),
      phase: Math.random() * Math.PI * 2,
    }
  }

  private seedParticles(): void {
    const count = this.targetParticleCount()
    this.particles = Array.from({ length: count }, () => this.createParticle())
  }

  private reconcileParticleCount(): void {
    const target = this.targetParticleCount()
    while (this.particles.length < target) {
      this.particles.push(this.createParticle())
    }
    if (this.particles.length > target) {
      this.particles.length = target
    }
  }

  /** Actualiza la animación vigente sin recrear el renderer. */
  setAnimation(animation: AnimationState): void {
    const paletteChanged = animation.palette !== this.animation.palette
    this.animation = animation
    if (paletteChanged) {
      const colors = PALETTE_COLORS[animation.palette].particles
      for (const p of this.particles) {
        p.colorIndex = Math.min(p.colorIndex, colors.length - 1)
      }
    }
    this.reconcileParticleCount()
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastFrameTime = 0
    this.rafId = requestAnimationFrame(this.loop)
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /** Libera todos los recursos. Llamar al desmontar. */
  destroy(): void {
    this.stop()
    if (this.resizeObserver !== null) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.particles = []
  }

  private readonly loop = (now: number): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.loop)

    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now
      return
    }
    const elapsed = now - this.lastFrameTime
    if (elapsed < FRAME_INTERVAL_MS) {
      return
    }
    const dt = Math.min(elapsed, 100) / 1000
    this.lastFrameTime = now
    this.update(dt)
    this.render()
  }

  private update(dt: number): void {
    const speed = this.animation.speed
    for (const p of this.particles) {
      p.x += p.vx * speed * dt
      p.y += p.vy * speed * dt
      p.phase += dt * speed
      if (p.x < -10) p.x = this.cssWidth + 10
      if (p.x > this.cssWidth + 10) p.x = -10
      if (p.y < -10) p.y = this.cssHeight + 10
      if (p.y > this.cssHeight + 10) p.y = -10
    }
  }

  private render(): void {
    const palette = PALETTE_COLORS[this.animation.palette]
    this.ctx.fillStyle = palette.background
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight)

    const colors = palette.particles
    for (const p of this.particles) {
      const color = colors[p.colorIndex] ?? colors[0]!
      const alpha = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(p.phase))
      this.ctx.beginPath()
      this.ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha.toFixed(3)})`
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }
}
