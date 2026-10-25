<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const emit = defineEmits<{ (e: 'authenticated'): void }>()

const { authError, busy, login } = useAuth()
const pairingKey = ref('')

async function onSubmit(): Promise<void> {
  if (pairingKey.value.length === 0) return
  const ok = await login(pairingKey.value)
  if (ok) {
    pairingKey.value = ''
    emit('authenticated')
  }
}
</script>

<template>
  <form class="login" @submit.prevent="onSubmit">
    <h1 class="login__title">Home&amp;Art Helper</h1>
    <p class="login__hint">Introducí la clave de emparejamiento local.</p>
    <label class="login__label" for="pairing-key">Clave de emparejamiento</label>
    <input
      id="pairing-key"
      v-model="pairingKey"
      class="login__input"
      type="password"
      autocomplete="off"
      maxlength="256"
      :disabled="busy"
    />
    <button class="login__button" type="submit" :disabled="busy || pairingKey.length === 0">
      {{ busy ? 'Conectando…' : 'Emparejar' }}
    </button>
    <p v-if="authError" class="login__error" role="alert">{{ authError }}</p>
  </form>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: 22rem;
  margin: 10vh auto 0;
  padding: 1.5rem;
}
.login__title {
  margin: 0;
  font-size: 1.4rem;
}
.login__hint {
  margin: 0;
  color: #94a3b8;
  font-size: 0.9rem;
}
.login__label {
  font-size: 0.85rem;
  color: #cbd5e1;
}
.login__input,
.login__button {
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  font-size: 1rem;
}
.login__input {
  background: #0f172a;
  color: #e2e8f0;
}
.login__button {
  background: #2563eb;
  color: white;
  border: none;
  cursor: pointer;
}
.login__button:disabled {
  opacity: 0.5;
  cursor: default;
}
.login__error {
  margin: 0;
  color: #f87171;
  font-size: 0.9rem;
}
</style>
