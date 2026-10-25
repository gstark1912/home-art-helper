# Protocolo del display — v1

Contrato normativo para T003 y T004. Deriva del diseño aprobado del 2026-10-25. Las decisiones concretas de nombres, límites y valores de este documento son decisiones de T001, pendientes de revisión independiente. No implica que los endpoints estén implementados.

## Convenciones y fases

HTTP y SignalR usan JSON camelCase, UTF-8, números JSON finitos, booleanos y fechas UTC ISO 8601 con sufijo Z. Enumeraciones sensibles a mayúsculas, sin valores numéricos alternativos. Se rechazan campos desconocidos, tipos incorrectos, null no permitido y cuerpos ausentes o malformados con 400. No hay conversiones de cadenas a números. Todas las respuestas de sesión/estado/error y autenticación llevan Cache-Control: no-store. El cliente nunca interpreta texto como HTML.

Primera demo: autenticación, sesión, CSRF, status, hub, modo art, animación y encendido lógico. Hitos posteriores: modo music, comandos de música y mensajes. Los campos futuros existen desde la primera demo con los valores iniciales indicados. Un comando futuro válido responde 501 feature_not_available, sin mutar estado; no simular éxito. Autenticación y protección CSRF siguen aplicándose a estos comandos.

## Instantánea exacta

GET /api/display/status, el evento StateChanged y el resultado de GetSnapshot usan exactamente este objeto, sin envoltorio:

```json
{
  "epoch": "4d637ea1-bdca-4e08-8b56-43e8a35292c4",
  "version": 0,
  "serverTimeUtc": "2026-10-25T18:00:00.000Z",
  "screenOn": true,
  "baseMode": "art",
  "animation": {
    "style": "particles",
    "palette": "aurora",
    "speed": 1,
    "intensity": 0.5,
    "bpm": null
  },
  "music": null,
  "message": null
}
```

- epoch: UUID nuevo por arranque del servidor; identifica la secuencia y permite aceptar version 0 después de reiniciar. No es una credencial.
- version: entero seguro JavaScript entre 0 y 9007199254740991. Inicial 0. Nunca comparar versiones entre epochs diferentes. Si se agotara el rango, rechazar mutaciones con 503 version_exhausted hasta reiniciar.
- serverTimeUtc: reloj del servidor al capturar la respuesta; no aumenta version por leer. Se usa para estimar expiración local.
- screenOn: booleano, inicial true. Apagado tiene precedencia sobre todo contenido; no desconecta SignalR ni detiene expiraciones.
- baseMode: art | music, inicial art. music sólo está habilitado en hito posterior.
- animation: objeto obligatorio con todos los campos. style: sólo particles. palette: aurora | sunset | ocean. speed: número [0.1, 3]. intensity: número [0, 1]. bpm: null o entero [40, 240]. Iniciales según ejemplo. BPM es un parámetro visual opcional, sin análisis de audio.
- music: null inicial o el objeto completo definido abajo.
- message: null inicial o el objeto completo definido abajo.

Las mutaciones válidas y aceptadas incrementan version exactamente una vez, incluso si repiten el valor actual. Lecturas, conexión, errores y login/logout no la incrementan. La expiración de un mensaje incrementa una vez. El estado se pierde al reiniciar.

## Sesión y protección HTTP

Configuración del servidor: Ambient:PairingKey obligatoria y no vacía, mediante secretos de usuario o variable Ambient__PairingKey; nunca archivo versionado. Ausencia impide arrancar. Ambient:Transport es DevelopmentHttp o LanHttps, sin elección implícita por hostname. DevelopmentHttp sólo puede usarse en entorno Development y escucha loopback para PC/emulador. LanHttps exige HTTPS y cookies Secure. Claves y cuerpos de login no se registran. Comparar la clave sin filtrar información por errores distintos; limitar intentos con 429 y Retry-After en segundos.

Cookie de autenticación: Ambient.Session, HttpOnly, SameSite=Strict, Path=/, sin Domain, sin Expires/Max-Age (sesión del navegador), ticket de 12 horas sin renovación deslizante. Secure=false únicamente en DevelopmentHttp; true en LanHttps. Cookie auxiliar antiforgery Ambient.Antiforgery: HttpOnly, SameSite=Strict, Path=/, sin Domain, misma política Secure. Usar protección antiforgery de ASP.NET Core con header X-CSRF-Token; no basta verificar que el header exista. La sesión no distingue permisos entre control y display en este MVP.

Flujo en cada navegador/origen:

1. GET /api/auth/csrf, anónimo permitido: 200 `{"csrfToken":"<token opaco>"}` y cookie auxiliar. Mantener token sólo en memoria.
2. POST /api/auth/login con Content-Type: application/json, header X-CSRF-Token y `{"pairingKey":"<clave introducida localmente>"}`. Cadena de 1 a 256 caracteres, sin trim automático. 200 `{"authenticated":true}`, establece cookie de sesión nueva; 401 invalid_credentials si clave incorrecta, 400 si formato inválido. No devolver la clave.
3. Tras login, volver a GET /api/auth/csrf: el token anterior era anónimo y no se reutiliza. GET /api/auth/session devuelve 200 `{"authenticated":true}` o 200 `{"authenticated":false}` sin sesión válida. No renueva ticket.
4. POST /api/auth/logout, autenticado, con CSRF y cuerpo `{}`: 204 sin cuerpo; invalida sesión, borra ambas cookies con los mismos atributos y cierra sus conexiones hub. Descartar token local. Para volver a entrar, repetir desde paso 1.

Todos los POST requieren Origin exactamente igual al origen servido (esquema, host y puerto). Origin ausente, null o distinto: 403 origin_rejected. Host se valida con AllowedHosts explícito (localhost, 127.0.0.1 y 10.0.2.2 para desarrollo; nombres LAN explícitos en LAN); no confiar en forwarded headers de emisores arbitrarios. No habilitar CORS. Todos los POST requieren antiforgery válido, incluido login/logout. Falta/fallo: 403 csrf_invalid. Endpoints protegidos responden primero 401 si no hay sesión, después 403 por origen/CSRF, después validación del comando. Login comprueba origen/CSRF antes de credenciales. GET no muta estado.

El hub usa la cookie de sesión, nunca bearer tokens en URL. /hubs/display y sus subrutas de negociación/transporte requieren autenticación y control de Origin si está presente; rechazar orígenes ajenos también en WebSocket. Permitir ausencia de Origin sólo para GET de transportes que el navegador emite sin él; los POST de negociación y transporte exigen Origin propio y X-CSRF-Token. Configurar SignalR cliente con ese header, credenciales del mismo origen y token actualizado antes de conectar. No forzar WebSocket ni skipNegotiation. Cerrar conexiones al vencer/revocar sesión (CloseOnAuthenticationExpiration y registro de conexiones por sesión); operaciones hub verifican sesión vigente. Una cookie quitada del navegador por sí sola no revoca un socket ya abierto.

El cliente interpreta 401 como sesión vencida, detiene reintentos y muestra emparejamiento. Ante 403 csrf_invalid obtiene un token nuevo y permite reintentar explícitamente el comando; no repetir automáticamente POST con resultado de red incierto. No hay idempotency keys.

## Endpoints de estado y comandos

Todos exigen sesión. Todos los POST requieren JSON y CSRF/origen como arriba. Status devuelve 200 instantánea. Un POST exitoso devuelve 200 instantánea completa posterior a su propia mutación. POST no permite escribir epoch, version, serverTimeUtc ni objetos de estado completos arbitrarios.

| Ruta | Cuerpo exacto | Fase y comportamiento |
|---|---|---|
| GET /api/display/status | sin cuerpo | Primera demo; estado actual |
| POST /api/display/mode | `{"mode":"art"}` | Primera demo; art disponible; music futuro |
| POST /api/display/animation | `{"style":"particles","palette":"ocean","speed":1.4,"intensity":0.6,"bpm":null}` | Primera demo; reemplazo completo de animation, todos los campos obligatorios y límites anteriores |
| POST /api/display/screen/off | `{}` | Primera demo; screenOn=false |
| POST /api/display/screen/on | `{}` | Primera demo; screenOn=true |
| POST /api/display/music | objeto de música abajo | Hito posterior; actualiza music sin cambiar baseMode |
| POST /api/display/message | objeto de comando abajo | Hito posterior; política de prioridad |

No hay PATCH ni campos opcionales en los cuerpos descritos. Cambiar modo no modifica animation, music o message. Apagar/encender preserva la configuración. En primera demo, mode=music retorna 501; valor desconocido retorna 400. Un Content-Type no JSON devuelve 415 unsupported_media_type. Límite total de cuerpo: 16 KiB, exceso 413 payload_too_large. Rutas API inexistentes: 404; método incorrecto: 405, nunca HTML de fallback SPA.

## Errores

Errores HTTP de aplicación usan application/json con forma exacta `{"error":{"code":"invalid_request","message":"Descripción pública","fields":{}}}`. fields siempre es objeto de nombres de campo a arrays de cadenas, vacío si no corresponde. message y textos de fields son para mostrar, no son estables para lógica. No incluir datos sensibles, stack traces o valor de clave. Para restricciones HTTP ajenas a la aplicación (proxy caído, respuesta de transporte) el cliente tolera error sin JSON y muestra fallo de conexión.

| HTTP | code | Caso |
|---|---|---|
| 400 | invalid_request | Campo, JSON, enum, rango o longitud inválido |
| 401 | unauthenticated | API/hub sin sesión o sesión expirada |
| 401 | invalid_credentials | Login con clave incorrecta |
| 403 | csrf_invalid / origin_rejected | Protección fallida |
| 409 | message_priority_conflict / music_unavailable | Prioridad inferior o modo music sin contenido |
| 404 / 405 | not_found / method_not_allowed | Ruta / método no disponible |
| 413 / 415 | payload_too_large / unsupported_media_type | Cuerpo / tipo de contenido |
| 429 | rate_limited | Login limitado, Retry-After obligatorio |
| 501 | feature_not_available | Funcionalidad posterior aún no implementada |
| 503 | version_exhausted / service_unavailable | Mutación no aceptada; no emitir éxito |

## SignalR y orden

Ruta /hubs/display. Evento servidor → cliente StateChanged con un argumento instantánea. Único método cliente → servidor GetSnapshot sin argumentos, devuelve instantánea. No hay comandos de escritura en el hub. No definir nombres alternativos. Fallos de invocación se rechazan con HubException pública `unauthenticated` o `service_unavailable`; no enviar detalles internos.

El servidor serializa mutación, asignación de versión, captura y publicación en una misma cola global, incluida expiración de mensajes. No publicar con fire-and-forget. Una falla al entregar a un socket no revierte una mutación ya confirmada; status/GetSnapshot permiten recuperar. La conexión inicial registra el cliente y envía StateChanged con estado actual dentro de esa misma secuencia: ninguna actualización puede pasar entre registro y captura/publicación inicial. Evitar bloquear la cola esperando lógica del cliente. No emitir instantáneas mutables que puedan cambiar durante serialización.

Cliente: registrar handler antes de start(). En cada conexión exitosa y onreconnected invocar GetSnapshot además de aceptar StateChanged. Reintentar también el start inicial fallido, con esperas 0, 2, 5, 10 y luego 30 segundos, con una sola conexión/intento activo. Cancelar timers al desmontar/logout. onreconnecting conserva último contenido. onclose reanuda ciclo inicial salvo 401/logout. Mostrar diagnóstico en control, sin controles permanentes sobre display.

Cada conexión local tiene una generación creciente: ignorar callbacks/respuestas de generaciones anteriores, incluido GET pendiente. Al iniciar conexión/reconexión, bufferizar eventos hasta recibir GetSnapshot (o el primer StateChanged inicial); éste fija epoch de esa generación. Dentro del epoch aceptar sólo version mayor que la última aplicada; iguales se ignoran como duplicados. En un epoch nuevo confirmado por la conexión actual, reemplazar contenido aunque version sea menor, y descartar respuestas/eventos del epoch anterior. Si aparece otro epoch inesperado en el mismo transporte, resincronizar mediante una nueva conexión en vez de alternar estados. Una respuesta HTTP de comando sólo se aplica si su epoch coincide con la conexión vigente; si no coincide, forzar resincronización. Un GET de fallback se asocia a la generación que lo inició y no reemplaza una conexión posterior. Así una respuesta lenta o un reinicio no congela ni retrocede el display.

## Música y mensajes futuros

Objeto music y cuerpo POST /music exactos:

```json
{"trackId":"demo-01","title":"Luz de tarde","artist":"Artista local","artworkId":"cover-01","isPlaying":true}
```

trackId: cadena ASCII [A-Za-z0-9_-], 1–64 caracteres. title y artist: texto plano, 1–120 unidades UTF-16, no sólo espacios. artworkId: sólo cover-01 | cover-02; identifica recursos locales incluidos en el cliente, nunca URLs arbitrarias. isPlaying: booleano, animación del disco pausada si false o screenOn=false. No reproduce audio. mode=music requiere music no null o retorna 409 music_unavailable sin mutación. No hay comando para borrar music en v1. BPM pertenece a animation y no se infiere del título.

Cuerpo POST /message:

```json
{"text":"La cena está lista","priority":1,"durationSeconds":30}
```

text: texto plano, 1–500 unidades UTF-16, no sólo espacios; saltos de línea permitidos, rechazar controles excepto LF y TAB. priority: entero 0–2, número mayor tiene prioridad mayor. durationSeconds: entero 1–300. No aceptar id ni fechas del cliente.

Estado message no null:

```json
{"id":"abed0357-663c-4583-850b-e986c75e6ccd","text":"La cena está lista","priority":1,"createdAtUtc":"2026-10-25T18:00:00.000Z","expiresAtUtc":"2026-10-25T18:00:30.000Z"}
```

id UUID nuevo por mensaje aceptado; expiración = creación + duración. La cola serializada elimina primero cualquier mensaje ya vencido y publica su expiración antes de evaluar un comando siguiente. Sin mensaje vigente, aceptar; prioridad igual reemplaza, mayor interrumpe y descarta, menor retorna 409 message_priority_conflict. No hay cola ni restauración del mensaje interrumpido. Un timer del servidor expira aunque no haya clientes; comprobar id vigente para que un timer viejo no elimine el reemplazo. Cada expiración y cada comando aceptado son mutaciones separadas, con sus versiones.

Display: si screenOn=false mostrar negro y pausar Canvas/video/CSS; después tiene precedencia message vigente; después baseMode. Al vencer retorna a la última base, incluidos cambios hechos durante el mensaje. Estimar tiempo restante usando expiresAtUtc-serverTimeUtc y un reloj monotónico local desde recepción; descontar el tiempo transcurrido desde el inicio de la petición GetSnapshot como margen conservador si está disponible. Una instantánea duplicada no reinicia el vencimiento. Desconectado, el mensaje vence localmente; no mutar version del servidor. Al reconectar reemplazar la estimación con estado actual. No prometer precisión de reloj absoluta ante latencia de red.

## Orígenes de desarrollo y LAN

PC usa http://localhost:<puerto>, emulador http://10.0.2.2:<puerto>. Ambos emparejan por separado; cookies y tokens no se comparten entre hostnames. El emulador accede al loopback del host mediante su alias especial. Puerto concreto se acuerda en T005. En Vite el navegador sólo llama rutas relativas /api y /hubs; proxy incluye WebSockets y preserva el Origin del navegador. Backend valida contra el origen público Vite configurado explícitamente, no contra un wildcard; Host permitido según destino del proxy. En producción frontend y servidor comparten origen.

LAN: https://<nombre-local>:<puerto>, certificado con nombre correcto y cadena confiada por cada dispositivo; emparejar nuevamente en ese origen, cookies Secure. No habilitar DevelopmentHttp para exposición LAN ni desactivar verificaciones del certificado. Esta tarea no configura certificados ni publica el servicio.

## Ejemplo de primera demo

Tras emparejar y obtener CSRF, enviar POST /api/display/animation con el cuerpo completo del cuadro anterior y X-CSRF-Token. Desde estado inicial, respuesta y StateChanged tendrán version=1, palette=ocean y speed=1.4; epoch no cambia, resto del estado se conserva. POST /screen/off con `{}` produce version=2 y screenOn=false; POST /screen/on produce version=3 y screenOn=true con la misma animación. Los eventos pueden llegar antes que las respuestas HTTP: comparar version evita regresiones. Nunca registrar clave, cookies o token en ejemplos de ejecución.

## Matriz de revisión T001

- Servidor y frontend comparten un único objeto de instantánea, límites, enums y errores.
- Los seis comandos del diseño tienen ruta/cuerpo/fase; status y cuatro rutas auth están definidos.
- Login, renovación de CSRF, logout, vencimiento y reconexión están definidos por origen.
- Registro inicial serializado, GetSnapshot, versión, epoch y generación local cubren carreras y reinicios.
- Los campos futuros no obligan a implementar música/mensajes en la primera demo.
- Pendiente: revisión por otro agente o usuario y validación de implementación en T003/T004/T005; este documento no acredita pruebas de runtime.
