# Deploy Checklist — rodrigo/supabase-migration

Checklist para llevar esta rama de "revisada localmente" a "en producción". Marcar cada punto al validarlo.

## Antes de hacer merge

- [ ] Revisar `docs/HANDOFF_TO_BRUNO.md` completo.
- [ ] Revisar `docs/QA_REPORT.md` — en particular el hallazgo de seguridad corregido en `4b438b1`.
- [ ] Confirmar que `git status` está limpio y `git log` no tiene sorpresas (ver `docs/HANDOFF_TO_BRUNO.md` §Git).
- [ ] Decidir sobre los 4 archivos huérfanos de `gradio-service/` (`app_backup.py`, `gradio_app.py`, `flask_wrapper.py`, `temp_patch.txt`) — no se tocaron por si tienen valor de referencia.

## Variables de entorno — Cloud Run (backend)

- [ ] `SECRET_KEY` configurada con un valor real (no la clave insegura del repo). Verificar en los logs de arranque que **no** aparece el aviso crítico añadido en `f0c399d`.
- [ ] `DATABASE_URL` apunta al Postgres/Supabase correcto de producción.
- [ ] `WAVESPEED_API_KEY` — **pendiente de Bruno**, ver bloqueo en `QA_REPORT.md`/`TECHNICAL_REPORT.md`.
- [ ] Confirmar que `SECURE_PROXY_SSL_HEADER` (commit `bcea197`) mantiene la sesión estable con el proxy real de Cloud Run — probar login y navegar varias páginas sin desconexión.

## Variables de entorno — Vercel (frontend)

- [ ] `BACKEND_URL` (usada por `frontend/api/[...proxy].js` y `frontend/vercel.json`) apunta al servicio de Cloud Run correcto.
- [ ] `VITE_GRADIO_URL` apunta a `https://gradio.mystherai.com` (o el dominio real vigente).
- [ ] Cargar la web en producción y confirmar en la pestaña Network que `/api/*` llega a Cloud Run sin `404` ni error de CORS.
- [ ] Abrir "Herramienta" en producción y confirmar que carga el Gradio real, no una URL muerta.
- [ ] Consola del navegador en producción sin errores de mixed content ni CORS.

## Base de datos

- [ ] **Backup de la base de producción antes de aplicar la migración `0021`.**
- [ ] `python manage.py migrate` sobre producción (o el pipeline de despliegue que la ejecute) — la migración es aditiva (columna `reservado_por_user` nullable), sin `RunSQL` peligroso.
- [ ] `python manage.py showmigrations sheets users` confirma todo aplicado, nada pendiente.
- [ ] Revisar y corregir en la fuente (Sheets/CSV) el `ID DE VIDEO EQUIPO=192` duplicado (14 vídeos reales invisibles) — ver `QA_REPORT.md` §2.

## Wavespeed

- [ ] Bruno renueva/confirma la `WAVESPEED_API_KEY` en el entorno de producción.
- [ ] Probar una generación real (I2I) end-to-end en staging o producción antes de anunciar la herramienta al equipo.
- [ ] Consolidar `gradio-service/.env` y el `.env` raíz en un único origen de verdad para la key (evita que una copia desactualizada tape la correcta, como ocurrió en local).

## Migración de usuarios (Supabase antiguo)

- [ ] Ver `docs/SUPABASE_USER_MIGRATION.md` — bloqueado hasta que Bruno recupere acceso y entregue el export.

## Validación post-despliegue

- [ ] Login de un usuario real del equipo.
- [ ] Reservar y liberar un vídeo del censo.
- [ ] Abrir Gradio desde el botón real, confirmar `video_id` correcto en la URL.
- [ ] Generar y guardar un vídeo real (una vez la key de Wavespeed esté activa).
- [ ] Confirmar que aparece en Registro y en el panel de aprobación.
- [ ] Aprobar y denegar un registro de prueba como admin.
- [ ] **Confirmar específicamente el fix de seguridad** (`4b438b1`): con dos cuentas de miembros distintas, confirmar que ninguna puede editar el trabajo de la otra desde la interfaz.

## Rollback

- [ ] Si algo falla tras el despliegue: `git revert` de los commits problemáticos (nunca `reset --hard` sobre una rama ya publicada) o volver a desplegar el commit anterior de producción.
- [ ] La migración `0021` es reversible (`python manage.py migrate sheets 0020` la deshace, la columna es nueva y nullable, sin pérdida de datos existentes).
- [ ] Ninguno de los 10 commits de esta rama es destructivo por sí mismo — todos son aditivos o cierran huecos de seguridad/permiso.
