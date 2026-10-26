<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { MessageState } from '@/protocol/types'
import { computeTiming, isExpired, remainingMs, type MessageTiming } from '@/state/messageExpiry'

const props = defineProps<{
  message: MessageState
  // Reloj del servidor al capturar la instantánea (para estimar vencimiento).
  serverTimeUtc: string
}>()

// Reloj monótono local; aislado para poder sustituirlo en pruebas.
function monotonicNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

const timing = ref<MessageTiming | null>(null)
// El mensaje se oculta localmente al vencer, sin mutar el estado del servidor.
const locallyExpired = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function schedule(): void {
  clearTimer()
  const current = timing.value
  if (current === null) {
    locallyExpired.value = true
    return
  }
  const remaining = remainingMs(current, monotonicNow())
  if (remaining <= 0) {
    locallyExpired.value = true
    return
  }
  locallyExpired.value = false
  timer = setTimeout(() => {
    locallyExpired.value = isExpired(current, monotonicNow())
  }, remaining)
}

// Recalcular la temporización cuando cambia el mensaje o el reloj del servidor.
// Una instantánea duplicada (mismo id) no reinicia el vencimiento.
watch(
  () => [props.message.id, props.message.expiresAtUtc, props.serverTimeUtc] as const,
  ([id]) => {
    if (timing.value !== null && timing.value.id === id) {
      // Mismo mensaje: conservar la temporización previa (no reiniciar).
      schedule()
      return
    }
    timing.value = computeTiming(props.message, props.serverTimeUtc, monotonicNow())
    schedule()
  },
  { immediate: true },
)

// Liberar el timer al desmontar (requisito de recursos).
onBeforeUnmount(clearTimer)

const visible = computed(() => !locallyExpired.value)
</script>

<template>
  <!-- Texto plano: interpolación, nunca v-html. Saltos de línea con pre-wrap. -->
  <div v-if="visible" class="message-overlay" role="status" aria-live="polite">
    <p class="message-overlay__text">{{ message.text }}</p>
  </div>
</template>

<style scoped>
.message-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 6vmin;
  background: rgba(2, 6, 23, 0.62);
  animation: message-overlay-in 320ms ease-out;
}
.message-overlay__text {
  margin: 0;
  max-width: 80vw;
  color: #f8fafc;
  font-size: clamp(2rem, 7vmin, 5rem);
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.55);
}
@keyframes message-overlay-in {
  from {
    opacity: 0;
    transform: translateY(1.5vmin);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
