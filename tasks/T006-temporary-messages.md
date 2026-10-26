# T006 — Mensajes temporales en el display

- Estado: done
- Responsable: wf-coder/9013d277-8406-4fd9-9639-a2086571ccd1
- Revisor activo: ninguno
- Actualizado: 2026-10-26T21:36:00-03:00
- Dependencias: T005 done
- Bloqueo: ninguno

## Objetivo

Enviar un mensaje de texto desde `/control` que aparezca temporalmente sobre el
display y expire solo, con prioridad, según el modelo ya definido en el
contrato (hoy responde 501).

## Alcance y archivos reservados

- Backend: `src/Ambient.Server/**` y `tests/Ambient.Server.Tests/**` (dueño: quien tome T006).
- Frontend: `src/ambient-client/**`.

Si dos agentes toman backend y frontend por separado, coordinar la transferencia
de alcance de cada subárbol en esta tarea antes de editar. No modificar el
contrato sin acordarlo con el responsable de T001; proponer cambios allí.

## Fuera de alcance

Música, control físico de pantalla, almacenamiento persistente de mensajes.

## Entradas y contratos

`docs/contracts/display-protocol.md` (sección de mensajes/estados futuros). El
endpoint `POST /api/display/message` ya existe validando entrada y devolviendo
501; esta tarea lo implementa de verdad. Respetar nombres, límites (texto ≤ 500,
prioridad 0–2, duración 1–300 s) y validación de control de caracteres.

## Criterios de aceptación

- [x] El servidor acepta un mensaje válido, lo incorpora a la instantánea con
      versión creciente y lo publica a los displays; expira por tiempo sin
      intervención del panel.
- [x] Validación estricta en servidor (longitud, prioridad, duración, sin HTML);
      rechazos 400 coherentes con el contrato. No renderizar el texto como HTML.
- [x] Prioridad respetada cuando coinciden mensajes.
- [x] El display muestra y oculta el mensaje sin romper la animación ni el
      apagado lógico; libera timers al desmontar.
- [x] Pruebas de servidor (validación, expiración, versión) y de cliente
      (render/ocultamiento, no-HTML).

## Verificación

`dotnet build/test HomeArtHelper.slnx`; `npm run build`/`npm test` en
`src/ambient-client`. Recorrido real con dos ventanas: enviar mensaje y verlo
aparecer/expirar en el display. Registrar comandos y resultados.

## Entrega

- Resumen: se implementó el mensaje temporal de extremo a extremo según el
  contrato. `POST /api/display/message` ahora valida y aplica el mensaje en vez
  de responder 501: asigna `id` (UUID) y fechas `createdAtUtc`/`expiresAtUtc` en
  el servidor, lo incorpora a la instantánea con versión creciente, lo publica a
  los displays y lo expira con un temporizador propio del servidor (sin
  intervención del panel y aunque no haya clientes). La política de prioridad se
  respeta: igual reemplaza, mayor interrumpe/descarta, menor devuelve 409
  `message_priority_conflict` sin mutar. Antes de evaluar un comando se expira
  cualquier mensaje ya vencido como mutación separada. El panel `/control` suma
  un formulario (texto, prioridad 0–2, duración 1–300 s) y maneja el 409; el
  display muestra el mensaje sobre la animación con precedencia sobre el modo
  base pero no sobre el apagado lógico, lo oculta localmente al vencer sin mutar
  la versión del servidor y libera el timer al desmontar. El texto se renderiza
  como texto plano (interpolación, nunca HTML).

- Archivos modificados:
  - `src/Ambient.Server/DisplayState.cs`: records `Message`/`MessageCommand`,
    `Snapshot.Message` tipado; inyección de `TimeProvider`; `PostMessage` con
    política de prioridad, expiración previa y temporizador de vencimiento que
    comprueba el id vigente; publicación serializada por la misma cola.
  - `src/Ambient.Server/Commands.cs`: `Message(...)` ahora devuelve
    `MessageCommand` validado (texto ≤500, controles salvo LF/TAB rechazados,
    prioridad 0–2, duración 1–300).
  - `src/Ambient.Server/Program.cs`: `POST /api/display/message` llama a
    `DisplayState.PostMessage` (se retiró el stub 501).
  - `src/ambient-client/src/protocol/types.ts`: límites y `MessageCommand`.
  - `src/ambient-client/src/api/client.ts`: `sendMessage(...)`.
  - `src/ambient-client/src/state/messageExpiry.ts` (nuevo): estimación de
    vencimiento con reloj del servidor + reloj monótono local.
  - `src/ambient-client/src/components/MessageOverlay.vue` (nuevo): overlay de
    texto plano, expiración local y liberación del timer al desmontar.
  - `src/ambient-client/src/views/DisplayView.vue`: integra el overlay con la
    precedencia correcta (apagado > mensaje > base).
  - `src/ambient-client/src/views/ControlView.vue`: formulario de mensaje y
    manejo del conflicto de prioridad (409).
  - Pruebas: `tests/Ambient.Server.Tests/MessageTests.cs` (nuevo),
    `tests/Ambient.Server.Tests/BoundaryTests.cs` (casos de validación de
    mensaje; se quitó la aserción 501), `src/ambient-client/src/state/messageExpiry.spec.ts`
    (nuevo), `src/ambient-client/src/components/MessageOverlay.spec.ts` (nuevo).

- Pruebas y resultados (comprobado):
  - Backend build: `dotnet build HomeArtHelper.slnx -c Debug` → Build succeeded,
    0 warnings, 0 errors. (Nota: hubo que terminar un proceso `Ambient.Server`
    (PID 49268) que había quedado corriendo de una sesión previa y bloqueaba el
    apphost; no formaba parte de esta tarea.)
  - Backend tests: `dotnet test tests/Ambient.Server.Tests/...csproj -c Debug` →
    Passed! Failed: 0, Passed: 36, Skipped: 0, Total: 36. Incluye aceptación,
    forma de instantánea, versión creciente, LF/TAB permitidos y otros controles
    rechazados, política de prioridad (reemplazo/interrupción/409), expiración
    por temporizador del servidor (reloj inyectado) incrementando versión una
    vez, y que un reemplazo cancela el vencimiento anterior.
  - Frontend typecheck/build: `npm run build` (vue-tsc + vite build) → OK.
  - Frontend tests: `npm run test` (vitest run, modo único) → Test Files 9
    passed, Tests 51 passed. Incluye `messageExpiry` (estimación/margen/monótono)
    y `MessageOverlay` (texto plano sin HTML, ocultamiento local al vencer, no
    mostrar mensajes ya vencidos, liberación del timer al desmontar).

- Pendiente (no bloqueante): recorrido funcional real con dos ventanas
  (`/control` + `/display`) enviando un mensaje y viéndolo aparecer/expirar.
  Requiere servidor en ejecución y dos navegadores; no ejecutable en este paso
  headless. La lógica equivalente está cubierta por pruebas automáticas.

- Decisiones y limitaciones:
  - `DisplayState` ahora usa el `TimeProvider` inyectado (antes `DateTime.UtcNow`
    directo) para fechas y para el temporizador de expiración, de modo que las
    pruebas controlen el tiempo de forma determinista. Comportamiento en runtime
    equivalente con `TimeProvider.System`.
  - El overlay no reinicia el vencimiento ante una instantánea duplicada (mismo
    id); al reconectar, la instantánea del servidor reemplaza la estimación.
  - No se modificó el contrato ni el diseño; se respetan nombres, límites y
    códigos de error existentes (incluido 409 `message_priority_conflict`).

- Commit: sin commit aún (el revisor commitea el cierre aprobado en `main`).
- Revisión (responsable y resultado): aprobada por wf-code-reviewer/rev-t006-20261026.
- Siguiente paso: cierre aprobado — commit de la entrega y este registro en
  `main` y push a `origin/main`. Opcionalmente, ejecutar el recorrido manual de
  dos ventanas para validación funcional de runtime (pendiente no bloqueante).

## Revisión independiente aprobada

- Revisor: wf-code-reviewer/rev-t006-20261026 — 2026-10-26T21:36:00-03:00.
- Resultado: APROBADA. Sin bloqueadores.

Verificación real reejecutada por el revisor en este checkout (`main`):

- Backend build: `dotnet build HomeArtHelper.slnx -c Debug` → Build succeeded,
  0 Warning(s), 0 Error(s).
- Backend tests: `dotnet test tests/Ambient.Server.Tests/Ambient.Server.Tests.csproj -c Debug`
  → Passed! Failed: 0, Passed: 36, Skipped: 0, Total: 36.
- Frontend build (vue-tsc + vite): `npm run build` en `src/ambient-client` → OK.
- Frontend tests (vitest run único): `npm run test -- --run` en `src/ambient-client`
  → 9 archivos, 51 tests, todos pasan (incluye `messageExpiry` y `MessageOverlay`).

Comprobaciones de la revisión:

- Criterios de aceptación verificados contra el código: `DisplayState.PostMessage`
  aplica el mensaje en la cola serializada, expira primero lo vencido (mutación
  propia), asigna `id`/fechas en el servidor, incrementa versión una vez y publica;
  `ScheduleExpiry`/`ExpireNow` vencen por temporizador propio comprobando el `id`
  vigente para no borrar un reemplazo (cubierto por pruebas de expiración y de
  reemplazo). Política de prioridad igual-reemplaza / mayor-interrumpe /
  menor-409 `message_priority_conflict` sin mutar, confirmada en código y prueba.
- Validación estricta en servidor (`Commands.Message`): texto ≤500, rechazo de
  controles salvo LF/TAB, prioridad entera 0–2, duración entera 1–300; 400
  coherente con el contrato. El cliente no envía `id` ni fechas.
- Sin HTML: el overlay usa interpolación (`{{ message.text }}`), nunca `v-html`;
  la prueba verifica que un `<img onerror>` no crea elemento. El parser de
  instantánea valida la forma de `message` según el contrato.
- Display: precedencia apagado > mensaje > base (el overlay sólo monta con
  `screenOn && message`); el timer local se libera en `onBeforeUnmount`; no muta
  la versión del servidor al vencer localmente.
- Alcance: cambios sólo en `src/Ambient.Server/**`, `tests/Ambient.Server.Tests/**`,
  `src/ambient-client/**` y este archivo de tarea. Contrato y reglas sin cambios.
  Sin secretos en código, tareas ni logs. TypeScript estricto (vue-tsc en build).
- No se ejecutó el recorrido manual de dos ventanas ni Android (headless);
  cubierto por pruebas automáticas y declarado pendiente no bloqueante.
- Dependencias rehabilitadas: ninguna. Ninguna tarea depende de T006.
