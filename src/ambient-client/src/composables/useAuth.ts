// Estado de autenticación compartido. Mantiene el token CSRF en memoria vía
// el cliente HTTP y expone login/logout/estado para /control y /display.

import { readonly, ref } from 'vue'
import {
  ApiError,
  NetworkError,
  clearCsrfToken,
  fetchCsrf,
  fetchSession,
  login as apiLogin,
  logout as apiLogout,
} from '@/api/client'

export type AuthStatus = 'unknown' | 'anonymous' | 'authenticated'

const status = ref<AuthStatus>('unknown')
const authError = ref<string | null>(null)
const busy = ref(false)

export function useAuth() {
  async function refreshSession(): Promise<void> {
    try {
      const session = await fetchSession()
      status.value = session.authenticated ? 'authenticated' : 'anonymous'
      if (session.authenticated) {
        // Asegura un token CSRF válido para comandos posteriores.
        await fetchCsrf()
      }
    } catch {
      status.value = 'anonymous'
    }
  }

  async function login(pairingKey: string): Promise<boolean> {
    busy.value = true
    authError.value = null
    try {
      // Obtener token anónimo antes del login si no existe.
      await fetchCsrf()
      await apiLogin(pairingKey)
      status.value = 'authenticated'
      return true
    } catch (error) {
      authError.value = messageFor(error)
      return false
    } finally {
      busy.value = false
    }
  }

  /**
   * Cierra sesión. Devuelve true si el logout remoto tuvo éxito. Ante fallo de
   * red, el logout remoto NO se confirma: se informa el error y se advierte que
   * la sesión remota puede seguir activa, pero igualmente se pasa a anónimo
   * localmente y se descarta el token CSRF local.
   */
  async function logout(): Promise<boolean> {
    busy.value = true
    authError.value = null
    let ok = false
    try {
      await apiLogout()
      ok = true
    } catch (error) {
      authError.value =
        error instanceof NetworkError
          ? 'No se pudo confirmar el cierre de sesión con el servidor; puede seguir activa remotamente.'
          : messageFor(error)
    } finally {
      // En cualquier caso: estado local anónimo y token local descartado.
      clearCsrfToken()
      status.value = 'anonymous'
      busy.value = false
    }
    return ok
  }

  function setUnauthenticated(): void {
    status.value = 'anonymous'
  }

  return {
    status: readonly(status),
    authError: readonly(authError),
    busy: readonly(busy),
    refreshSession,
    login,
    logout,
    setUnauthenticated,
  }
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'Clave de emparejamiento incorrecta.'
      case 'rate_limited':
        return error.retryAfterSeconds !== null
          ? `Demasiados intentos. Reintentá en ${error.retryAfterSeconds} s.`
          : 'Demasiados intentos. Esperá e intentá de nuevo.'
      case 'csrf_invalid':
      case 'origin_rejected':
        return 'Falló la protección de seguridad. Recargá la página e intentá de nuevo.'
      case 'invalid_request':
        return 'La clave debe tener entre 1 y 256 caracteres.'
      default:
        return error.message || 'No se pudo iniciar sesión.'
    }
  }
  if (error instanceof NetworkError) {
    return 'No se pudo contactar al servidor.'
  }
  return 'No se pudo iniciar sesión.'
}
