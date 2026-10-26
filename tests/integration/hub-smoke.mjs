// Verificación de integración de SignalR para T005.
// Ejecuta el recorrido real: un "display" se conecta al hub autenticado por
// cookie, recibe la instantánea vigente y debe recibir un push StateChanged
// cuando un "control" cambia la animación por HTTP. No deja secretos: la clave
// se pasa por argumento/entorno.
//
// Uso: node hub-smoke.mjs <baseUrl> <pairingKey>
// Requiere @microsoft/signalr instalado (está en src/ambient-client/node_modules).

// El paquete vive en src/ambient-client/node_modules. Se resuelve por ruta
// absoluta (SIGNALR_PATH) para poder ejecutar este script desde cualquier cwd.
const signalrPath = process.env.SIGNALR_PATH ?? '@microsoft/signalr'
const signalrMod = await import(signalrPath)
// La build CJS expone todo bajo .default al importarse como ESM.
const { HubConnectionBuilder, LogLevel } = signalrMod.HubConnectionBuilder ? signalrMod : signalrMod.default

const base = process.argv[2] ?? 'http://localhost:5189'
const key = process.argv[3] ?? process.env.AMBIENT_PAIRING_KEY
if (!key) {
  console.error('FAIL: falta la pairing key (arg 2 o AMBIENT_PAIRING_KEY)')
  process.exit(2)
}
const origin = base

// Mini gestor de cookies para fetch (Node no las conserva solo).
const jar = new Map()
function storeCookies(res) {
  const set = res.headers.getSetCookie?.() ?? []
  for (const c of set) {
    const [pair] = c.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}
async function req(path, { method = 'GET', body } = {}) {
  const headers = { Origin: origin, Accept: 'application/json' }
  const cookie = cookieHeader()
  if (cookie) headers.Cookie = cookie
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    headers['X-CSRF-Token'] = csrf ?? ''
  }
  const res = await fetch(base + path, { method, headers, body })
  storeCookies(res)
  return res
}

let csrf = null
async function getCsrf() {
  const res = await req('/api/auth/csrf')
  csrf = (await res.json()).csrfToken
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

const results = []
function check(label, ok, extra = '') {
  results.push({ label, ok })
  console.log(`${ok ? 'OK ' : 'FAIL'} ${label}${extra ? ' :: ' + extra : ''}`)
}

async function main() {
  await getCsrf()
  const login = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ pairingKey: key }) })
  check('login', login.status === 200, `HTTP ${login.status}`)
  await getCsrf() // renovar token tras login

  // Conectar al hub como "display" con la cookie de sesión.
  let received = []
  const connection = new HubConnectionBuilder()
    .withUrl(base + '/hubs/display', {
      headers: { 'X-CSRF-Token': csrf ?? '', Cookie: cookieHeader(), Origin: origin },
    })
    .configureLogging(LogLevel.Error)
    .build()

  connection.on('StateChanged', (snap) => { received.push(snap) })
  await connection.start()
  check('hub conectado', connection.state === 'Connected', connection.state)

  const initial = await connection.invoke('GetSnapshot')
  check('GetSnapshot devuelve instantánea', initial && typeof initial.version === 'number',
    `version=${initial?.version} palette=${initial?.animation?.palette}`)

  // El "control" cambia la animación por HTTP; el display debe recibir push.
  received = []
  const target = initial.animation.palette === 'ocean' ? 'sunset' : 'ocean'
  const cmd = await req('/api/display/animation', {
    method: 'POST',
    body: JSON.stringify({ style: 'particles', palette: target, speed: 1.2, intensity: 0.6, bpm: null }),
  })
  check('comando animación HTTP', cmd.status === 200, `HTTP ${cmd.status}`)

  // Esperar el push (hasta ~2 s).
  for (let i = 0; i < 20 && received.length === 0; i++) await sleep(100)
  const pushed = received.at(-1)
  check('push StateChanged recibido en el display', !!pushed,
    pushed ? `palette=${pushed.animation?.palette} version=${pushed.version}` : 'sin push')
  check('push refleja el comando', pushed?.animation?.palette === target && pushed?.version > initial.version,
    pushed ? `esperado=${target} recibido=${pushed.animation?.palette}` : '')

  // Apagado lógico propagado.
  received = []
  const off = await req('/api/display/screen/off', { method: 'POST', body: '{}' })
  check('comando apagar HTTP', off.status === 200, `HTTP ${off.status}`)
  for (let i = 0; i < 20 && received.length === 0; i++) await sleep(100)
  const offPush = received.at(-1)
  check('push apagado recibido', offPush?.screenOn === false, `screenOn=${offPush?.screenOn}`)

  await connection.stop()

  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.log(`\nHUB-SMOKE-FAIL (${failed.length} fallos)`)
    process.exit(1)
  }
  console.log('\nHUB-SMOKE-OK')
}

main().catch((e) => { console.error('ERROR', e); process.exit(1) })
