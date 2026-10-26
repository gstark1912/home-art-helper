# T008 — Validación de extremo a extremo en Android Emulator

- Estado: ready
- Responsable: sin asignar
- Revisor activo: ninguno
- Actualizado: 2026-10-25T20:52:00-03:00
- Dependencias: T005 done
- Bloqueo: requiere que el usuario tenga el AVD de tablet operativo (ya reportado en T002)

## Objetivo

Confirmar en Android Emulator el recorrido real: abrir `/display` desde Chrome
del emulador por `http://10.0.2.2:<PUERTO>/display`, autenticar y ver que los
comandos del panel (en la PC) modifican el display del emulador.

## Alcance y archivos reservados

`docs/runbooks/android-emulator.md` (sección de verificación real) y
`docs/runbooks/local-development.md` (sección Android). No requiere cambios de
código si el recorrido funciona; si aparece un defecto, crear/transferir una
tarea acotada al responsable del subárbol afectado (`src/Ambient.Server/**` o
`src/ambient-client/**`) antes de editar código.

## Fuera de alcance

Rendimiento, consumo, temperatura y permanencia encendida de hardware físico;
modo kiosco/WebView nativo; HTTPS/LAN. El emulador valida el recorrido funcional,
no acredita una tablet física.

## Entradas y contratos

Servidor de la Opción A del runbook de desarrollo local, con `AllowedHosts`
incluyendo `10.0.2.2`. Runbook de Android para arranque del AVD y acceso al host.

## Criterios de aceptación

- [ ] Documentar el puerto concreto usado y la URL del emulador.
- [ ] Evidencia (confirmada con el usuario) de que el display del emulador
      responde a cambios de animación y a apagado/encendido desde el panel.
- [ ] Registrar límites del emulador y marcar explícitamente qué quedó sin
      probar (p. ej. fullscreen/kiosco, LAN/HTTPS).
- [ ] No dejar la clave de emparejamiento en capturas ni archivos versionados.

## Verificación

Recorrido manual guiado con el usuario. No declarar la validación Android
realizada sin su confirmación. Separar lo documentado de lo ejecutado.

## Entrega

- Resumen: pendiente.
- Archivos modificados: pendiente.
- Pruebas y resultados: pendiente.
- Decisiones y limitaciones: pendiente.
- Commit: sin commit.
- Revisión (responsable y resultado): pendiente.
- Siguiente paso: pendiente.
