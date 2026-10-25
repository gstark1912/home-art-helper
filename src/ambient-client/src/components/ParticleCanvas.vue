<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnimationState } from '@/protocol/types'
import { ParticleRenderer } from '@/canvas/ParticleRenderer'

const props = defineProps<{
  animation: AnimationState
  // El apagado lógico detiene el render; encender lo reanuda.
  active: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: ParticleRenderer | null = null

function syncRunning(): void {
  if (renderer === null) return
  if (props.active) {
    renderer.start()
  } else {
    renderer.stop()
  }
}

onMounted(() => {
  if (canvasRef.value === null) return
  renderer = new ParticleRenderer(canvasRef.value, props.animation)
  syncRunning()
})

watch(
  () => props.animation,
  (animation) => {
    renderer?.setAnimation(animation)
  },
)

watch(
  () => props.active,
  () => {
    syncRunning()
  },
)

onBeforeUnmount(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <canvas ref="canvasRef" class="particle-canvas" />
</template>

<style scoped>
.particle-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
