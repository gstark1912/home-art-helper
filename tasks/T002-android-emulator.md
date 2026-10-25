# T002 — Preparación de Android Emulator

- Estado: done
- Responsable: Kiro/426309dd-592c-436e-9c89-8a5b64b4ec1b
- Revisor activo: ninguno
- Actualizado: 2026-10-25T19:57:42.2687771-03:00
- Dependencias: ninguna para instalación; T005 para validar conexión final
- Bloqueo: ninguno

## Objetivo

Guiar al usuario para tener una tablet virtual lista sin comprar hardware ni crear una aplicación Android.

## Alcance y archivos reservados

Crear únicamente `docs/runbooks/android-emulator.md`. Se puede trabajar en paralelo con T001. No cambiar configuración de Windows, instalar software o crear dispositivos automáticamente sin instrucción explícita. El usuario está realizando la instalación.

## Entradas

Android Studio oficial y documentación de Android Developers actual. Servidor previsto en la PC; `10.0.2.2` es la dirección del host desde el emulador.

## Criterios de aceptación

- [x] Instrucciones Windows: instalador, SDK, Emulator y Device Manager.
- [x] Perfil tablet, imagen con navegador disponible, orientación y arranque.
- [x] Explicar acceso al servidor del host y diferencias con localhost; dejar puerto como parámetro hasta T005.
- [x] Diagnóstico breve para aceleración/virtualización y problemas de conexión, sin modificar ajustes automáticamente.
- [x] Separar pasos documentados de pasos ejecutados realmente en esta PC.
- [x] Referencias oficiales y advertencia concreta sobre límites del emulador frente a hardware físico.

## Verificación

Revisión de enlaces y coherencia de pasos. Instalación/arranque real puede quedar pendiente de confirmación del usuario; no declarar validada la demo Android en esta tarea.

## Entrega

**Autor:** Kiro/426309dd-592c-436e-9c89-8a5b64b4ec1b — 2026-10-25T19:44:46-03:00

### Resumen
Guía reproducible del emulador en `docs/runbooks/android-emulator.md`: instalación de
Android Studio + SDK, creación de un AVD de tablet, arranque y apertura de `/display` en
Chrome, acceso al host por `10.0.2.2`, diagnóstico de aceleración/virtualización y
conexión, y límites del emulador frente a hardware físico. No se crea ninguna app Android.

### Archivos
- Creado: `docs/runbooks/android-emulator.md` (único archivo reservado por la tarea).

### Verificado
- Coherencia de pasos contra la instalación real en curso del usuario (Android Studio
  canal estable; *SDK Components Setup* con Android SDK, Platform API 37.0 "CinnamonBun"
  y Android Virtual Device; ruta `C:\Users\Germa\AppData\Local\Android\Sdk`).
- `adb`, `emulator`, `sdkmanager`, `avdmanager` **no** están en el PATH de esta PC
  (comando `Get-Command`), coherente con lo documentado (viven dentro del SDK).
- Enlaces a dominios oficiales (`developer.android.com`) y a `learn.microsoft.com` para
  el detalle de `10.0.2.2` y aceleración WHPX/AEHD.

### Verificado con el usuario (arranque real, 2026-10-25)
- Instalación de Android Studio + SDK completada.
- AVD creado: **Pixel Tablet**, imagen **Google Play Tablet Intel x86_64**, **API 35
  "VanillaIceCream" (Android 15)**, orientación apaisada, 2560×1600.
- Arranque del emulador correcto, **sin avisos de virtualización** (aceleración por
  hardware operativa).
- Chrome dentro del emulador navega a una web externa sin problemas.

### Pendiente (no bloquea el review)
- Conexión real al servidor y validación de la demo en Android: **se ejecuta en T005**;
  esta tarea no la declara validada. El puerto queda como parámetro `<PUERTO>` y se
  prueba con `http://10.0.2.2:<PUERTO>/display`.

### Decisiones
- Preferir imagen con Google APIs/Play para asegurar navegador; orientación landscape.
- No modificar PATH ni características de Windows automáticamente; el usuario ejecuta esos
  cambios de forma consciente.

### Commit
Sin commit. Cambios sólo en working tree (archivo nuevo sin versionar).

### Revisión
Pendiente de otro agente o del usuario. Revisor activo: ninguno.

### Para continuar
- Revisar criterios de aceptación contra `docs/runbooks/android-emulator.md`.
- Cuando el usuario termine de crear y arrancar el AVD, se puede confirmar la sección de
  arranque; la conexión se cierra en T005.


## Revisión independiente aprobada

Revisor: Codex/01a1753c-859c-7da1-bfd1-602ff76d9cee. Fecha: 2026-10-25T19:57:42.2687771-03:00. Resultado: aprobado con observaciones menores, sin bloqueos. Los seis criterios documentales están cubiertos: Windows/SDK/Device Manager, tablet e imagen con navegador, orientación y arranque, host y puerto parametrizado, diagnóstico, evidencia separada y referencias/límites. La instalación y el arranque se aceptan como evidencia reportada por el usuario en la entrega de Kiro; este revisor no los ejecutó de nuevo. No se afirma integración Android con el servidor.

Verificación: lectura completa del runbook y contraste con diseño y tarea; ocho elementos documentales comprobados por script (8/8); ocho URLs oficiales abiertas y resueltas mediante navegador web. Android Developers confirma creación de AVD, Landscape y preferencia por WHPX. git diff --check terminó con 0, con la limitación de que no valida contenido sin seguimiento. No se ejecutaron builds, instalaciones ni comandos que cambien Windows o AVDs.

Observaciones no bloqueantes para una actualización futura del runbook: (1) la etiqueta Google APIs garantiza servicios de Google, no por sí sola la presencia de Chrome; recomendar la imagen Google Play ya verificada y comprobar el navegador al arrancar; (2) AEHD sigue disponible en la fecha de revisión, pero Android anuncia su retiro el 2026-12-31; conservar WHPX como opción principal y no presentar AEHD como alternativa duradera. Fuentes: https://developer.android.com/studio/run/managing-avds y https://developer.android.com/studio/run/emulator-acceleration . Ninguna afecta al AVD Google Play con Chrome ya reportado operativo.

Archivos modificados por esta revisión: únicamente tasks/T002-android-emulator.md. Sin commit. Esta sección sustituye las notas históricas de revisión/arranque pendientes en la entrega original. T002 queda done; la conexión real al servidor continúa pendiente de T005. T003 y T004 siguen ready y pueden reservarse en paralelo, con alcances independientes de servidor y frontend; no se inicia otra tarea en este turno.
