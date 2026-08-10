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

**Probado en vivo contra el Supabase real** el mismo día, en cuanto Rodrigo proporcionó la `service_role` key:
- Bucket `estilizados` creado de verdad en el proyecto real (`pmexbywkqnpbtlqemzkw`), público.
- Generación I2I real con Wavespeed (`google/nano-banana-2-lite/edit`, a partir de `logo.jpeg`) → resultado real con `x-amz-expiration` de 7 días confirmado de nuevo en las cabeceras (el bug exacto que motiva este fix).
- `persistir_en_supabase()` descargó ese resultado real (1.7 MB) y lo subió al Supabase Storage real → verificado con `GET` sobre la URL pública: `200`, bytes idénticos byte a byte, `Content-Type: image/png` correcto.
- `do_save()` completo contra el **backend Django real** (apuntando a una copia aislada de la BD de QA, no a producción): creó el registro en Registro con la URL permanente de Supabase, verificada reproducible.
- Ruta de vídeo (`Content-Type: video/mp4`) verificada también contra el Supabase real.
- Una generación V2V *fresca* en esta sesión falló por timeout de **red local** subiendo el vídeo de origen al endpoint de `cl.upload()` del propio SDK de Wavespeed — no es código de este fix; la generación V2V con esta key ya se había probado real horas antes en la misma sesión (ver arriba), no es una incógnita nueva.
- Los objetos de prueba se borraron del bucket real al terminar.

### Por qué Supabase Storage y no S3

El proyecto ya usa Supabase como base de datos (`DATABASE_URL`, ref `pmexbywkqnpbtlqemzkw` — ver corrección de referencia obsoleta en `README.md`). Supabase incluye Storage (compatible S3 por dentro, pero con su propia API REST simple) en el mismo proyecto, sin coste ni proveedor adicional. No tiene sentido mantener AWS S3 como servicio aparte solo para esto.

## Estado de la key de Supabase Storage

**Resuelto en local.** Rodrigo proporcionó la `service_role` key el 2026-08-10; está puesta en `.env` (raíz) y `gradio-service/.env` locales (ambas gitignored, nunca se sube al repo) y probada en vivo contra el proyecto real (ver arriba). El bucket `estilizados` ya existe (público) en el proyecto real.

**Pendiente solo en producción**: poner las mismas tres variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=estilizados`) en el entorno de Cloud Run del servicio de Gradio — ver `03_DESPLIEGUE.md`. Esto lo tiene que hacer **Bruno**: es su infraestructura de Cloud Run, Rodrigo no tiene acceso ahí. Rodrigo le entrega los tres valores directamente (no por email/chat abierto). Sin esto en producción, **el guardado en Gradio queda bloqueado a propósito** en ese entorno — es preferible que nadie pueda guardar a que se sigan guardando URLs que van a caducar en 7 días.

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
