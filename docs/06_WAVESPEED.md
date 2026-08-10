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

### Fix aplicado

`gradio-service/app.py`: nueva función `persistir_en_s3()`, llamada desde `do_save()` justo antes de guardar en Registro. Descarga el resultado de Wavespeed y lo vuelve a subir a un bucket de S3 propio, sustituyendo la URL temporal por la permanente antes de que llegue a la base de datos.

**Comportamiento de seguridad**: si el almacenamiento permanente no está configurado (o falla la subida), `do_save()` **bloquea el guardado con un error claro** en vez de guardar la URL temporal en silencio. Probado explícitamente:
- Sin credenciales configuradas → bloquea con `"Almacenamiento permanente no configurado (faltan AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET en el entorno)..."`, sin crear ningún registro ni dejar archivos temporales huérfanos.
- Credenciales presentes pero inválidas / bucket inexistente → bloquea con el error real de S3 (`InvalidAccessKeyId`, etc.), mismo comportamiento seguro.

**No se ha podido probar la subida real a S3** porque no existe ningún bucket ni credenciales AWS en este proyecto — ver siguiente sección.

### Qué se comprobó al buscar una integración S3 existente

Se investigó a fondo antes de escribir código nuevo:
- `boto3`/`botocore` están instalados, pero **solo como dependencia transitiva del propio SDK de `wavespeed`** (`pip show boto3` → `Required-by: wavespeed`), no de código propio del proyecto.
- Ningún archivo del backend ni de `gradio-service` usa `boto3`, `S3_BUCKET`, `AWS_ACCESS_KEY` en ningún punto.
- El único rastro de AWS en el repo es `.github/workflows/deploy.yml` — un workflow **obsoleto** de la infraestructura antigua de ECS Fargate (ya migrada a Cloud Run, ver commit `c53c26d`), que usa secretos de GitHub Actions a los que no tengo acceso y que además no tiene relación con almacenar vídeos.

**Conclusión: no existe ninguna integración S3 reutilizable en este proyecto.** Hay que crear un bucket nuevo.

## Qué necesita hacer Bruno para activar el guardado permanente

1. Crear un bucket de S3 nuevo (o indicar uno existente que se pueda usar) — recomendado: dedicado a esto, no compartido con otra cosa.
2. Configurar el bucket para lectura pública de los objetos (vía política de bucket, ya que los buckets nuevos de S3 tienen las ACLs por objeto deshabilitadas por defecto desde 2023) — los estilizados guardados en Registro necesitan ser accesibles por URL directa, igual que ahora con Wavespeed/Drive.
3. Crear un usuario o rol de IAM con permiso `s3:PutObject` **limitado a ese bucket** (idealmente al prefijo `estilizados/*`) — no hace falta acceso más amplio.
4. Proporcionar (o poner en el entorno de producción / `.env` local):
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_BUCKET` (nombre del bucket)
   - `AWS_DEFAULT_REGION` (región del bucket, ej. `eu-west-1`)
   - `AWS_S3_PUBLIC_BASE_URL` (opcional, solo si el bucket está detrás de un CDN/dominio propio)
5. Una vez configurado, probar un guardado real y confirmar en las cabeceras HTTP del resultado que ya no aparece `x-amz-expiration` con la regla de Wavespeed.

Mientras esto no esté configurado, **el guardado en Gradio queda bloqueado a propósito** — es preferible que nadie pueda guardar a que se sigan guardando URLs que van a caducar en 7 días.

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
