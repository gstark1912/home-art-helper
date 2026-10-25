<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import LoginForm from '@/components/LoginForm.vue'
import ParticleCanvas from '@/components/ParticleCanvas.vue'
import { useAuth } from '@/composables/useAuth'
import { useDisplayConnection } from '@/composables/useDisplayConnection'

const { status, refreshSession, setUnauthenticated } = useAuth()
const { snapshot, connectionStatus, connect, disconnect } = useDisplayConnection()

// Fullscreen requiere un gesto inicial del usuario en el navegador.
const needsGesture = ref(true)

const screenOn = computed(() => snapshot.value?.screenOn ?? false)
const animation = computed(() => snapshot.value?.animation ?? null)

// El render se detiene si la pantalla está apagada (precedencia visual).
const renderActive = computed(() => screenOn.value && snapshot.value !== null)

onMounted(async () => {
  await refreshSession()
  if (status.value === 'authenticated') {
    connect()
  }
})

watch(status, (value) => {
  if (value === 'authenticated') {
    connect()
  }
})

// Si el hub reporta 401, cerrar conexión, limpiar estado y pedir emparejamiento.
watch(connectionStatus, (value) => {
  if (value === 'unauthenticated') {
    setUnauthenticated()
    void disconnect()
  }
})

function onAuthenticated(): void {
  connect()
}

async function enterFullscreen(): Promise<void> {
  needsGesture.value = false
  try {
    await document.documentElement.requestFullscreen()
  } catch {
    // Chrome puede rechazar fullscreen silencioso; el gesto ya se consumió.
  }
}
</script>

<template>
  <div class="display">
    <LoginForm v-if="status !== 'authenticated'" @authenticated="onAuthenticated" />

    <template v-else>
      <ParticleCanvas
        v-if="animation"
        class="display__canvas"
        :class="{ 'display__canvas--hidden': !screenOn }"
        :animation="animation"
        :active="renderActive"
      />

      <!-- Apagado lógico: negro con precedencia sobre el contenido. -->
      <div v-if="!screenOn" class="display__off" aria-hidden="true" />

      <!-- Estado de conexión sutil mientras aún no hay instantánea. -->
      <div v-if="!snapshot" class="display__pending">Conectando al servidor…</div>

      <button
        v-if="needsGesture"
        class="display__fullscreen"
        type="button"
        @click="enterFullscreen"
      >
        Pantalla completa
      </button>
    </template>
  </div>
</template>

<style scoped>
.display {
  position: fixed;
  inset: 0;
  background: #000;
  overflow: hidden;
}
.display__canvas {
  position: absolute;
  inset: 0;
}
.display__canvas--hidden {
  visibility: hidden;
}
.display__off {
  position: absolute;
  inset: 0;
  background: #000;
}
.display__pending {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #475569;
  font-size: 0.9rem;
}
.display__fullscreen {
  position: absolute;
  bottom: 1.2rem;
  right: 1.2rem;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid #334155;
  background: rgba(15, 23, 42, 0.7);
  color: #e2e8f0;
  font-size: 0.85rem;
  cursor: pointer;
}
</style>
