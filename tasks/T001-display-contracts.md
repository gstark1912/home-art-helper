# T001 — Contratos del display

- Estado: done
- Responsable: Codex/01a17539-39f1-78f2-b06a-a506af9666d9
- Revisor activo: ninguno
- Actualizado: 2026-10-25T19:45:25.0937104-03:00
- Dependencias: diseño aprobado
- Bloqueo: ninguno

## Objetivo

Permitir que dos LLMs implementen servidor y frontend independientemente sin inventar interfaces incompatibles.

## Alcance y archivos reservados

Crear `docs/contracts/display-protocol.md`. No editar código, README ni tareas de otros responsables. Al entregar, avisar qué dependencias libera para que T003 y T004 puedan actualizarse coordinadamente.

## Entradas y contratos

Diseño aprobado y `.kiro/steering/`. El contrato cubre el modelo extensible completo; la primera implementación sólo necesita arte, autenticación, conexión y encendido lógico.

## Criterios de aceptación

- [x] Definir JSON exacto, casing, tipos, valores iniciales, enumeraciones y límites de entradas.
- [x] Definir rutas y respuestas de login, logout, sesión, CSRF, status y comandos. Incluir fallos 400/401/403/409 según corresponda.
- [x] Definir ruta del hub, nombres de eventos/métodos, instantánea, versión y sincronización inicial/reconexión sin carreras.
- [x] Definir estados futuros de música y mensajes, sin exigir su implementación en la primera demo.
- [x] Definir cookies y configuración para localhost y emulador HTTP de desarrollo; HTTPS para uso LAN. No exigir compartir cookies entre hostnames distintos.
- [x] Incluir ejemplos de un cambio de animación y apagado/encendido, sin secretos reales.
- [x] Otro agente o el usuario revisó que T003 y T004 se pueden construir con este documento.

## Verificación

Revisión cruzada de cada campo/evento consumido por servidor y frontend. Todos los endpoints del diseño deben estar documentados y etiquetados como primera demo o hito posterior.

## Entrega

Documento preparado en `docs/contracts/display-protocol.md`: instantánea completa, enums y límites, endpoints y errores, cookies/CSRF/origen, hub, orden de publicación, reconexión, reinicio mediante epoch y modelos futuros. Sólo se modificó ese documento y esta tarea.

Verificación propia: cuatro bloques JSON parseados con ConvertFrom-Json sin error; comprobada presencia de las once rutas HTTP y ruta/evento/método SignalR (14 elementos); revisión manual de cobertura contra diseño y criterios. `git diff --check` terminó con código 0, pero los archivos siguen sin seguimiento y ese comando no valida su contenido. No se ejecutaron builds ni pruebas de runtime: entrega documental, aún sin implementaciones.

Decisiones nuevas propuestas: epoch UUID por arranque, versión entera segura, reemplazo completo de animation, expiración de sesión a 12 horas, cookie por origen, header X-CSRF-Token, respuestas 501 para hitos posteriores y nombres/valores exactos del contrato. No se modificaron reglas ni diseño aprobado.

Revisión independiente: pendiente; Revisor activo: ninguno. El último criterio permanece abierto deliberadamente. Sin commit. T003 y T004 continúan bloqueadas hasta que otro agente o el usuario apruebe T001 y pase a done; entonces pueden implementarse en paralelo, backend y frontend respectivamente. T002 ya puede tomarse en paralelo y no comparte archivos. Próximo paso: revisar viabilidad conjunta T003/T004, en especial cookies/CSRF de transportes SignalR y sincronización tras reinicio.



## Revisión independiente aprobada

Revisor: Codex/01a1753c-859c-7da1-bfd1-602ff76d9cee. Fecha: 2026-10-25T19:45:25.0937104-03:00. Resultado: aprobado, sin hallazgos bloqueantes. Se revisaron todos los criterios contra el diseño y los alcances de T003/T004: modelo y límites compartidos, autenticación por cookie, renovación de CSRF tras login, protección de negociación/POST de transportes y Origin en WebSocket, serialización de estado, generaciones/epoch y fases futuras. Las restricciones de headers del navegador para WebSocket/SSE no impiden el contrato: el header CSRF se exige en POST, mientras el establecimiento GET usa cookie y validación de Origin cuando corresponde.

Referencias contrastadas: https://learn.microsoft.com/en-us/aspnet/core/signalr/configuration?view=aspnetcore-10.0 y https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0 . El contrato permite implementar ambos lados; la integración real y revocación/expiración de conexiones aún requieren las pruebas de T003/T004/T005.

Verificación ejecutada: ConvertFrom-Json validó 4 bloques JSON; comprobación de presencia de 11 rutas HTTP y 3 elementos SignalR: 14/14; git diff --check devolvió 0 (no cubre archivos sin seguimiento). No se ejecutaron builds ni runtime porque aún no hay implementación. No se modificó el contrato ni archivos de producto. Sin commit. Esta aprobación sustituye la revisión pendiente consignada en la entrega original; las notas de pendiente del documento describen su entrega anterior.

T003 y T004 pasan a ready porque su único bloqueo era T001. Pueden reservarse en paralelo: T003 servidor/solución/pruebas .NET; T004 src/ambient-client/** y sus manifiestos/lockfile. T002 conserva su responsable activo; T005 sigue esperando T003 y T004 done.
