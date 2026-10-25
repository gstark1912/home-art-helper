# T003 — Servidor para la primera demostración

- Estado: done
- Responsable: Codex/01a1754b-0031-7662-a676-7032bf3d1838
- Revisor activo: ninguno
- Actualizado: 2026-10-25T20:24:00-03:00
- Dependencias: T001 done
- Bloqueo: ninguno
- Autoría previa: Codex/01a1754b-0031-7662-a676-7032bf3d1838 (implementación entregada en review)

## Objetivo

Servidor .NET 10 que autentique control y display y publique cambios de animación y apagado lógico a todos los displays conectados.

## Alcance y archivos reservados

`src/Ambient.Server/**`, `tests/Ambient.Server.Tests/**`, `HomeArtHelper.slnx` y `global.json`. Dueño único de paquetes .NET y solución. No editar frontend, README, configuración Git ni contrato; proponer correcciones de contrato al responsable de T001.

## Fuera de alcance

Música, expiración de mensajes y despliegue LAN definitivo. No exponer implementaciones ficticias que respondan éxito para funciones pendientes.

## Entradas y contratos

`docs/contracts/display-protocol.md` aprobado en T001; seguir nombres y límites exactos. Estado en memoria, única experiencia compartida y publicación ordenada.

## Criterios de aceptación

- [x] Solución .NET 10 compilable con pruebas backend. (corregido tras Revisión Kiro; ver nueva entrega)
- [x] Configuración de clave obligatoria; API y hub rechazan clientes sin sesión.
- [x] Login/logout y protección CSRF/origen conforme al contrato.
- [x] Estado inicial, actualización de parámetros y on/off con versión creciente y validación de entradas.
- [x] Conexión/reconexión obtiene estado vigente sin perder una actualización concurrente.
- [x] Servir frontend compilado cuando esté disponible, con rutas SPA y sin ocultar errores API detrás del fallback.
- [x] Pruebas de autenticación, CSRF, validación, versiones y sincronización. (26/26 con dist presente; ver nueva entrega)

## Verificación

`dotnet build HomeArtHelper.slnx` y `dotnet test HomeArtHelper.slnx`. Incluir resultados y configuración de arranque sin secretos en la entrega para T005.

## Entrega

Implementación preparada por Codex/01a1754b-0031-7662-a676-7032bf3d1838. Sin commit. Estado review: pendiente aceptación formal mediante el protocolo del repositorio.

Archivos creados: HomeArtHelper.slnx, global.json; src/Ambient.Server/{Ambient.Server.csproj,Program.cs,Api.cs,Commands.cs,Security.cs,DisplayState.cs,DisplayHub.cs}; tests/Ambient.Server.Tests/{Ambient.Server.Tests.csproj,HttpTests.cs,BoundaryTests.cs,ConfigurationTests.cs,HubTests.cs,SpaTests.cs,SessionExpiryTests.cs,FutureValidationTests.cs}. Sólo se editó esta tarea además del alcance backend. Los cambios de T004 son de Kiro y no se tocaron.

Comportamiento: cookie de sesión HttpOnly/Strict y ticket no deslizante de 12 horas; antiforgery ASP.NET real y renovación tras login; Origin propio, AllowedHosts explícito, rate limit de login con Retry-After; revocación/expiración en registro de sesiones y cierre de conexiones. Estado inmutable con epoch por arranque y versiones serializadas junto con publicación esperada y conexión inicial. Validación JSON estricta, duplicados/campos/rangos/Unicode, límite 16 KiB; errores públicos JSON. Música/mensajes válidos devuelven 501 sin mutación. Sirve /control, /display y / con frontend compilado cuando existe; mantiene 404/405 de API y copia dist a wwwroot al publicar si ya está compilado.

Verificación final ejecutada fuera del sandbox por limitaciones de IPC/red del entorno:
- dotnet build HomeArtHelper.slnx -m:1 -p:UseSharedCompilation=false --verbosity minimal: éxito, 0 advertencias y 0 errores.
- dotnet test HomeArtHelper.slnx -m:1 -p:UseSharedCompilation=false --verbosity minimal: 26 aprobadas, 0 fallos, 0 omitidas.
- HTTP real con WebApplicationFactory/TestServer: autenticación, cookies revocadas/expiradas, token CSRF real, rotación de identidad, origen, rate limit, configuración insegura, validación y comandos concurrentes.
- SignalR cliente real por LongPolling: evento inicial, 12 publicaciones consecutivas/concurrentes ordenadas, GetSnapshot, segunda conexión con estado vigente, cierre al logout y rechazo de cookie revocada.
- SPA con index.html temporal: rutas de display, 404/405 de API y hub desconocido. Fixture eliminado al terminar.
- Arranque Kestrel real en http://localhost:5189 con clave efímera sólo en entorno: session 200 anónima, csrf 200 y status protegido 401. Proceso detenido y entorno restaurado.
- Ciclos RED/GREEN observados: 14 pruebas iniciales contra servidor vacío; regresión fallback 405->404; DELETE de transporte sin Origin; Unicode inválido (500 antes, 400 después) y trackId con LF (501 antes, 400 después).

Incidencias del entorno: restore inicial falló por DNS de NuGet en sandbox; retry con red permitido completó. Un test inicial dentro del sandbox fue abortado porque vstest no conectó al testhost en 90 segundos; los runs posteriores fuera del sandbox pasan. No son fallos ocultos de la suite final.

Revisión técnica independiente por subagente Codex/review_t003: detectó P2 por escapes Unicode malformados y P3 por ancla regex de trackId. Ambos reproducidos en HTTP, corregidos y cubiertos; segunda revisión confirmó correcciones sin hallazgos bloqueantes adicionales. El revisor leyó código y realizó reproducciones puntuales; no ejecutó la suite. Esta revisión técnica no cambia automáticamente review a done: queda disponible para el siguiente agente/usuario conforme a task-selection.md.

Configuración para T005: proporcionar Ambient__PairingKey localmente (sin guardarla en Git), Ambient__Transport=DevelopmentHttp, ASPNETCORE_ENVIRONMENT=Development y AllowedHosts=localhost;127.0.0.1;10.0.2.2. Ejecutar dotnet run --project src/Ambient.Server --no-launch-profile --urls http://localhost:<PUERTO>. T005 decide puerto final. Desarrollo HTTP sólo acepta listeners y clientes loopback. Para proxy Vite, configurar Ambient__PublicOrigin con el origen público exacto (esquema, hostname y puerto) y conservar Origin. Sin frontend compilado se obtienen errores 404 en las rutas visuales; compilar frontend antes de publicar.

Decisiones: se mantiene el checkout compartido y las reservas de archivos; no se crearon worktrees. Cola con SemaphoreSlim para ordenar captura/mutación/publicación; sesiones en memoria se purgan por vencimiento. Login limitado globalmente a 10 intentos/minuto, sin cola. SignalR stateful reconnect deshabilitado; reconexión normal soportada por GetSnapshot. SDK fijado a 10.0.401 con latestPatch; paquetes de pruebas ASP.NET/SignalR fijados a 10.0.13.

Limitaciones/pendientes: runtime ASP.NET instalado 10.0.12, afectado por GHSA-334f-vvp4-7g6p; actualizar runtime a 10.0.13 o posterior antes de LAN. No se instala ni modifica software del usuario. Paquetes de pruebas actualizados sin advertencias NuGet. Referencia: https://github.com/advisories/GHSA-334f-vvp4-7g6p . No se validaron LAN/HTTPS/certificados, WebSocket real, navegador Vue integrado ni Android. T005 debe verificarlos según su alcance; no se declara la demo integrada realizada.

Continuación: revisar y aceptar T003; T004 está activa a cargo de Kiro y puede continuar independientemente. T005 permanece blocked hasta T003 y T004 done. No se encadena otra tarea en este turno.


## Plan de implementación T003

Se ejecuta en este checkout y dentro de los archivos reservados. Diseño y contrato aprobados son la especificación. Sin commits automáticos.

1. Crear solución net10.0 y pruebas HTTP reales con WebApplicationFactory: login/CSRF/origen, validación estricta y estado. Ejecutar pruebas antes de implementar.
2. Implementar Program.cs (pipeline/configuración/rutas), Security.cs (sesiones revocables, antiforgery y origen), DisplayState.cs (instantáneas inmutables y cola global), DisplayHub.cs (registro y sincronización), Commands.cs (JSON estricto y validación).
3. Probar SignalR real mediante transporte LongPolling de TestServer: captura inicial, cambios concurrentes, GetSnapshot y cierre al logout. Verificar límites HTTP, errores sin fallback, configuración fail-closed y servicio SPA.
4. Ejecutar build y suite completa; registrar evidencia y limitaciones. Entregar en review para revisión independiente.

Riesgos a verificar: token anónimo tras login, carrera logout/conexión, publicación ordenada, JSON desconocido/nulo, rutas API inexistentes y transporte DevelopmentHttp fuera de loopback.


## Revisión Kiro (2026-10-25) — RECHAZADA

Revisor: Kiro/9355c732-835d-44b0-8b28-89afa0699b2c (agente distinto del autor). Resultado: rechazo bloqueante. Estado devuelto a `ready` sin responsable activo para que la corrección se reserve mediante task-selection.md. Autoría previa de la implementación conservada arriba.

### Hallazgo bloqueante (P1): la suite backend falla 26/26

Ejecuté la verificación exacta del archivo en este checkout compartido con SDK 10.0.401 y runtime ASP.NET 10.0.12:

- `dotnet build HomeArtHelper.slnx -m:1 -p:UseSharedCompilation=false --verbosity minimal`: éxito, 0 advertencias, 0 errores.
- `dotnet test HomeArtHelper.slnx -m:1 -p:UseSharedCompilation=false --verbosity minimal`: **Failed! Failed: 26, Passed: 0** (todas fallan en el arranque del host, antes de la lógica de cada prueba).

Excepción idéntica en las 26: `System.IO.DirectoryNotFoundException : ...\src\Ambient.Server\wwwroot\`, lanzada por `StaticWebAssetsLoader.UseStaticWebAssets` → `PhysicalFileProvider` durante `WebApplicationFactory<Program>` → `WebApplication.CreateBuilder` (Program.cs:10).

Esto contradice la entrega del autor («26 aprobadas, 0 fallos»). La diferencia es de estado del repositorio, no de entorno: el autor verificó antes de que existiera `src/ambient-client/dist` (salida de T004). Ahora `src/ambient-client/dist/index.html` existe y eso cambia el comportamiento del build.

### Causa raíz

`src/Ambient.Server/Ambient.Server.csproj` incluye:

```xml
<Content Include="../ambient-client/dist/**/*" Link="wwwroot/%(RecursiveDir)%(Filename)%(Extension)" ... />
```

Al existir `../ambient-client/dist`, MSBuild genera `bin/Debug/net10.0/Ambient.Server.staticwebassets.runtime.json` con `ContentRoots[0]` = `src\Ambient.Server\wwwroot\` (ruta física que NO existe; los archivos sólo viven en `../ambient-client/dist`, enlazados lógicamente). `WebApplicationFactory` habilita static web assets en el bootstrap del host, construye un `PhysicalFileProvider` sobre ese `wwwroot` inexistente y lanza antes de configurar el pipeline. Por eso fallan todas por igual.

### Confirmación empírica de la causa

- `Test-Path src/Ambient.Server/wwwroot` → `False`; el manifiesto staticwebassets referencia esa carpeta.
- `dotnet test HomeArtHelper.slnx -p:StaticWebAssetsEnabled=false ...` → **Passed! Failed: 0, Passed: 26**. Al desactivar static web assets, la suite pasa completa.

Es decir: la lógica de las 26 pruebas sigue siendo correcta; el defecto es la configuración de empaquetado/arranque que rompe el host de pruebas (y potencialmente el arranque real) cuando existe la salida del frontend.

### Qué debe corregir el responsable de T003 (dentro de su alcance reservado)

El arreglo pertenece a `src/Ambient.Server/**` (y/o la configuración de `ServerFactory` en `tests/Ambient.Server.Tests/**`, también reservado por T003). Opciones a evaluar por el responsable, sin cambiar archivos de T004:

1. No enlazar `dist` a `wwwroot` vía `<Content Link="wwwroot/...">`; servir el frontend compilado desde un proveedor de archivos explícito (como ya hace Program.cs apuntando a `../ambient-client/dist` y copiando a wwwroot sólo en publish), evitando que el build genere un manifiesto staticwebassets con `wwwroot` físico inexistente. Revisar que `CopyToPublishDirectory` siga cumpliendo el criterio de servir frontend al publicar.
2. O crear/garantizar que `wwwroot` exista físicamente para que el manifiesto sea válido.
3. O desactivar static web assets en el proyecto servidor y/o en `ServerFactory` (p. ej. `IWebHostBuilder.UseStaticWebAssets(false)` o la propiedad MSBuild), si no se usan static web assets de ASP.NET.

Tras corregir, re-ejecutar `dotnet build` y `dotnet test HomeArtHelper.slnx` SIN flags extra (tal como pide la sección Verificación) y confirmar 26/26 con `../ambient-client/dist` presente. La corrección no debe ocultar errores de API tras el fallback SPA ni romper el criterio de servir frontend compilado.

### Alcance de la revisión

Lectura de código de todo `src/Ambient.Server/**`, contrato `docs/contracts/display-protocol.md` y las pruebas. No edité código de producto ni de pruebas. No revisé LAN/HTTPS/certificados, WebSocket real ni navegador integrado (fuera de alcance de T003). El resto de la implementación (autenticación, CSRF/origen, validación estricta, versión/epoch, cola serializada, SPA) se lee conforme al contrato, pero no puedo acreditarla en runtime porque la suite no ejecuta en el estado actual; la acreditación queda pendiente de que las pruebas vuelvan a pasar.

Nota de seguridad informada por el autor y vigente: runtime ASP.NET 10.0.12 afectado por GHSA-334f-vvp4-7g6p; actualizar a 10.0.13+ antes de exposición LAN. No bloqueante para esta corrección pero debe resolverse antes de LAN.



## Corrección de Revisión Kiro — 2026-10-25T20:21:27.8094112-03:00

Autor: Codex/01a1754b-0031-7662-a676-7032bf3d1838. T003 vuelve a review, pendiente nueva aceptación independiente. Sin commit. Se conserva íntegramente el rechazo histórico anterior.

Reproducción: dotnet test HomeArtHelper.slnx con dist presente falló 26/26 con DirectoryNotFoundException en StaticWebAssetsLoader antes de ejecutar las pruebas. El hallazgo de Kiro es válido: la verificación original se hizo sin dist y no cubrió el estado posterior del checkout.

Cambio de producto: sólo src/Ambient.Server/Ambient.Server.csproj. Se elimina Content Link=wwwroot y se incorpora PublishAmbientClient después de ComputeFilesToPublish, que agrega los archivos dist a ResolvedFileToPublish con RelativePath wwwroot/<ruta relativa>. El build normal no registra esos enlaces como StaticWebAssets. Program.cs conserva el proveedor explícito de dist en desarrollo y wwwroot en publicación. No se deshabilitan StaticWebAssets en pruebas, ni se cambian pruebas, frontend o configuración de T004.

Al migrar la configuración, un primer run seguía leyendo el manifiesto anterior copiado a tests/.../bin; dotnet clean HomeArtHelper.slnx eliminó esas salidas obsoletas. La primera implementación del target también produjo NETSDK1152 por metadatos relativos; se corrigió usando un ítem intermedio _AmbientClientFile. No se ocultaron estos fallos. La versión final de abajo fue verificada después de esas correcciones. Si otro checkout conserva outputs generados con la configuración vieja, ejecutar dotnet clean HomeArtHelper.slnx una vez antes de reconstruir.

Verificación final observada, con src/ambient-client/dist presente y sin StaticWebAssetsEnabled=false:
- dotnet build HomeArtHelper.slnx: éxito, 0 advertencias, 0 errores.
- dotnet test HomeArtHelper.slnx: 26 aprobadas, 0 fallidas, 0 omitidas. Se repitió tras publicar y comprobar ambos hosts; mismo resultado.
- dotnet publish src/Ambient.Server/Ambient.Server.csproj --no-restore -o tests/Ambient.Server.Tests/TestResults/publish-smoke: éxito.
- Nueve archivos de la publicación bajo wwwroot comparados mediante SHA256 con dist: todos idénticos, incluidas rutas assets/.
- Kestrel real con contenido compilado: desarrollo en localhost:5191 y publicación en localhost:5192; /display devuelve HTML 200, su JavaScript devuelve 200, /api/absent devuelve 404 y GET /api/display/screen/on devuelve 405. Ambos procesos detenidos al terminar. Clave efímera únicamente en entorno, nunca guardada ni registrada. Salida de publish en TestResults ignorado por Git.

Revisión técnica del cambio por Codex/review_t003: sin hallazgos bloqueantes; confirma coherencia entre target de publicación y proveedor explícito de desarrollo. Revisión por lectura; la evidencia de ejecución anterior es del autor. No equivale a aceptación formal ni cambia la tarea a done.

Limitaciones previas vigentes: runtime 10.0.12 pendiente actualización antes de LAN; no se acreditan HTTPS/LAN, WebSocket, demo Vue interactiva ni Android. T004 mantiene su responsable y archivos; puede continuar de forma independiente. T005 sigue esperando T003 y T004 done. Próximo paso: nueva revisión independiente de T003 con dist presente.

## Revisión Kiro (segunda, 2026-10-25) — APROBADA → done

Revisor: Kiro/9355c732-835d-44b0-8b28-89afa0699b2c (agente distinto del autor Codex). Resultado: aprobada. El hallazgo bloqueante P1 de la primera revisión quedó corregido.

### Verificación ejecutada y observada por el revisor

Con `src/ambient-client/dist/index.html` presente y usando los comandos EXACTOS de la sección Verificación (sin `StaticWebAssetsEnabled=false` ni otros flags):

- `dotnet clean HomeArtHelper.slnx`: éxito (limpia manifiestos staticwebassets obsoletos del estado anterior, según documentó el autor).
- `dotnet build HomeArtHelper.slnx`: éxito, **0 advertencias, 0 errores**.
- `dotnet test HomeArtHelper.slnx`: **Passed! Failed: 0, Passed: 26, Skipped: 0**. Ya no se reproduce el `DirectoryNotFoundException` de wwwroot; el host de pruebas arranca normalmente.
- `dotnet publish src/Ambient.Server/Ambient.Server.csproj -o <temp>`: éxito; la salida contiene `wwwroot/index.html` y `wwwroot/assets/**` (9 archivos del frontend compilado). Carpeta temporal eliminada al terminar. Confirma que el criterio "servir frontend compilado" se mantiene en publicación.

### Revisión del cambio

`src/Ambient.Server/Ambient.Server.csproj`: se eliminó `<Content Include="../ambient-client/dist/**" Link="wwwroot/...">` (origen del manifiesto staticwebassets que apuntaba a un wwwroot físico inexistente) y se añadió el target `PublishAmbientClient` (AfterTargets=ComputeFilesToPublish) que inyecta los archivos de dist en `ResolvedFileToPublish` bajo `wwwroot/`. El build normal ya no registra static web assets; `Program.cs` sigue sirviendo dist por proveedor explícito en desarrollo y wwwroot en publicación. No se tocaron pruebas, frontend ni configuración de T004. Solución correcta y acotada (corresponde a la opción 1 que propuse en el rechazo).

### Estado de los criterios de aceptación

Todos cumplidos. La lógica de autenticación, CSRF/origen, validación estricta, versión/epoch creciente, cola serializada y sincronización SignalR ya estaba conforme al contrato en la lectura de código; ahora además las 26 pruebas que la ejercitan **ejecutan y pasan** en el estado actual del checkout, por lo que queda acreditada en runtime de pruebas.

### Caveat no bloqueante

Runtime ASP.NET instalado 10.0.12, afectado por GHSA-334f-vvp4-7g6p. Está fuera del alcance del MVP de T003 y acotado a "antes de exposición LAN"; no bloquea la aceptación de T003 pero debe resolverse antes de LAN (responsabilidad de la tarea de despliegue LAN correspondiente). No se validaron HTTPS/LAN/certificados, WebSocket real, navegador Vue integrado ni Android; están fuera de alcance de T003 y los asume T005.

### Nota para desarrolladores

Si un checkout conserva salidas generadas con la configuración antigua del csproj, ejecutar `dotnet clean HomeArtHelper.slnx` una vez antes de reconstruir, tal como documentó el autor.

T003 pasa a `done`. T005 depende de T003 y T004; sólo puede rehabilitarse cuando T004 también esté `done`.
