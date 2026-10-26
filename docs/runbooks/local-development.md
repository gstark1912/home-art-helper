# Runbook: desarrollo y primera demostración local

Esta guía arranca Home&Art Helper en esta PC y reproduce el recorrido
**panel → servidor → display**: cambiar la animación desde `/control` y verla
actualizarse de inmediato en `/display`, más apagado/encendido lógico. También
deja el display listo para abrirlo desde Android Emulator.

> **Alcance (T005).** Documenta instalación, clave local, arranque con puertos
> concretos y la verificación funcional en navegador. La validación real en
> Android (abrir el display desde el emulador) queda **pendiente de confirmación
> del usuario**; aquí se documenta cómo hacerla, no se declara ejecutada.

---

## Requisitos

- **.NET SDK 10.0.401** (fijado en `global.json`, `latestPatch`). Verificar con
  `dotnet --version`.
- **Node.js ≥ 20.19** (probado con v22.17.1) y npm.
- Windows con PowerShell (`pwsh`). Los comandos usan `;` como separador.

---

## Puertos acordados

| Pieza | Origen | URL |
|---|---|---|
| Servidor .NET (API + SignalR + SPA) | `http://localhost:5189` | `http://localhost:5189/` |
| Servidor de desarrollo Vite (con proxy) | `http://localhost:5173` | `http://localhost:5173/` |
| Display desde Android Emulator | servidor directo | `http://10.0.2.2:5189/display` |

El servidor escucha sólo en **loopback** en modo `DevelopmentHttp`. `10.0.2.2`
es la dirección con la que el emulador alcanza el loopback del host (ver
[runbook de Android](android-emulator.md)).

---

## Clave de emparejamiento (sin secretos en Git)

El servidor exige `Ambient:PairingKey` (1–256 caracteres) y **falla al arrancar**
si no está configurada. Nunca se versiona ni se escribe en archivos del repo.
Opciones para proveerla localmente:

- **Variable de entorno de la sesión** (recomendado para una demo rápida):

  ```powershell
  $env:Ambient__PairingKey = 'elige-una-clave-local'
  ```

- **User secrets de .NET** (fuera del árbol del repo), si se prefiere:

  ```powershell
  dotnet user-secrets init --project src/Ambient.Server
  dotnet user-secrets set "Ambient:PairingKey" "elige-una-clave-local" --project src/Ambient.Server
  ```

El panel pide esa misma clave en el login de `/control` y `/display`.

---

## Opción A — Demo integrada con un solo proceso (servidor sirve el frontend)

Es la forma más fiel a producción y la que usa el emulador: el servidor sirve el
frontend **compilado** desde `src/ambient-client/dist`.

1. **Compilar el frontend** (genera `dist/`):

   ```powershell
   cd src/ambient-client
   npm ci
   npm run build
   cd ../..
   ```

2. **Arrancar el servidor** con la configuración de desarrollo:

   ```powershell
   $env:ASPNETCORE_ENVIRONMENT = 'Development'
   $env:Ambient__Transport     = 'DevelopmentHttp'
   $env:Ambient__PairingKey     = 'elige-una-clave-local'
   $env:AllowedHosts            = 'localhost;127.0.0.1;10.0.2.2'
   dotnet run --project src/Ambient.Server --no-launch-profile --urls http://localhost:5189
   ```

   El script [`scripts/run-server.ps1`](../../scripts/run-server.ps1) encapsula
   esos pasos (pide la clave si no está en el entorno).

3. **Abrir dos ventanas** del navegador de la PC:
   - Panel: `http://localhost:5189/control`
   - Display: `http://localhost:5189/display`

   Autenticar ambas con la clave. Cambiar paleta/velocidad en el panel actualiza
   el display de inmediato; "Apagar" lo pone en negro y pausa el render;
   "Encender" lo restaura.

---

## Opción B — Desarrollo con Vite y proxy (recarga en caliente del frontend)

Para iterar el frontend sin recompilar. Vite sirve la SPA y **proxyea** `/api` y
`/hubs` al servidor .NET conservando el `Origin` del navegador.

1. Arrancar el servidor como en la Opción A, paso 2, pero indicándole el origen
   público del proxy para que la validación de `Origin`/CSRF acepte el navegador
   servido por Vite:

   ```powershell
   $env:ASPNETCORE_ENVIRONMENT = 'Development'
   $env:Ambient__Transport     = 'DevelopmentHttp'
   $env:Ambient__PairingKey     = 'elige-una-clave-local'
   $env:AllowedHosts            = 'localhost;127.0.0.1;10.0.2.2'
   $env:Ambient__PublicOrigin   = 'http://localhost:5173'
   dotnet run --project src/Ambient.Server --no-launch-profile --urls http://localhost:5189
   ```

2. En otra terminal, apuntar el proxy de Vite al servidor y arrancar el dev
   server:

   ```powershell
   cd src/ambient-client
   # copiar .env.example a .env.local y ajustar, o exportar la variable:
   $env:VITE_PROXY_TARGET = 'http://localhost:5189'
   npm run dev
   ```

3. Abrir el panel y el display en `http://localhost:5173/control` y
   `http://localhost:5173/display`.

> Sin `Ambient__PublicOrigin` el servidor espera el `Origin` de su propio host
> (`http://localhost:5189`) y rechazará (403 `origin_rejected`) las peticiones
> que lleguen con el `Origin` de Vite (`http://localhost:5173`). Por eso la
> Opción B lo requiere y la Opción A no.

---

## Verificación funcional (recorrido real)

Lista de comprobación de los criterios de la demo:

- [ ] Dos ventanas autenticadas; cambiar paleta/velocidad en `/control` modifica
      `/display` sin recargar.
- [ ] "Apagar" deja el display en negro y pausa el render; "Encender" lo
      restaura.
- [ ] Reiniciar el servidor (Ctrl+C y volver a `dotnet run`) permite reconectar
      y recibir el estado inicial vigente (nuevo `epoch`, `version` 0).
- [ ] Un comando sin autenticar o sin el header `X-CSRF-Token` se rechaza
      (401 / 403).

### Pruebas de integración reproducibles

Con el servidor corriendo en `http://localhost:5189`, desde la raíz del repo:

```powershell
$pkg = (Resolve-Path 'src/ambient-client/node_modules/@microsoft/signalr/dist/cjs/index.js').Path
$env:SIGNALR_PATH = ([System.Uri]$pkg).AbsoluteUri
node tests/integration/hub-smoke.mjs   http://localhost:5189 <clave>
node tests/integration/hub-unauth.mjs  http://localhost:5189
```

- `hub-smoke.mjs`: login, conexión al hub, `GetSnapshot`, y verifica que un
  cambio de animación y un apagado por HTTP llegan como `StateChanged` al
  display. Termina en `HUB-SMOKE-OK`.
- `hub-unauth.mjs`: el hub rechaza una conexión sin sesión (401 en la
  negociación). Termina en `OK hub rechaza conexión sin sesión`.

Builds y pruebas unitarias de ambos proyectos:

```powershell
dotnet build HomeArtHelper.slnx
dotnet test  HomeArtHelper.slnx          # 26/26
cd src/ambient-client; npm run build; npm test   # 42/42
```

> Si un checkout conserva salidas generadas con una configuración antigua del
> `.csproj`, ejecutar `dotnet clean HomeArtHelper.slnx` una vez antes de
> reconstruir (documentado en T003).

---

## Abrir el display desde Android Emulator

El emulador alcanza el servidor por `10.0.2.2` (ver
[runbook de Android](android-emulator.md)). Con el servidor de la **Opción A**
corriendo (que ya incluye `10.0.2.2` en `AllowedHosts`):

1. Arrancar el AVD de tablet y abrir Chrome en el emulador.
2. Navegar a:

   ```
   http://10.0.2.2:5189/display
   ```

3. Autenticar con la clave local. Controlar desde `/control` en la PC.

> **Pendiente de confirmación del usuario:** este runbook no declara la demo
> Android validada. Ejecutar el paso anterior y confirmar que el display
> responde a los comandos cierra ese criterio.

---

## Seguridad y notas

- La clave de emparejamiento **nunca** se guarda en Git ni en capturas. Usar
  variable de entorno o user secrets.
- `DevelopmentHttp` sólo acepta listeners y clientes **loopback**; para uso real
  en la LAN se requiere `LanHttps` y certificados (hito posterior, no MVP).
- Runtime ASP.NET: actualizar a 10.0.13+ antes de exponer en LAN
  (GHSA-334f-vvp4-7g6p). No bloquea la demo local en loopback.
