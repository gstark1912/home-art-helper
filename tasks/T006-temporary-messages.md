# T006 — Mensajes temporales en el display

- Estado: ready
- Responsable: sin asignar
- Revisor activo: ninguno
- Actualizado: 2026-10-25T20:52:00-03:00
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

- [ ] El servidor acepta un mensaje válido, lo incorpora a la instantánea con
      versión creciente y lo publica a los displays; expira por tiempo sin
      intervención del panel.
- [ ] Validación estricta en servidor (longitud, prioridad, duración, sin HTML);
      rechazos 400 coherentes con el contrato. No renderizar el texto como HTML.
- [ ] Prioridad respetada cuando coinciden mensajes.
- [ ] El display muestra y oculta el mensaje sin romper la animación ni el
      apagado lógico; libera timers al desmontar.
- [ ] Pruebas de servidor (validación, expiración, versión) y de cliente
      (render/ocultamiento, no-HTML).

## Verificación

`dotnet build/test HomeArtHelper.slnx`; `npm run build`/`npm test` en
`src/ambient-client`. Recorrido real con dos ventanas: enviar mensaje y verlo
aparecer/expirar en el display. Registrar comandos y resultados.

## Entrega

- Resumen: pendiente.
- Archivos modificados: pendiente.
- Pruebas y resultados: pendiente.
- Decisiones y limitaciones: pendiente.
- Commit: sin commit.
- Revisión (responsable y resultado): pendiente.
- Siguiente paso: pendiente.
