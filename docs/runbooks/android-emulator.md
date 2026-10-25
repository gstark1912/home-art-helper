# Runbook: Android Emulator para el display

Esta guía prepara una **tablet virtual** en Windows para abrir `/display` de Home&Art
Helper en Chrome, sin comprar hardware y sin construir una aplicación Android. El
emulador sirve para validar el recorrido funcional; **no** acredita rendimiento,
consumo ni temperatura de una tablet física económica (ver [Límites](#limites-del-emulador)).

El servidor de Home&Art Helper corre en esta PC. Desde el emulador, la PC anfitriona
se alcanza por la dirección especial `10.0.2.2`, no por `localhost`
(ver [Red](#acceso-al-servidor-del-host)).

> **Alcance de este runbook.** Documenta la instalación y el arranque del emulador.
> La conexión real al servidor y la validación de la demo en Android se verifican en
> **T005**, no aquí. El puerto del servidor queda como parámetro `<PUERTO>` hasta esa
> tarea.

---

## Estado de verificación en esta PC

Separar lo documentado de lo ejecutado realmente en esta máquina (Windows, usuario `Germa`):

| Paso | Estado |
|---|---|
| Descarga e instalación de Android Studio (canal estable, "Rabbit") | Ejecutado por el usuario |
| Asistente *SDK Components Setup*: Android SDK, Platform API 37.0 ("CinnamonBun"), Android Virtual Device | Ejecutado por el usuario |
| Ruta del SDK: `C:\Users\Germa\AppData\Local\Android\Sdk` | Confirmada en el asistente |
| `adb` / `emulator` en PATH | No disponibles en PATH al momento de escribir (viven dentro del SDK) |
| Creación del AVD de tablet (Pixel Tablet, API 35 "VanillaIceCream", Google Play, x86_64, apaisado) | Ejecutado por el usuario |
| Arranque del AVD y apertura de Chrome | Verificado por el usuario: arranca sin avisos de virtualización y Chrome navega a una web externa |
| Conexión real al servidor (`10.0.2.2:<PUERTO>`) | **Pendiente — se valida en T005** |

Las herramientas de línea de comandos del SDK no se agregan al PATH del sistema por
defecto. Quedan en:

- `C:\Users\Germa\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- `C:\Users\Germa\AppData\Local\Android\Sdk\emulator\emulator.exe`
- `C:\Users\Germa\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\` (`sdkmanager`, `avdmanager`)

Agregarlas al PATH es opcional y lo decide el usuario; este runbook no modifica
variables de entorno automáticamente.

---

## 1. Instalación de Android Studio y el SDK

1. Descargar Android Studio del sitio oficial:
   [developer.android.com/studio](https://developer.android.com/studio). Elegir el
   instalador de Windows (`.exe`) del canal estable.
2. Ejecutar el instalador con las opciones por defecto.
3. En el primer arranque, el **Setup Wizard** abre la pantalla **SDK Components Setup**.
   Mantener seleccionados:
   - **Android SDK** (obligatorio).
   - **Android SDK Platform** (la API que ofrezca el asistente; en esta PC fue API 37.0,
     "CinnamonBun"). Una plataforma reciente es suficiente para abrir una web en Chrome.
   - **Android Virtual Device**: necesario para el emulador. **Dejarlo tildado.**
4. Confirmar la **Android SDK Location**. Por defecto es
   `C:\Users\<usuario>\AppData\Local\Android\Sdk`. Anotarla; se usa para ubicar
   `adb` y `emulator`.
5. **Next** → aceptar todas las licencias (seleccionar cada ítem y marcar *Accept*) →
   **Finish**. Esperar a que termine la descarga (en esta PC, ~2.68 GB).
6. Al finalizar aparece **Welcome to Android Studio**.

No hace falta crear ningún proyecto ni aplicación: sólo necesitamos un dispositivo
virtual que ejecute un navegador.

Referencias oficiales:
[Instalar Android Studio](https://developer.android.com/studio/install) ·
[Actualizar herramientas del SDK](https://developer.android.com/studio/intro/update).

---

## 2. Crear el dispositivo virtual de tablet (AVD)

El **Device Manager** reemplaza al antiguo "AVD Manager" de guías viejas.

1. En la ventana de bienvenida: **More Actions → Virtual Device Manager**.
   (Si hay un proyecto abierto: **View → Tool Windows → Device Manager**, luego `+`.)
2. Clic en **Create Virtual Device** (`+`).
3. En **Category**, elegir **Tablet** y un perfil de tablet (por ejemplo *Pixel Tablet*
   o *Nexus 10*). Un perfil de tablet da una pantalla grande apaisada, adecuada para un
   cuadro ambiental.
4. Elegir una **imagen del sistema**:
   - Preferir una imagen con **Google APIs / Google Play**, que incluye navegador. Las
     imágenes "AOSP" sin servicios de Google pueden no traer Chrome.
   - Si la imagen no está descargada, usar el ícono de descarga junto a su nombre y
     esperar.
   - Para mejor rendimiento, elegir una imagen acorde a la arquitectura del procesador
     (x86_64 en PC Intel/AMD de 64 bits).
5. En la pantalla de verificación de configuración:
   - Nombre descriptivo del AVD, por ejemplo `HomeArt-Tablet`.
   - **Startup orientation: Landscape** (apaisado), que es como se cuelga el cuadro.
6. **Finish**. El AVD queda listado en el Device Manager.

Referencia oficial:
[Crear y administrar dispositivos virtuales](https://developer.android.com/studio/run/managing-avds).

---

## 3. Arrancar el emulador y abrir el display

1. En **Device Manager**, pulsar **▶ (Run)** junto a `HomeArt-Tablet`. La primera vez
   el arranque tarda más (*cold boot*).
2. Dentro del emulador, abrir **Chrome** (o el navegador disponible).
3. Navegar al display del servidor usando la dirección del host (ver sección siguiente):

   ```
   http://10.0.2.2:<PUERTO>/display
   ```

   Reemplazar `<PUERTO>` por el puerto real del servidor. Ese valor se fija en T005;
   hasta entonces queda como parámetro.
4. Para pantalla completa, Chrome requiere un **gesto inicial** del usuario (tocar un
   botón de la página). No se promete fullscreen silencioso desde el navegador; el modo
   kiosco o WebView se resuelve en un hito posterior.

---

## Acceso al servidor del host

Cada instancia del emulador corre detrás de un router/firewall virtual que la aísla de
las interfaces de red de la PC. Por eso **`localhost` dentro del emulador apunta al
propio dispositivo virtual, no a la PC**.

- Para llegar a la PC anfitriona, usar la dirección reservada **`10.0.2.2`**, que el
  emulador enruta hacia la interfaz loopback (`127.0.0.1`) del host.
- `10.0.2.2` es estable entre versiones del emulador y está documentada por Android.
- Diferencia clave:
  - `http://localhost:<PUERTO>` → se usa en el **navegador de la PC**.
  - `http://10.0.2.2:<PUERTO>` → se usa en el **navegador del emulador**.

> **HTTP vs HTTPS.** Para desarrollo en loopback y emulador alcanza con HTTP. Para uso
> doméstico real en la LAN (abrir el display en una tablet física por la red) se
> documenta HTTPS y la confianza del certificado en otra tarea. No se exige compartir
> cookies entre hostnames distintos.

Referencias:
[Red del emulador de Android](https://developer.android.com/studio/run/emulator-networking) ·
[Conectar a servicios web locales (10.0.2.2) — Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/maui/data-cloud/local-web-services).

---

## Diagnóstico breve

Este runbook **no modifica ajustes de Windows automáticamente**. Las acciones siguientes
las ejecuta el usuario de forma consciente.

### Aceleración / virtualización

Sin aceleración por hardware el emulador funciona muy lento. En Windows las tecnologías
disponibles son **WHPX (Windows Hypervisor Platform)** y, como alternativa, el
**Android Emulator hypervisor driver (AEHD)**. Se recomienda WHPX; si no está
disponible, usar AEHD. HAXM de Intel quedó obsoleto en emulator 33.x y fue reemplazado
por AEHD.

Síntomas típicos y verificación:

- El emulador arranca muy lento o avisa que la aceleración de CPU no está disponible.
- Confirmar que la **virtualización está habilitada en la BIOS/UEFI** (Intel VT-x o
  AMD-V/SVM). En el Administrador de tareas de Windows → pestaña *Rendimiento* → *CPU*,
  el campo *Virtualización* debe decir *Habilitada*.
- Para habilitar WHPX: *Activar o desactivar las características de Windows* →
  **Plataforma de hipervisor de Windows**; reiniciar. (Requiere permisos de
  administrador; lo hace el usuario.)
- Si el emulador avisa que Hyper-V interfiere, seguir la guía oficial de aceleración
  antes de cambiar características del sistema.

Referencia oficial:
[Configurar la aceleración de hardware del emulador](https://developer.android.com/studio/run/emulator-acceleration) ·
[Aceleración por hardware (Hyper-V y AEHD) — Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/maui/android/emulator/hardware-acceleration).

### Problemas de conexión al servidor

- Verificar que el servidor esté **efectivamente escuchando** en la PC y en el puerto
  esperado (se confirma en T005).
- Usar `10.0.2.2`, **no** `localhost`, en el navegador del emulador.
- Si el servidor escucha sólo en `localhost`/`127.0.0.1`, `10.0.2.2` igualmente llega al
  loopback del host; si escucha sólo en una IP de LAN específica, ajustar el binding
  (detalle en T005).
- Un firewall de Windows puede bloquear el puerto. Permitir el puerto del servidor es
  decisión del usuario.
- Comprobar la conectividad del emulador con herramientas del SDK (opcional, requiere
  `adb` del SDK): `adb devices` lista el emulador cuando está corriendo.

---

## Límites del emulador

- El emulador valida el **recorrido funcional** (abrir el display, ver animación,
  recibir comandos), no el rendimiento real. No equivale a una tablet económica en FPS,
  consumo ni temperatura.
- El comportamiento de pantalla completa, kiosco y permanencia encendida se evalúa por
  separado sobre hardware/entorno final.
- La validación definitiva en Android (incluida la conexión real) se documenta y ejecuta
  en **T005**; este runbook no la declara completada.

---

## Referencias

- [Descargar Android Studio](https://developer.android.com/studio)
- [Instalar Android Studio](https://developer.android.com/studio/install)
- [Crear y administrar dispositivos virtuales](https://developer.android.com/studio/run/managing-avds)
- [Red del emulador de Android](https://developer.android.com/studio/run/emulator-networking)
- [Aceleración de hardware del emulador](https://developer.android.com/studio/run/emulator-acceleration)
- [Conectar a servicios web locales desde el emulador (Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/maui/data-cloud/local-web-services)
- [Aceleración por hardware en Windows: WHPX y AEHD (Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/maui/android/emulator/hardware-acceleration)

*Contenido reformulado a partir de la documentación citada para cumplir restricciones de
licencia.*
