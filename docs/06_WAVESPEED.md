# 06 — Wavespeed

## Estado (actualizado 2026-08-10)

**La key funciona.** Se encontró una key nueva (`Api Wavespeed gradio.txt`, en el escritorio), se verificó directamente contra `api.wavespeed.ai` (`200 {"balance": 11.5}`) antes de integrarla, y se probó con una **generación real completa**: vídeo real descargado de Google Drive → análisis (208 fotogramas) → imagen estilizada real (Nano Banana Lite) → vídeo estilizado real (WAN 2.1 480p) → guardado → aprobado. Todo correcto.

Key integrada en `.env` (raíz) y `gradio-service/.env` — ambas copias coinciden ahora, resolviendo el problema de key duplicada/desactualizada que existía antes.

La investigación anterior (key rechazada, 401) queda como referencia histórica más abajo — no es aplicable a la key actual. Sigue siendo verdad que la gestión de la key (renovarla, rotarla) es responsabilidad de Bruno.

## Hallazgo crítico encontrado durante la QA con generación real: las URLs de Wavespeed caducan a los 7 días

Al inspeccionar las cabeceras HTTP reales de dos resultados generados en esta sesión:

```
x-amz-expiration: expiry-date="Tue, 18 Aug 2026 00:00:00 GMT", rule-id="expire-output-7days"
```

Wavespeed aloja sus resultados en un bucket S3 propio con una regla de ciclo de vida que los borra a los 7 días. La aplicación guardaba esa URL directamente en `imagen_link`/`drive_link` sin re-alojarla en ningún sitio permanente — confirmado en la base de datos con un guardado real (pk 604).

### Fix aplicado (v1, descartado — S3 propio)

Primera versión: `persistir_en_s3()`, un bucket de AWS S3 nuevo y separado. Se descartó **antes de pedir nada a Bruno** porque introducía un tercer proveedor de infraestructura (AWS) cuando el proyecto ya tiene un Supabase propio (el mismo que usa `DATABASE_URL`) con Storage incluido — innecesario y un punto de fallo/coste más a mantener.

### Fix aplicado (v2, actual — Supabase Storage)

`gradio-service/app.py`: función `persistir_en_supabase()`, llamada desde `do_save()` justo antes de guardar en Registro. Descarga el resultado de Wavespeed (imagen o vídeo) y lo sube al bucket de **Supabase Storage** del mismo proyecto que ya usa `DATABASE_URL`, vía la API REST de Storage (llamadas HTTP directas con `requests`, sin añadir el SDK `supabase-py` como dependencia nueva). Sustituye la URL temporal por la permanente antes de que llegue a la base de datos. El bucket se crea automáticamente (público, idempotente) en el primer guardado si todavía no existe.

**Comportamiento de seguridad**: si el almacenamiento permanente no está configurado (o falla la subida), `do_save()` **bloquea el guardado con un error claro** en vez de guardar la URL temporal en silencio. Probado explícitamente con un servidor HTTP local que simula la API de Supabase Storage (ver `scratchpad` de la sesión — no se puede repetir aquí porque no vive en el repo):
- Sin `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` configurados → bloquea con `"Almacenamiento permanente no configurado (faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno)..."`, sin crear ningún registro ni dejar archivos temporales huérfanos.
- La API de Storage responde error al subir (probado con 500 simulado) → bloquea con el error real, mismo comportamiento seguro, sin dejar archivos temporales huérfanos.
- Subida correcta (probado con servidor simulado) → cabeceras `Authorization`/`apikey`/`Content-Type`/`x-upsert` correctas, bytes íntegros, bucket creado una sola vez (idempotente en llamadas siguientes), URL pública con el formato esperado.

**No se ha podido probar contra el Supabase real** porque no existe todavía la clave `service_role` en este entorno — ver siguiente sección. La lógica de la función sí está verificada end-to-end contra un servidor que replica exactamente el contrato HTTP de la API de Supabase Storage.

### Por qué Supabase Storage y no S3

El proyecto ya usa Supabase como base de datos (`DATABASE_URL`, ref `pmexbywkqnpbtlqemzkw` — ver corrección de referencia obsoleta en `README.md`). Supabase incluye Storage (compatible S3 por dentro, pero con su propia API REST simple) en el mismo proyecto, sin coste ni proveedor adicional. No tiene sentido mantener AWS S3 como servicio aparte solo para esto.

## Qué necesita hacer Rodrigo para activar el guardado permanente

Es un proyecto Supabase propio (creado por Rodrigo para sustituir el de Bruno, que se congeló — ver contexto en `00_RESUMEN_GENERAL.md`), así que esto no depende de terceros:

1. Entrar a [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto con ref `pmexbywkqnpbtlqemzkw` → **Settings → API**.
2. Copiar la clave **`service_role`** (⚠️ no la `anon` — la `service_role` es la única con permiso de escritura en Storage desde el backend; nunca debe usarse en el frontend).
3. Ponerla como `SUPABASE_SERVICE_ROLE_KEY` en:
   - `.env` (raíz) y `gradio-service/.env` en local — ya están preparados con `SUPABASE_URL=https://pmexbywkqnpbtlqemzkw.supabase.co` y `SUPABASE_STORAGE_BUCKET=estilizados`, solo falta el valor de la key.
   - Las mismas tres variables en el entorno de producción de Cloud Run (servicio de Gradio).
4. No hace falta crear el bucket a mano — `persistir_en_supabase()` lo crea automáticamente (público) la primera vez que alguien guarda un estilizado, si `SUPABASE_STORAGE_BUCKET` (por defecto `estilizados`) todavía no existe.
5. Una vez puesta la key, probar un guardado real (I2I o V2V) y confirmar que la URL guardada en Registro empieza por `https://pmexbywkqnpbtlqemzkw.supabase.co/storage/v1/object/public/estilizados/...` en vez de un dominio de Wavespeed.

Mientras `SUPABASE_SERVICE_ROLE_KEY` no esté puesta, **el guardado en Gradio queda bloqueado a propósito** — es preferible que nadie pueda guardar a que se sigan guardando URLs que van a caducar en 7 días.

---

## Investigación histórica (key anterior, ya resuelta)

*(Se conserva como referencia. La key descrita aquí ya no es la que está en uso.)*

La key que había hasta el 2026-08-05 era rechazada por el propio servidor de Wavespeed (`401 Invalid API key`). Se descartaron, en orden, todas las causas verificables sin acceso a la cuenta:

1. Cabecera de autenticación correcta (`Authorization: Bearer <key>`, verificado contra `wavespeed/api/client.py:69`).
2. URL base correcta (`https://api.wavespeed.ai`, verificado contra `wavespeed/config.py`).
3. Key íntegra (`od -c` sin caracteres ocultos).
4. Sin variable de entorno de Windows en conflicto.
5. Ambas copias de la key en el repo probadas directamente contra la API — ninguna aceptada.
6. Confirmado por dos caminos de ejecución independientes (`curl` directo y el SDK oficial).

Conclusión de entonces: el rechazo venía del servidor de Wavespeed, no del código. Se resolvió reemplazando la key por una nueva y válida.
