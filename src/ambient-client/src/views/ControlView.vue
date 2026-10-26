<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import LoginForm from '@/components/LoginForm.vue'
import { useAuth } from '@/composables/useAuth'
import { useDisplayConnection } from '@/composables/useDisplayConnection'
import {
  ApiError,
  NetworkError,
  fetchCsrf,
  screenOff as apiScreenOff,
  screenOn as apiScreenOn,
  sendAnimation,
  sendMessage as apiSendMessage,
} from '@/api/client'
import {
  MESSAGE_DURATION_MAX,
  MESSAGE_DURATION_MIN,
  MESSAGE_PRIORITY_MAX,
  MESSAGE_PRIORITY_MIN,
  MESSAGE_TEXT_MAX,
  PALETTES,
  type AnimationCommand,
  type Palette,
  type Snapshot,
} from '@/protocol/types'

const { status, authError, refreshSession, logout: apiLogout, setUnauthenticated } = useAuth()
const { snapshot, connectionStatus, connect, disconnect, applyCommandResponse, currentGeneration } =
  useDisplayConnection()

const commandError = ref<string | null>(null)
const sending = ref(false)

const animation = computed(() => snapshot.value?.animation ?? null)
const screenIsOn = computed(() => snapshot.value?.screenOn ?? false)
const activeMessage = computed(() => snapshot.value?.message ?? null)

// Formulario de mensaje temporal.
const messageText = ref('')
const messagePriority = ref(MESSAGE_PRIORITY_MIN)
const messageDuration = ref(30)
const canSendMessage = computed(() => messageText.value.trim().length > 0)

const connectionLabel = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'Conectado'
    case 'connecting':
      return 'Conectando…'
    case 'reconnecting':
      return 'Reconectando…'
    case 'disconnected':
      return 'Sin conexión'
    case 'unauthenticated':
      return 'Sesión vencida'
    default:
      return 'Inactivo'
  }
})

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

watch(connectionStatus, (value) => {
  if (value === 'unauthenticated') {
    // Sesión vencida: cerrar conexión, limpiar estado y volver a login.
    setUnauthenticated()
    void disconnect()
  }
})

function onAuthenticated(): void {
  connect()
}

async function logout(): Promise<void> {
  // Detener la conexión y limpiar estado ANTES del logout remoto, para que no
  // se sigan procesando eventos ni quede estado de la sesión anterior. El
  // fallo de red del logout se comunica mediante authError (useAuth).
  await disconnect()
  await apiLogout()
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'unauthenticated') {
      setUnauthenticated()
      return 'La sesión venció. Volvé a emparejar.'
    }
    if (error.code === 'csrf_invalid') {
      // Obtener token nuevo y permitir reintento explícito.
      void fetchCsrf()
      return 'Falló la protección CSRF. Reintentá el comando.'
    }
    if (error.code === 'feature_not_available') {
      return 'Esa función aún no está disponible.'
    }
    if (error.code === 'message_priority_conflict') {
      return 'Hay un mensaje de mayor prioridad en pantalla. Probá con una prioridad mayor o igual.'
    }
    return error.message || 'El comando falló.'
  }
  if (error instanceof NetworkError) {
    return 'No se pudo contactar al servidor.'
  }
  return 'El comando falló.'
}

async function runCommand(action: () => Promise<Snapshot>): Promise<void> {
  if (sending.value) return
  sending.value = true
  commandError.value = null
  // Capturar la generación ANTES de enviar: si la conexión se reinicia mientras
  // el POST está en vuelo, su respuesta pertenece a una generación anterior y
  // no debe sobrescribir el estado vigente.
  const generation = currentGeneration()
  try {
    const result = await action()
    // Aplicar la instantánea devuelta por el comando (no descartarla), con
    // validación de generación/epoch/versión. Si el epoch difiere del vigente,
    // applyCommandResponse fuerza la resincronización.
    applyCommandResponse(result, generation)
  } catch (error) {
    commandError.value = describeError(error)
  } finally {
    sending.value = false
  }
}

function buildAnimationCommand(patch: Partial<AnimationCommand>): AnimationCommand | null {
  const current = animation.value
  if (current === null) return null
  return {
    style: 'particles',
    palette: patch.palette ?? current.palette,
    speed: patch.speed ?? current.speed,
    intensity: patch.intensity ?? current.intensity,
    bpm: patch.bpm !== undefined ? patch.bpm : current.bpm,
  }
}

async function setPalette(palette: Palette): Promise<void> {
  const command = buildAnimationCommand({ palette })
  if (command === null) return
  await runCommand(() => sendAnimation(command))
}

async function setSpeed(value: number): Promise<void> {
  const command = buildAnimationCommand({ speed: value })
  if (command === null) return
  await runCommand(() => sendAnimation(command))
}

async function toggleScreen(): Promise<void> {
  await runCommand(() => (screenIsOn.value ? apiScreenOff() : apiScreenOn()))
}

async function sendMessage(): Promise<void> {
  const text = messageText.value.trim()
  if (text.length === 0) return
  await runCommand(() =>
    apiSendMessage({
      text,
      priority: messagePriority.value,
      durationSeconds: messageDuration.value,
    }),
  )
  // Limpiar el texto sólo si el comando no dejó error (p. ej. 409 lo conserva).
  if (commandError.value === null) {
    messageText.value = ''
  }
}

const speedModel = computed({
  get: () => animation.value?.speed ?? 1,
  set: (value: number) => {
    void setSpeed(value)
  },
})
</script>

<template>
  <main class="control">
    <LoginForm v-if="status !== 'authenticated'" @authenticated="onAuthenticated" />

    <template v-else>
      <header class="control__header">
        <h1 class="control__title">Panel de control</h1>
        <div class="control__status">
          <span class="control__chip" :data-state="connectionStatus">{{ connectionLabel }}</span>
          <button class="control__logout" type="button" @click="logout">Salir</button>
        </div>
      </header>

      <section v-if="snapshot" class="control__state">
        <dl class="control__facts">
          <div><dt>Versión</dt><dd>{{ snapshot.version }}</dd></div>
          <div><dt>Modo</dt><dd>{{ snapshot.baseMode }}</dd></div>
          <div><dt>Pantalla</dt><dd>{{ screenIsOn ? 'Encendida' : 'Apagada' }}</dd></div>
          <div><dt>Paleta</dt><dd>{{ snapshot.animation.palette }}</dd></div>
        </dl>
      </section>
      <p v-else class="control__pending">Esperando estado del servidor…</p>

      <section class="control__group" :aria-disabled="!animation">
        <h2 class="control__label">Paleta</h2>
        <div class="control__buttons">
          <button
            v-for="palette in PALETTES"
            :key="palette"
            type="button"
            class="control__palette"
            :class="{ 'is-active': animation?.palette === palette }"
            :disabled="!animation || sending"
            @click="setPalette(palette)"
          >
            {{ palette }}
          </button>
        </div>
      </section>

      <section class="control__group">
        <h2 class="control__label">Velocidad: {{ speedModel.toFixed(1) }}</h2>
        <input
          v-model.number="speedModel"
          class="control__slider"
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          :disabled="!animation || sending"
        />
      </section>

      <section class="control__group">
        <button
          class="control__power"
          type="button"
          :disabled="!snapshot || sending"
          @click="toggleScreen"
        >
          {{ screenIsOn ? 'Apagar display' : 'Encender display' }}
        </button>
      </section>

      <section class="control__group">
        <h2 class="control__label">Mensaje temporal</h2>
        <p v-if="activeMessage" class="control__hint">
          En pantalla (prioridad {{ activeMessage.priority }}): {{ activeMessage.text }}
        </p>
        <textarea
          v-model="messageText"
          class="control__textarea"
          rows="2"
          :maxlength="MESSAGE_TEXT_MAX"
          placeholder="Ej.: La cena está lista"
          :disabled="!snapshot || sending"
        />
        <div class="control__message-row">
          <label class="control__field">
            Prioridad
            <select v-model.number="messagePriority" :disabled="!snapshot || sending">
              <option
                v-for="p in [MESSAGE_PRIORITY_MIN, 1, MESSAGE_PRIORITY_MAX]"
                :key="p"
                :value="p"
              >
                {{ p }}
              </option>
            </select>
          </label>
          <label class="control__field">
            Duración (s)
            <input
              v-model.number="messageDuration"
              type="number"
              :min="MESSAGE_DURATION_MIN"
              :max="MESSAGE_DURATION_MAX"
              :disabled="!snapshot || sending"
            />
          </label>
        </div>
        <button
          class="control__send"
          type="button"
          :disabled="!snapshot || sending || !canSendMessage"
          @click="sendMessage"
        >
          Enviar mensaje
        </button>
      </section>

      <p v-if="commandError" class="control__error" role="alert">{{ commandError }}</p>
      <p v-if="authError" class="control__error" role="alert">{{ authError }}</p>
    </template>
  </main>
</template>

<style scoped>
.control {
  max-width: 40rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.control__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.control__title {
  margin: 0;
  font-size: 1.3rem;
}
.control__status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.control__chip {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  background: #1e293b;
  color: #cbd5e1;
}
.control__chip[data-state='connected'] {
  background: #064e3b;
  color: #6ee7b7;
}
.control__chip[data-state='disconnected'],
.control__chip[data-state='unauthenticated'] {
  background: #4c1d1d;
  color: #fca5a5;
}
.control__logout {
  background: none;
  border: 1px solid #334155;
  color: #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.3rem 0.7rem;
  cursor: pointer;
}
.control__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.75rem;
  margin: 0;
}
.control__facts dt {
  font-size: 0.75rem;
  color: #94a3b8;
}
.control__facts dd {
  margin: 0.15rem 0 0;
  font-size: 1.1rem;
}
.control__group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.control__label {
  margin: 0;
  font-size: 0.95rem;
  color: #cbd5e1;
}
.control__buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.control__palette {
  flex: 1;
  min-width: 6rem;
  padding: 0.6rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  text-transform: capitalize;
  cursor: pointer;
}
.control__palette.is-active {
  border-color: #38bdf8;
  background: #0b2a3a;
}
.control__slider {
  width: 100%;
}
.control__power {
  padding: 0.8rem;
  border-radius: 0.6rem;
  border: none;
  background: #2563eb;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}
.control__power:disabled,
.control__palette:disabled {
  opacity: 0.5;
  cursor: default;
}
.control__pending {
  color: #94a3b8;
  margin: 0;
}
.control__hint {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.control__textarea {
  width: 100%;
  resize: vertical;
  padding: 0.6rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font: inherit;
}
.control__message-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.control__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #94a3b8;
}
.control__field select,
.control__field input {
  padding: 0.4rem;
  border-radius: 0.4rem;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font: inherit;
}
.control__send {
  align-self: flex-start;
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background: #2563eb;
  color: white;
  font-size: 0.95rem;
  cursor: pointer;
}
.control__send:disabled {
  opacity: 0.5;
  cursor: default;
}
.control__error {
  margin: 0;
  color: #f87171;
}
</style>
