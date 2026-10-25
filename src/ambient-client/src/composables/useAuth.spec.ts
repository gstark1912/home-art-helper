import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clearCsrfToken: vi.fn(),
  apiLogout: vi.fn(),
}))
const { clearCsrfToken, apiLogout } = mocks

vi.mock('@/api/client', () => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
      readonly fields: Record<string, string[]> = {},
      readonly retryAfterSeconds: number | null = null,
    ) {
      super(message)
    }
  }
  class NetworkError extends Error { }
  return {
    ApiError,
    NetworkError,
    clearCsrfToken: mocks.clearCsrfToken,
    fetchCsrf: vi.fn(async () => 'token'),
    fetchSession: vi.fn(),
    login: vi.fn(),
    logout: mocks.apiLogout,
  }
})

import { useAuth } from './useAuth'
import { NetworkError } from '@/api/client'

describe('useAuth.logout', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('cierra sesión con éxito, descarta el token local y pasa a anónimo', async () => {
    apiLogout.mockResolvedValueOnce(undefined)
    const auth = useAuth()
    const ok = await auth.logout()
    expect(ok).toBe(true)
    expect(clearCsrfToken).toHaveBeenCalled()
    expect(auth.status.value).toBe('anonymous')
    expect(auth.authError.value).toBeNull()
  })

  // Regresión P3: ante fallo de red, el logout remoto no se confirma, se
  // informa el error, pero igualmente se limpia el token local y se pasa a
  // anónimo.
  it('comunica el fallo de red del logout pero limpia el estado local', async () => {
    apiLogout.mockRejectedValueOnce(new NetworkError('offline'))
    const auth = useAuth()
    const ok = await auth.logout()
    expect(ok).toBe(false)
    expect(clearCsrfToken).toHaveBeenCalled()
    expect(auth.status.value).toBe('anonymous')
    expect(auth.authError.value).toMatch(/no se pudo confirmar/i)
  })
})
