// Cliente HTTP de autenticación y comandos. Sigue docs/contracts/display-protocol.md.
// Usa rutas relativas (mismo origen / proxy Vite); el navegador agrega Origin y
// envía la cookie de sesión. El token CSRF se mantiene sólo en memoria.

import type {
  AnimationCommand,
  ApiErrorBody,
  SessionState,
  Snapshot,
} from '@/protocol/types'
import { parseSnapshot } from '@/protocol/snapshot'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string[]> = {},
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Error de transporte/red sin cuerpo JSON de aplicación. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

let csrfToken: string | null = null

export function getCsrfToken(): string | null {
  return csrfToken
}

export function clearCsrfToken(): void {
  csrfToken = null
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const err = (value as { error?: unknown }).error
  if (typeof err !== 'object' || err === null) return false
  const e = err as Record<string, unknown>
  return typeof e.code === 'string' && typeof e.message === 'string'
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  const retryAfterHeader = response.headers.get('Retry-After')
  const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null
  const retryAfterSeconds = retryAfter !== null && Number.isFinite(retryAfter) ? retryAfter : null

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (isApiErrorBody(body)) {
    const fields =
      typeof body.error.fields === 'object' && body.error.fields !== null
        ? body.error.fields
        : {}
    return new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      fields,
      retryAfterSeconds,
    )
  }

  // Restricción HTTP ajena a la aplicación (proxy, transporte): sin JSON.
  return new ApiError(
    response.status,
    'transport_error',
    `Respuesta sin formato de aplicación (HTTP ${response.status}).`,
    {},
    retryAfterSeconds,
  )
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new NetworkError('No se pudo contactar al servidor.')
  }
  if (!response.ok) {
    throw await parseErrorResponse(response)
  }
  return (await response.json()) as T
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (csrfToken === null) {
    // Un POST sin token previo fallaría por CSRF; forzamos la obtención.
    await fetchCsrf()
  }

  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken ?? '',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new NetworkError('No se pudo contactar al servidor.')
  }

  if (!response.ok) {
    throw await parseErrorResponse(response)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export async function fetchCsrf(): Promise<string> {
  const data = await getJson<{ csrfToken: string }>('/api/auth/csrf')
  csrfToken = data.csrfToken
  return data.csrfToken
}

export async function fetchSession(): Promise<SessionState> {
  return getJson<SessionState>('/api/auth/session')
}

export async function login(pairingKey: string): Promise<void> {
  await postJson<{ authenticated: boolean }>('/api/auth/login', { pairingKey })
  // El token anónimo previo al login no se reutiliza: renovarlo.
  await fetchCsrf()
}

export async function logout(): Promise<void> {
  await postJson<void>('/api/auth/logout', {})
  clearCsrfToken()
}

function parseSnapshotResponse(value: unknown): Snapshot {
  const snapshot = parseSnapshot(value)
  if (snapshot === null) {
    throw new NetworkError('El servidor devolvió una instantánea inválida.')
  }
  return snapshot
}

export async function fetchStatus(): Promise<Snapshot> {
  return parseSnapshotResponse(await getJson<unknown>('/api/display/status'))
}

export async function sendAnimation(command: AnimationCommand): Promise<Snapshot> {
  return parseSnapshotResponse(await postJson<unknown>('/api/display/animation', command))
}

export async function screenOff(): Promise<Snapshot> {
  return parseSnapshotResponse(await postJson<unknown>('/api/display/screen/off', {}))
}

export async function screenOn(): Promise<Snapshot> {
  return parseSnapshotResponse(await postJson<unknown>('/api/display/screen/on', {}))
}
