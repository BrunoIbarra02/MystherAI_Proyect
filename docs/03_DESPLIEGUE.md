# 03 — Despliegue

Guía para llevar esta rama de "revisada y en `main`" a producción.

## Antes de desplegar

- [ ] Backup de la base de datos de producción.
- [ ] Confirmar que la migración `0021_videometadata_reservado_por_user` se aplicará (aditiva, columna nullable, sin `RunSQL` peligroso — segura de aplicar sin downtime).

## Variables de entorno — Cloud Run (backend)

- [ ] `SECRET_KEY` configurada con un valor real. Verificar en los logs de arranque que **no** aparece el aviso crítico añadido en `f0c399d`.
- [ ] `DATABASE_URL` apunta al Postgres/Supabase correcto de producción.
- [ ] `WAVESPEED_API_KEY` — confirmar que la key vigente (ver `06_WAVESPEED.md`) está puesta en el entorno de producción, no solo en el `.env` local.
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` en el servicio de Gradio — sin esto el guardado de estilizados queda bloqueado a propósito. Es el Supabase de Rodrigo (no el tuyo antiguo) — él te entrega los tres valores directamente, tú los pegas aquí porque el acceso a Cloud Run es tuyo. Ver `06_WAVESPEED.md`.
- [ ] Confirmar que `SECURE_PROXY_SSL_HEADER` (commit `bcea197`) mantiene la sesión estable con el proxy real de Cloud Run — login y navegación sin desconexión intermitente.

## Variables de entorno — Vercel (frontend)

- [ ] `BACKEND_URL` (usada por `frontend/api/[...proxy].js` y `frontend/vercel.json`) apunta al servicio de Cloud Run correcto.
- [ ] `VITE_GRADIO_URL` apunta al dominio real de Gradio vigente.
- [ ] Cargar la web en producción y confirmar en Network que `/api/*` llega a Cloud Run sin `404` ni error de CORS.
- [ ] Abrir "Herramienta" en producción y confirmar que carga el Gradio real.
- [ ] Consola del navegador en producción sin errores de mixed content ni CORS.

## Base de datos, tras el despliegue

- [ ] `python manage.py migrate` (o el paso equivalente del pipeline de despliegue).
- [ ] `python manage.py showmigrations sheets users` confirma todo aplicado.
- [ ] Corregir en la fuente (Sheets/CSV) el `ID DE VIDEO EQUIPO=192` duplicado — ver `01_QA_REPORT.md` §2.

## Wavespeed + Supabase Storage

- [ ] Confirmar que la key de Wavespeed vigente está en el entorno de producción.
- [ ] Poner `SUPABASE_SERVICE_ROLE_KEY` en el entorno de producción del servicio de Gradio (ver `06_WAVESPEED.md`).
- [ ] Probar una generación real (I2I y V2V) end-to-end en staging o producción antes de anunciar la herramienta al equipo — confirmar que la URL guardada en Registro es `https://pmexbywkqnpbtlqemzkw.supabase.co/storage/v1/object/public/...`, no un dominio de Wavespeed.
- [ ] Consolidar `gradio-service/.env` y el `.env` raíz en un único origen de verdad para las keys (Wavespeed y Supabase).

## Validación post-despliegue

Recorrido mínimo, con al menos dos cuentas reales de miembros distintas:

1. Login de un usuario real del equipo.
2. Reservar y liberar un vídeo del censo.
3. Abrir Gradio desde el botón real, confirmar `video_id` correcto en la URL.
4. Generar y guardar un vídeo real (una vez la key esté activa).
5. Confirmar que aparece en Registro y en el panel de aprobación.
6. Aprobar y denegar un registro de prueba como admin.
7. **Confirmar el fix de seguridad** (`4b438b1`): con las dos cuentas, confirmar que ninguna puede editar o borrar el trabajo de la otra desde la interfaz.
8. Subir un avatar.

## Rollback

- Ninguno de los commits de esta rama es destructivo por sí mismo — todos son aditivos o cierran huecos de seguridad/permiso.
- `git revert` del commit problemático si algo falla (nunca `reset --hard` sobre una rama ya publicada).
- La migración `0021` se revierte con `python manage.py migrate sheets 0020` sin pérdida de datos existentes (la columna es nueva).
