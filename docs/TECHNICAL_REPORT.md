# Technical Report — rodrigo/supabase-migration

Fecha: 2026-08-05

## 1. Alcance de la rama

10 commits sobre `main` (8f1dc8c base):

| Commit | Resumen |
|---|---|
| `03417c5` | Señales de auditoría (`pre_delete`/`pre_save`) sobre `VideoMetadata` — diagnóstico de vídeos "desaparecidos" |
| `008f9ea` | Cierra lectura pública de catálogo/registro/resumen (Issue 21) |
| `d22fa4c` | Pantalla de revisión de metadatos en Gradio antes de guardar (Mapa/Especie obligatorios) |
| `5adb5f6` | `reservado_por_user` (FK real) en paralelo a `reservado_por` (texto), Issue 24 paso 1/2 |
| `c53c26d` | Elimina referencias al ALB de AWS muerto; usa Cloud Run / `gradio.mystherai.com` |
| `bcea197` | `SECURE_PROXY_SSL_HEADER` para detectar HTTPS detrás del proxy (Issue 14) |
| `f0c399d` | Aviso crítico en logs si falta `SECRET_KEY` en producción (Issue 21) |
| `936d857` | Comando `import_legacy_users`, listo para cuando exista el export real |
| `78f3ff4` | Fix de desarrollo local (CSRF/cookies) + limpieza de código muerto |
| `4b438b1` | Fix de fuga de permisos: propiedad obligatoria para editar/borrar Registro |

## 2. Cadena de conexión del sistema (Fase 6)

```
Frontend (React/Vite) → Backend (Django/DRF) → Base de datos (Postgres/Supabase)
                              ↓
                          Gradio (pipeline de estilizado)
                              ↓
                     Google Drive (descarga de vídeo origen)
                              ↓
                        Wavespeed (I2I / V2V)
                              ↓
                    Registro (VideoMetadata, tipo=registro)
                              ↓
                 Panel de administración (aprobar/denegar)
```

| Tramo | Estado verificado | Evidencia |
|---|---|---|
| Frontend → Backend | ✅ Funciona | Login, catálogo, reservas — peticiones de red reales, `200`/`401`/`403` correctos según el caso |
| Backend → Base de datos | ✅ Funciona (local SQLite) / ⚠️ sin verificar contra Supabase real | `manage.py migrate` limpio, 0 pendientes, integridad de datos comprobada (ver `QA_REPORT.md`) |
| Backend → Gradio (llamadas internas) | ✅ Funciona | `do_save`/`do_fetch_censo` confirmados con datos reales, sin sesión (excepción de servicio interno) |
| Gradio → Google Drive | ✅ Funciona | Descarga y análisis real de un vídeo de Google Drive (174 fotogramas extraídos correctamente) |
| Gradio → Wavespeed | 🔴 Bloqueado | Ver §3 — evidencia técnica completa de que el bloqueo es de la cuenta, no del código |
| Backend → Registro | ✅ Funciona | Guardado confirmado, aparece en `/registro` y en el panel de aprobación |
| Backend → Panel de administración | ✅ Funciona | `/admin/` de Django accesible solo para staff; aprobar/denegar/repartir confirmados |

### Partes que dependen únicamente de Bruno

- **Wavespeed**: renovación/verificación de la API key (§3).
- **Supabase (antiguo)**: acceso para generar el export de usuarios (`docs/SUPABASE_USER_MIGRATION.md`).
- **Infraestructura de producción** (Cloud Run, Vercel): variables de entorno reales, proxy SSL, despliegue — no verificable sin acceso a esos paneles (ver `DEPLOY_CHECKLIST.md`).

## 3. Investigación Wavespeed — evidencia técnica completa

Se agotaron todas las causas verificables sin acceso a la cuenta de Wavespeed antes de concluir el bloqueo externo, incluyendo una segunda ronda de verificación tras confirmar que la key funcionaba el día anterior:

1. **Cabecera de autenticación correcta**: `Authorization: Bearer <key>` — verificado contra el código fuente instalado de `wavespeed/api/client.py:69`, no adivinado ni asumido.
2. **URL base correcta**: `https://api.wavespeed.ai`, coincide exactamente con `wavespeed/config.py`.
3. **Sin caracteres ocultos en la key**: `od -c` sobre la línea del `.env` — limpia, sin `\r` ni espacios, 52 caracteres, prefijo `wsk_live_`.
4. **Sin variable de entorno de Windows en conflicto**: comprobado `[Environment]::GetEnvironmentVariable` en los ámbitos `User`, `Machine` y `Process` — ninguno define `WAVESPEED_API_KEY` por fuera del `.env`.
5. **Dos rutas de carga de la key en el repo**: `gradio-service/.env` (de junio, desactualizada) y el `.env` raíz. Se probaron **ambas** explícitamente contra la API real — ninguna es aceptada por Wavespeed.
6. **El rechazo se reprodujo por dos caminos de ejecución independientes**: un `curl` directo a `https://api.wavespeed.ai`, y la llamada real del SDK oficial dentro del pipeline de producción (`do_stylize` → `wavespeed.Client(api_key=key).upload()`) — ambos devuelven exactamente `401 {"code":401,"message":"Invalid API key. Verify the key on your dashboard's API Keys page, or contact support@wavespeed.ai."}` desde los servidores de Wavespeed.

**Conclusión**: el rechazo se origina en el servidor de Wavespeed, no en cómo el código construye, carga o transmite la key. Es coherente con una rotación/revocación posterior a la fecha en que se confirmó que funcionaba, o con una discrepancia entre el valor probado manualmente y el que hay actualmente en el `.env`. **Gestión de la key: exclusivamente Bruno**, vía su dashboard de cuenta en wavespeed.ai — no hay ninguna acción de código adicional posible desde este lado.

## 4. Arquitectura de permisos (estado tras esta rama)

| Endpoint / clase | Quién puede | Excepciones |
|---|---|---|
| `PuedeEscribirVideos` (catálogo, listar/crear) | Cualquier usuario autenticado | Servicio interno de Gradio (`REMOTE_ADDR` local) |
| `PuedeEscribirSuPropioRegistro` (`VideoDetailView`, editar/borrar) | Dueño del registro o staff | Lectura abierta a todos; servicio interno de Gradio |
| `EsAdmin` (aprobar, denegar, repartir censo) | Solo `is_staff` | Ninguna |
| `IsAuthenticated` puro (resúmenes, filtros) | Cualquier usuario autenticado | Ninguna — **sin** excepción de servicio interno |

**Nota de arquitectura para futuras pruebas de permisos**: en un entorno 100% local (backend, frontend y quien prueba en la misma máquina), toda petición que pase por el proxy de Vite llega a Django con `REMOTE_ADDR=127.0.0.1`, coincidiendo con la excepción de servicio interno. Cualquier permiso que dependa de esa excepción (`PuedeEscribirVideos` y derivados) **no se puede probar de forma fiable vía navegador local** — hay que usar `rest_framework.test.APIClient` con un `REMOTE_ADDR` externo simulado, o probar contra un despliegue real.

## 5. Deuda técnica identificada (no bloqueante para esta rama)

- `apps/users/migrations/0002_add_avatar.py` usa `information_schema.columns` (SQL específico de PostgreSQL) dentro de un `RunPython` — rompe `migrate` sobre SQLite. Preexistente, no de esta rama. Recomendado reescribir con `schema_editor` portable.
- `gradio-service/.env` mantiene una `WAVESPEED_API_KEY` propia y desactualizada que tapa silenciosamente la del `.env` raíz en ejecuciones locales — consolidar en un solo origen de verdad.
- `CORS_ALLOWED_ORIGIN_REGEXES`/`CSRF_TRUSTED_ORIGINS` en `settings.py` aún listan `*.amazonaws.com`/`*.awsapprunner.com`, vestigios de la infraestructura ya migrada por el commit `c53c26d`.
- `gradio-service/gradio_app.py` y `gradio-service/flask_wrapper.py` no están referenciados por ningún `Dockerfile` real (ambos usan `python app.py` directo) — candidatos a eliminar, pero `flask_wrapper.py` referencia instrucciones dirigidas a "el jefe" (probablemente Bruno), así que no se eliminaron sin confirmación.
- `docker-compose.yml` no pasa `BACKEND_URL` a `gradio-service` — levantar con Docker Compose tal cual no conecta los servicios entre sí.
- `GOOGLE_SHEETS_CREDENTIALS_PATH` y `GOOGLE_DRIVE_FOLDER_ID` en `.env.template` no se usan en ningún punto del código actual — la sincronización real usa exportación pública de XLSX y enlaces directos de Drive, sin API autenticada.
