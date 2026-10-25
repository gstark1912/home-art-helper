# T004 — Panel y display Canvas

- Estado: done
- Responsable: Kiro/kiro-7f3a2c9e-task-selection
- Revisor activo: ninguno
- Actualizado: 2026-10-25T20:39:40.9910537-03:00
- Dependencias: T001 done
- Bloqueo: ninguno

## Objetivo

Vue con panel externo y display visual, conectados al servidor mediante el contrato aprobado. El display es el mismo en escritorio y Android.

## Alcance y archivos reservados

`src/ambient-client/**`. Dueño único de package.json y lockfile dentro de esa carpeta. No crear package.json raíz ni editar backend, README, contrato o tareas ajenas.

## Fuera de alcance

Simulador web con marco, música, mensajes, WebView nativo y control físico de pantalla.

## Entradas y contratos

`docs/contracts/display-protocol.md` de T001. Puede trabajar con ejemplos de ese contrato antes de T003, pero no declarar integración real hasta T005.

## Criterios de aceptación

- [x] Vue 3, Vite, TypeScript estricto; builds reproducibles con lockfile y proxy configurable.
- [x] `/control` muestra login, estado y botones para paleta/velocidad y apagado lógico; comunica fallos reales.
- [x] `/display` muestra login si hace falta y luego exclusivamente Canvas; fullscreen mediante gesto inicial cuando sea necesario.
- [x] Partículas estéticas con recursos locales, límite de densidad/píxel y objetivo de 30 FPS.
- [x] Detener animaciones al apagar; reanudarlas al encender; liberar recursos al desmontar.
- [x] Reconexión inicial y posterior; recibir estado vigente y descartar versiones viejas.
- [x] Pruebas relevantes de aplicación de instantáneas, reconexión y pausa; no sustituir evidencia funcional por mocks.

## Verificación

Desde `src/ambient-client`: `npm ci`, `npm run build`, `npm test` (definir script reproducible). Registrar pruebas visuales ejecutadas y las pendientes para integración.

## Entrega

**Autor:** Kiro/kiro-7f3a2c9e-task-selection — 2026-10-25T20:12:30-03:00

### Resumen
Scaffold completo del frontend Vue 3 + Vite + TypeScript estricto en
`src/ambient-client/`, con vistas independientes `/control` y `/display`
conectadas al servidor mediante el contrato `docs/contracts/display-protocol.md`.
Implementa autenticación por clave con CSRF, cliente SignalR con reconexión y
orden por generación/epoch/versión, y un renderizador de partículas Canvas 2D
con control de densidad, dpr y 30 FPS. No se declara integración real con el
servidor: eso se cierra en T005. No se tocó backend, README, contrato ni tareas
ajenas.

### Archivos (todos bajo `src/ambient-client/`, único alcance reservado)
Configuración: `package.json`, `package-lock.json`, `tsconfig.json`,
`tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`,
`index.html`, `.env.example`.
Fuente:
- `src/main.ts`, `src/App.vue`, `src/router.ts`, `src/styles.css`, `src/env.d.ts`
- `src/protocol/types.ts`, `src/protocol/snapshot.ts` (tipos y validación del contrato)
- `src/state/applySnapshot.ts` (lógica pura de aceptación), `src/state/displayStore.ts`
- `src/api/client.ts` (auth/CSRF/comandos), `src/api/hub.ts` (SignalR + reconexión)
- `src/canvas/palettes.ts`, `src/canvas/ParticleRenderer.ts`
- `src/composables/useAuth.ts`, `src/composables/useDisplayConnection.ts`
- `src/components/LoginForm.vue`, `src/components/ParticleCanvas.vue`
- `src/views/ControlView.vue`, `src/views/DisplayView.vue`
Pruebas: `src/protocol/snapshot.spec.ts`, `src/state/applySnapshot.spec.ts`,
`src/state/displayStore.spec.ts`, `src/api/hub.spec.ts`,
`src/components/ParticleCanvas.spec.ts`.

### Comandos ejecutados y resultados reales (desde `src/ambient-client/`)
- `npm install` → 222 paquetes, lockfile generado. Node v22.17.1 / npm 11.7.0.
  (`npm audit` reporta vulnerabilidades en dependencias transitivas de tooling
  de desarrollo; no se aplicó `audit fix --force` para no romper versiones.)
- `npm run build` (`vue-tsc --noEmit -p tsconfig.app.json && vite build`) →
  type-check estricto sin errores; bundle de producción generado en `dist/`.
  Advertencias no bloqueantes: comentarios `/*#__PURE__*/` de @microsoft/signalr.
- `npm test` (`vitest run`) → **5 archivos, 26 pruebas, todas pasan**.

### Verificado (automatizado)
- Aplicación de instantáneas: aceptación por versión creciente, descarte de
  duplicados/regresiones, reemplazo por epoch nuevo (reinicio del servidor) y
  descarte de generaciones obsoletas (`applySnapshot.spec`, `displayStore.spec`).
- Validación de contrato: enums, rangos, bpm entero, `style=particles`,
  artworkId acotado, version entera ≥ 0 (`snapshot.spec`).
- Reconexión: start inicial fallido reintenta con las esperas 0/2/5/10/30 s
  (`RETRY_DELAYS_MS`); GetSnapshot tras conectar; detención de reintentos ante
  401/unauthenticated (`hub.spec`, con SignalR mockeado y timers falsos).
- Pausa/reanudación del render y liberación al desmontar (`ParticleCanvas.spec`,
  con el renderer mockeado).

### Pendiente / limitaciones (no bloquea el review)
- **Integración real con el servidor T003 no ejecutada**: se cierra en T005. No
  se ha corrido el recorrido panel→servidor→display con dos ventanas reales ni
  verificación en Android Emulator.
- **Evidencia visual del Canvas no capturada** en este entorno (sin navegador en
  la sesión). El renderer se probó por unidad con mock; su render real sobre
  pixeles se validará en T005 junto al servidor.
- Puerto del proxy de desarrollo es un parámetro (`VITE_PROXY_TARGET`, default
  `http://127.0.0.1:5173` en `.env.example`); el valor concreto se acuerda en T005.
- Música y mensajes son fuera de alcance: tipos presentes en el protocolo, sin UI.

### Decisiones nuevas (dentro del alcance de T004)
- Alias de importación `@/` → `src/`.
- Validación defensiva de instantáneas en el cliente (`parseSnapshot`) que
  descarta payloads malformados sin romper, respetando que el servidor es la
  autoridad del estado.
- Paletas como colores RGB locales (sin assets de red) en `canvas/palettes.ts`.
- Build con `vue-tsc --noEmit` para evitar emisión de `.js` junto a los `.ts`.

### Commit
Sin commit. Cambios sólo en working tree (archivos nuevos sin versionar bajo
`src/ambient-client/`). `git status` muestra además trabajo ajeno de T003
(`src/Ambient.Server/**`, `HomeArtHelper.slnx`, `global.json`, `tests/`) que no
fue tocado por esta tarea.

### Revisión
Pendiente de otro agente o del usuario. Revisor activo: ninguno.

### Para continuar
- Revisar criterios contra `src/ambient-client/**`; ejecutar `npm ci && npm run
  build && npm test` para reproducir.
- T005 puede integrar con T003 cuando el servidor esté en `review`/`done`:
  ajustar `VITE_PROXY_TARGET` al puerto real y validar el recorrido con dos
  ventanas y, luego, el emulador.



## Revisión independiente — requiere correcciones

Revisor: Codex/01a17555-7620-77e3-9dd4-24056763a55e. Fecha: 2026-10-25T20:16:43.3169410-03:00. Resultado: rechazada; vuelve a ready sin responsable activo. Autoría de la implementación: Kiro/kiro-7f3a2c9e-task-selection, conservada en la entrega anterior. No se modificó código de producto ni se tomó la corrección en este turno.

Hallazgos:

1. P1 — src/state/applySnapshot.ts:53 y src/state/displayStore.ts:26-30. Un epoch diferente se acepta dentro de la misma generación, contrariando el contrato que exige resincronizar con una nueva conexión. Reproducción ejecutando la función real mediante transpileModule de TypeScript: desde A/version 10, B/version 0 se aplica y luego A/version 9 también se aplica; termina A/9. Además beginGeneration borra la versión previa, por lo que una primera captura retrasada del mismo epoch puede hacer retroceder el contenido tras reconectar. Corregir la confirmación de epoch y preservar el orden de versiones cuando el epoch no cambia; cubrir eventos/respuestas demorados y reconexión.
2. P2 — src/views/ControlView.vue:86-93. runCommand descarta la instantánea HTTP retornada por animation y screen/on/off. Si el POST funciona mientras el hub está desconectado, o su publicación no llega, el panel conserva estado viejo y el siguiente comando usa esa configuración. Tampoco detecta el epoch diferente de una respuesta HTTP para forzar resincronización como exige el contrato. Aplicar respuestas con generación capturada y validación de epoch/versión; probar respuesta tardía de una generación anterior.
3. P2 — src/composables/useAuth.ts:51-63, src/views/ControlView.vue:49 y src/composables/useDisplayConnection.ts:54. Logout cambia status a anonymous pero no llama disconnect ni reset del store; la vista sigue montada y el watcher sólo actúa al autenticar. Si logout falla por red, la sesión remota y el socket pueden seguir activos mientras la UI muestra login; se siguen procesando eventos y se conserva estado de la sesión anterior. Detener conexión/reintentos e invalidar callbacks pendientes al cerrar sesión, limpiar estado/token local y comunicar el fallo real de logout. Probar logout con error y eventos/GetSnapshot pendientes después de stop.

Evidencia nueva: npm ci falló en sandbox por EPERM; repetido fuera del sandbox terminó con éxito (221 paquetes instalados; audit reportó 8 vulnerabilidades: 3 moderate, 3 high, 2 critical; sin aplicar cambios de versiones). npm run build terminó 0 con type-check y Vite exitosos, sólo advertencias de anotaciones PURE de SignalR. npm test terminó 0: 5 archivos, 26 pruebas aprobadas. La reproducción de epoch usó la función existente sin modificar código; las pruebas actuales pasan porque aceptan el comportamiento incorrecto o no cubren estos recorridos. Los hallazgos 2 y 3 se verificaron por lectura del flujo, no mediante navegador.

Limitaciones: no se validó Canvas visual, navegador integrado, Android ni panel→servidor→display; continúan pendientes de T005 y de correcciones de T004. Sin commit. Sólo se editó esta tarea; npm ci regeneró dependencias locales y build regeneró dist. No se tocaron cambios ajenos de T003.

Para continuar: reservar T004 mediante task-selection.md y corregir estos hallazgos dentro de src/ambient-client/**, con pruebas de regresión; entregar nuevamente en review. T003 sigue review y puede revisarse independientemente del frontend. T005 continúa blocked hasta T003 y T004 done. Esta revisión sustituye la nota histórica de revisión pendiente y no aprueba los criterios marcados por el autor.


## Entrega — corrección de hallazgos (vuelta a review)

**Autor:** Kiro/kiro-7f3a2c9e-task-selection — 2026-10-25T20:25:40-03:00.
Continúa la autoría previa de la implementación de T004. Corrige los tres
hallazgos de la revisión de Codex/01a17555-7620-77e3-9dd4-24056763a55e. Cambios
sólo en `src/ambient-client/**` (único alcance reservado).

### Hallazgo P1 — retroceso de epoch / orden de versiones (corregido)
- `src/state/applySnapshot.ts`: `decideAccept` ya NO acepta un epoch distinto
  dentro de la misma generación. Ahora devuelve una decisión nueva
  `{ kind: 'resync' }` (epoch-mismatch): el contrato exige resincronizar con una
  conexión nueva en vez de alternar estados sobre el mismo transporte. Se agregó
  además un piso persistente `lastAppliedEpoch`/`lastAppliedVersion` que, en la
  primera captura de una generación nueva con el MISMO epoch, descarta versiones
  menores (regresión) o iguales (duplicado), evitando que una captura demorada
  retroceda el contenido tras reconectar. Un epoch distinto en una generación
  nueva (reinicio real del servidor) sí se adopta sin piso.
- `src/state/displayStore.ts`: `applySnapshot` devuelve ahora
  `ApplyOutcome = 'applied' | 'ignored' | 'resync'`. El piso persistente
  sobrevive a `beginGeneration()` (que sólo reinicia el estado por-generación) y
  se limpia en `reset()`.
- `src/api/hub.ts`: nuevos `getGeneration()` y `resync()` (cierra la conexión
  vigente y abre una nueva con generación mayor).
- `src/composables/useDisplayConnection.ts`: ante `outcome === 'resync'` llama
  `client.resync()`.

### Hallazgo P2 — instantánea de comando HTTP descartada (corregido)
- `src/views/ControlView.vue`: `runCommand` ahora captura la generación ANTES de
  enviar el POST y aplica la instantánea devuelta mediante
  `applyCommandResponse(result, generation)`. Si la respuesta corresponde a una
  generación anterior se descarta (no sobrescribe estado nuevo); si trae un epoch
  distinto del vigente, fuerza resync. Las acciones de comando ahora tipan su
  retorno como `Promise<Snapshot>`.
- `src/composables/useDisplayConnection.ts`: nuevos `applyCommandResponse` y
  `currentGeneration`.

### Hallazgo P3 — logout no detenía conexión ni limpiaba estado (corregido)
- `src/composables/useDisplayConnection.ts`: `disconnect()` ahora detiene la
  conexión (`stop()`), avanza la generación para invalidar callbacks pendientes
  (GetSnapshot/StateChanged en vuelo) y llama `reset()` del store.
- `src/composables/useAuth.ts`: `logout()` devuelve boolean; ante fallo de red
  informa el error real ("no se pudo confirmar el cierre … puede seguir activa
  remotamente") y en todos los casos descarta el token CSRF local
  (`clearCsrfToken`) y pasa a anónimo.
- `src/views/ControlView.vue`: el botón Salir llama un `logout` que primero
  `disconnect()` y luego el logout remoto; el watcher de `unauthenticated` (401)
  también desconecta y limpia. `authError` se muestra en el panel.
- `src/views/DisplayView.vue`: el watcher de `unauthenticated` desconecta y
  limpia además de volver a login.

### Pruebas de regresión agregadas/actualizadas
- `src/state/applySnapshot.spec.ts` (8): resync ante epoch distinto en la misma
  generación; no-retroceso en la primera captura de una generación nueva con
  mismo epoch; adopción de epoch nuevo real.
- `src/state/displayStore.spec.ts` (8): el escenario reportado A/10 → B/0 → A/9
  ya termina en A/10 (B pide resync, A/9 se ignora); orden preservado al
  reconectar; `reset` limpia el piso.
- `src/composables/useDisplayConnection.spec.ts` (5, nuevo): aplica respuesta de
  comando con generación vigente; descarta respuesta de generación anterior;
  fuerza resync ante epoch distinto; `disconnect` detiene e invalida estado.
- `src/composables/useAuth.spec.ts` (2, nuevo): logout exitoso limpia token y
  pasa a anónimo; logout con fallo de red comunica el error pero limpia local.
- `src/api/hub.spec.ts` (4): nuevo caso de `resync` (conexión nueva + generación
  mayor).

### Comandos ejecutados y resultados reales (desde `src/ambient-client/`)
- `npm run build` (`vue-tsc --noEmit -p tsconfig.app.json && vite build`) →
  type-check estricto sin errores; bundle generado. Sólo advertencias PURE de
  SignalR.
- `npm test` (`vitest run`) → **7 archivos, 39 pruebas, todas pasan** (antes 5
  archivos/26). Sin advertencias de Vue.

### Limitaciones (sin cambios respecto de la revisión)
- Integración real panel→servidor→display, evidencia visual del Canvas,
  navegador integrado y Android siguen pendientes de T005. Las correcciones P2/P3
  y la lógica P1 se verifican por pruebas unitarias con SignalR/cliente mockeados
  y lógica pura; no por recorrido de navegador.
- Puerto del proxy sigue como parámetro (`VITE_PROXY_TARGET`).

### Commit
Sin commit. Cambios sólo en working tree bajo `src/ambient-client/`. `git status`
muestra trabajo ajeno de T003 (server/solución/tests) no tocado por esta tarea.

### Revisión
Pendiente de otro agente o del usuario. Revisor activo: ninguno. Los tres
hallazgos previos están corregidos con regresión; esta entrega sustituye la
sección de limitaciones de la entrega original en lo relativo a P1/P2/P3.


## Segunda revisión independiente — corrección pendiente

Revisor: Codex/01a17555-7620-77e3-9dd4-24056763a55e. Fecha: 2026-10-25T20:34:15.2544096-03:00. Resultado: requiere corrección; ready sin responsable activo. Se conserva autoría Kiro en las entregas anteriores.

Verificado: se incorporaron resync ante epoch inesperado, piso de versiones entre generaciones, aplicación de respuestas HTTP y desconexión/limpieza al salir. Build ejecutado de nuevo: npm run build, éxito con type-check estricto y Vite; advertencias PURE de SignalR. npm test: 7 archivos, 39 pruebas aprobadas. No se repitió npm ci: instalación ya reproducida en la revisión anterior y no hay cambios declarados en dependencias.

Hallazgo P2 pendiente — src/ambient-client/src/api/hub.ts, catch de invokeSnapshot: las respuestas exitosas comprueban generation, pero el catch llama handleUnauthenticated sin comprobar generación, stopped ni identidad de conexión. Una invocación vieja puede invalidar la sesión nueva después de logout/reemparejamiento o resync. Esto incumple el descarte de callbacks de generaciones anteriores y deja incompleta la corrección de ciclo de vida.

Reproducción ejecutada sin editar fuentes: se transpila en memoria la clase HubClient real con TypeScript, sustituyendo sólo imports por un transporte falso controlable. Primera conexión: GetSnapshot pendiente. stop(), luego start(): segunda conexión activa con generación 2 y dos eventos connected. Se rechaza el GetSnapshot de la primera con Error('unauthenticated'): se emite onUnauthenticated en generación 2. Las vistas reaccionan a ese callback volviendo a login y desconectando la conexión nueva. Prueba actual de disconnect usa HubClient completamente mockeado y no cubre este rechazo tardío.

Corrección requerida: ignorar errores de invocaciones detenidas o de conexiones/generaciones anteriores antes de procesar autenticación; agregar regresión con GetSnapshot diferido que rechaza después de stop/start y de resync. Revisar también invalidación inmediata de callbacks al detener/reemplazar conexión. No se modificó producto ni se implementó la corrección en esta revisión.

Limitaciones: sin recorrido de navegador ni comprobación visual/Android; integración continúa en T005. Sin commit. Único archivo editado por la revisión: esta tarea; build regeneró dist local. T003 está done. T005 sigue blocked por T004; se puede reservar la corrección de T004, sin otras tareas independientes pendientes en el índice actual.


## Entrega — corrección del hallazgo de la 2ª revisión (vuelta a review)

**Autor:** Kiro/kiro-7f3a2c9e-task-selection — 2026-10-25T20:38:30-03:00.
Continúa la autoría previa. Corrige el hallazgo P2 pendiente de la segunda
revisión (Codex/01a17555-7620-77e3-9dd4-24056763a55e, 2026-10-25T20:34:15).
Cambios sólo en `src/ambient-client/**`.

### Hallazgo — rechazo tardío de GetSnapshot invalidaba la sesión nueva (corregido)
Causa: en `src/api/hub.ts`, el `catch` de `invokeSnapshot` llamaba
`handleUnauthenticated()` sin comprobar generación, `stopped` ni identidad de
conexión. Un `GetSnapshot` demorado de una conexión anterior que rechazaba con
`unauthenticated` tras stop/start o resync emitía `onUnauthenticated` en la
generación nueva, enviando al usuario a login y desconectando la conexión
vigente.

Corrección:
- Nuevo helper `isCurrentInvocation(connection, generation)`: una invocación
  sólo es vigente si `!stopped`, su generación es la actual y `this.connection`
  sigue siendo esa conexión.
- El `catch` de `invokeSnapshot` descarta primero con ese helper antes de
  procesar autenticación. La rama de éxito también usa el helper (además de la
  comprobación de generación que ya tenía).
- Por consistencia de ciclo de vida, se aplicó el mismo guard a:
  - el handler `StateChanged` (antes sólo comparaba generación),
  - el guard posterior a `connection.start()` y su `catch` de fallo de start.
  Así ningún callback de una conexión superada toca la sesión vigente.

### Pruebas de regresión agregadas (`src/api/hub.spec.ts`, ahora 7 casos)
- `FakeConnection` admite un `GetSnapshot` diferido (`deferSnapshot`) con
  `resolveSnapshot`/`rejectSnapshot` para controlar el rechazo tardío.
- Caso 1: primera conexión con GetSnapshot pendiente → stop()+start() →
  segunda conexión (generación 2) → se rechaza la invocación vieja con
  `unauthenticated`: NO se emite `onUnauthenticated`.
- Caso 2: mismo escenario pero tras `resync()`: el rechazo tardío se ignora.
- Contraprueba: un `unauthenticated` en la conexión VIGENTE sí emite
  `onUnauthenticated` (evita que la corrección oculte el caso legítimo).

Verificación de que las pruebas cazan el bug: se revirtió temporalmente sólo el
guard del `catch` y los dos casos de "rechazo tardío" fallaron (2 failed), con la
contraprueba en verde; restaurado el guard, 7/7 en verde.

### Comandos ejecutados y resultados reales (desde `src/ambient-client/`)
- `npm run build` (`vue-tsc --noEmit -p tsconfig.app.json && vite build`) →
  type-check estricto sin errores; bundle generado. Sólo advertencias PURE de
  SignalR.
- `npm test` (`vitest run`) → **7 archivos, 42 pruebas, todas pasan** (antes 39).
- No se repitió `npm ci`: sin cambios en dependencias/lockfile.

### Limitaciones (sin cambios)
- Integración real panel→servidor→display, evidencia visual del Canvas,
  navegador y Android siguen en T005. La corrección se verifica por prueba
  unitaria con transporte SignalR falso; no por recorrido de navegador.

### Commit
Sin commit. Cambios sólo en working tree bajo `src/ambient-client/`. T003 figura
done; `git status` muestra sus archivos, no tocados por esta tarea.

### Revisión
Pendiente de otro agente o del usuario. Revisor activo: ninguno. El hallazgo de
la 2ª revisión queda corregido con regresión. Si se aprueba, T005 queda
desbloqueada (T003 ya done, T004 pasaría a done).


## Tercera revisión independiente — aprobada

Revisor: Codex/01a17555-7620-77e3-9dd4-24056763a55e. Fecha: 2026-10-25T20:39:40.9910537-03:00. Resultado: aprobado, sin nuevos hallazgos bloqueantes en el alcance revisado. Se conserva autoría Kiro y el historial anterior; esta sección sustituye la revisión pendiente de la última entrega.

Revisado el guard isCurrentInvocation en StateChanged, finalización/error de start y éxito/error de GetSnapshot: comprueba stopped, generación e identidad de conexión, por lo que el rechazo tardío reportado ya no invalida una conexión nueva. Leídas las regresiones con invocación diferida tras stop/start y resync y la contraprueba de rechazo legítimo en conexión vigente. Se mantienen las correcciones anteriores de orden, respuesta de comandos y cierre local.

Verificación fresca: npm run build terminó 0 (TypeScript estricto y Vite; sólo advertencias PURE de SignalR). npm test terminó 0: 7 archivos y 42 pruebas aprobadas, incluidas las 7 del hub. No se repitió npm ci, ya reproducido previamente; la última corrección no modifica dependencias. No se afirma haber repetido el ciclo RED/GREEN informado por el autor.

Limitaciones: cobertura de estas carreras mediante transporte falso y lógica real del cliente; no acredita conexión con servidor, calidad visual del Canvas, recorrido de dos ventanas ni Android. Esas verificaciones funcionales siguen expresamente en T005. Las limitaciones no bloquean la aceptación de esta entrega del cliente.

Archivos editados por esta revisión: tasks/T004-client-foundation.md y transición de tasks/T005-first-demo.md; build regeneró dist local. Sin cambios de producto ni commit. T003 ya está done: T005 pasa a ready, sin responsable, y puede reservarse para integración. No se inicia otra tarea ni hay otra tarea independiente pendiente que pueda paralelizarse en el índice actual.
