# T007 — Música simulada y disco giratorio

- Estado: ready
- Responsable: sin asignar
- Revisor activo: ninguno
- Actualizado: 2026-10-25T20:52:00-03:00
- Dependencias: T005 done
- Bloqueo: ninguno

## Objetivo

Mostrar en el display un estado de "reproducción" simulada (título, artista,
carátula local y un disco que gira) controlado desde `/control`, sin integrar
Spotify ni audio real. Hoy `POST /api/display/music` responde 501.

## Alcance y archivos reservados

- Backend: `src/Ambient.Server/**` y `tests/Ambient.Server.Tests/**`.
- Frontend: `src/ambient-client/**` (incluye assets locales de carátula).

Coordinar en esta tarea la transferencia de alcance si backend y frontend los
toman agentes distintos. El contrato de música ya está definido; proponer cambios
al responsable de T001 si hicieran falta, no editarlo como efecto secundario.

## Fuera de alcance

Integración real con Spotify, análisis de audio, permisos de micrófono, audio
reproducido. Las animaciones **no** dependen de la música (regla de proyecto).

## Entradas y contratos

`docs/contracts/display-protocol.md` (sección de música/estados futuros).
Validación ya presente en `Commands.Music`: `trackId` `[A-Za-z0-9_-]`,
`title`/`artist` ≤ 120, `artworkId` ∈ {cover-01, cover-02}, `isPlaying` booleano.
Las carátulas son recursos **locales** (sin red).

## Criterios de aceptación

- [ ] El servidor acepta un estado de música válido, lo publica con versión
      creciente y lo expone en la instantánea; validación estricta con 400 en
      errores.
- [ ] El display muestra título/artista/carátula local y un disco que gira
      cuando `isPlaying` es verdadero; se detiene al pausar.
- [ ] El disco se pausa con el apagado lógico y al desmontar; sin fugas de
      timers/animación.
- [ ] Sin dependencia de red para las carátulas ni acoplamiento con la animación.
- [ ] Pruebas de servidor (validación, versión) y de cliente (estado reproduce/pausa).

## Verificación

Builds y pruebas de ambos proyectos. Recorrido real: fijar estado de música
desde el panel y ver el disco girar/pausar en el display. Registrar evidencia.

## Entrega

- Resumen: pendiente.
- Archivos modificados: pendiente.
- Pruebas y resultados: pendiente.
- Decisiones y limitaciones: pendiente.
- Commit: sin commit.
- Revisión (responsable y resultado): pendiente.
- Siguiente paso: pendiente.
