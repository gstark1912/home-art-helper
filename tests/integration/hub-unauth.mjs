// Verifica que el hub RECHAZA una conexión sin sesión con un 401 real.
//
// Importante (corrección de revisión): un fallo de red o un servidor caído NO
// debe acreditar la seguridad. El test exige que el servidor esté operativo y
// que la negociación falle específicamente con 401/unauthenticated; cualquier
// otro error (ECONNREFUSED, fetch failed, timeout, etc.) es FALLO del test.
//
// Uso: node hub-unauth.mjs <baseUrl>
const signalrPath = process.env.SIGNALR_PATH ?? '@microsoft/signalr'
const signalrMod = await import(signalrPath)
const { HubConnectionBuilder, LogLevel } = signalrMod.HubConnectionBuilder ? signalrMod : signalrMod.default

const base = process.argv[2] ?? 'http://localhost:5189'

function fail(msg) {
  console.log('FAIL: ' + msg)
  process.exit(1)
}

// 1) El servidor debe estar operativo. Si no responde, el test falla (no se
//    "aprueba" la seguridad por una caída). Se usa un endpoint anónimo (200).
try {
  const res = await fetch(base + '/api/auth/session', {
    method: 'GET',
    headers: { Origin: base, Accept: 'application/json' },
  })
  if (!res.ok) fail(`el servidor respondió HTTP ${res.status} en /api/auth/session; se esperaba 200. ¿Servidor correcto en ${base}?`)
  await res.json().catch(() => undefined)
} catch (e) {
  fail(`el servidor no está accesible en ${base} (${(e && e.message) || e}). Arrancá el servidor antes de este test; una caída NO acredita la seguridad.`)
}

// 2) El hub debe rechazar la conexión sin sesión con 401 en la negociación.
const connection = new HubConnectionBuilder()
  .withUrl(base + '/hubs/display', { headers: { Origin: base } })
  .configureLogging(LogLevel.None)
  .build()

function isUnauthorized(message) {
  // El cliente SignalR reporta el status de la negociación en el mensaje.
  // Exigimos la señal explícita de 401/unauthenticated.
  return /Status code '401'/.test(message) || /\bunauthenticated\b/.test(message)
}

try {
  await connection.start()
  await connection.stop().catch(() => undefined)
  fail('el hub aceptó una conexión sin autenticación, estado=' + connection.state)
} catch (e) {
  const msg = (e && e.message) ? e.message : String(e)
  if (isUnauthorized(msg)) {
    console.log('OK  hub rechaza conexión sin sesión con 401 :: ' + msg.split('\n')[0])
    process.exit(0)
  }
  // Un error que NO es 401 (red, DNS, servidor caído, 500, etc.) es un fallo:
  // no prueba que el hub exija autenticación.
  fail('la conexión falló por un motivo distinto de 401; no acredita el rechazo por autenticación :: ' + msg.split('\n')[0])
}
