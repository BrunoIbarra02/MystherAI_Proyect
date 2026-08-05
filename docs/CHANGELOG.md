# Changelog — rodrigo/supabase-migration

Todos los cambios de esta rama respecto a `main` (base `8f1dc8c`).

## [Sin publicar] — 2026-08-05

### Seguridad
- **fix**: se impide que un miembro del equipo edite o borre las entradas de Registro de otro miembro. Antes, cualquier usuario con sesión iniciada podía modificar o borrar el trabajo ya aprobado de cualquier otra persona vía la API (`4b438b1`).

### Añadido
- Auditoría de borrados y sobrescrituras de contenido en `VideoMetadata` — logging de diagnóstico para el bug de vídeos "desaparecidos" del Registro (`03417c5`).
- Pantalla de revisión de metadatos en Gradio antes de guardar un vídeo estilizado: Mapa y Especie ahora son obligatorios, con precarga de los datos existentes del censo (`d22fa4c`).
- Campo `reservado_por_user` (FK real a `User`) escribiéndose en paralelo al texto libre `reservado_por` en los flujos de reservar/liberar/asignar/denegar. Paso 1 de 2 de la migración del Issue 24 — ver `TECHNICAL_REPORT.md` (`5adb5f6`).
- Comando `import_legacy_users`, listo para ejecutar en cuanto exista el export real de la Supabase antigua (`936d857`).
- Aviso crítico en logs si `SECRET_KEY` no está configurada como variable de entorno en producción (`f0c399d`).

### Cambiado
- El catálogo, el registro y los resúmenes ya no son de lectura pública — ahora requieren sesión iniciada o ser el servicio interno de Gradio (Issue 21) (`008f9ea`).
- Las URLs de backend y de Gradio en el frontend apuntan a Cloud Run y `gradio.mystherai.com`, eliminando toda referencia al load balancer de AWS ya desmantelado (`c53c26d`).
- `SECURE_PROXY_SSL_HEADER` configurado para que Django detecte correctamente HTTPS detrás de un proxy (Cloud Run), evitando pérdidas de sesión intermitentes (`bcea197`).

### Corregido
- Desarrollo local por HTTP plano ya no falla con `403 CSRF` en cada petición autenticada (activable con `QA_LOCAL_HTTP=1`, sin afectar producción) (`78f3ff4`).
- Dos variables locales sin uso eliminadas (detectadas con `pyflakes`), preexistentes y ajenas al propósito de esta rama (`78f3ff4`).

### Documentación
- `docs/QA_REPORT.md`, `docs/TECHNICAL_REPORT.md`, `docs/DEPLOY_CHECKLIST.md`, `docs/TEAM_OPERATIONS.md`, `docs/SUPABASE_USER_MIGRATION.md`, `docs/PULL_REQUEST.md`, `docs/HANDOFF_TO_BRUNO.md`, `docs/HANDOFF_TO_RODRIGO.md`.

### Conocido / pendiente
- Generación real de imagen/vídeo en Gradio no verificable de extremo a extremo — API key de Wavespeed rechazada por su propio servidor (gestión de cuenta: Bruno).
- Migración de usuarios desde la Supabase antigua: procedimiento completo y probado, ejecución pendiente del export de Bruno.
- 3 validaciones de infraestructura (Cloud Run `SECRET_KEY`, proxy SSL real, despliegue Vercel) requieren acceso a producción.
- 14 vídeos reales del censo actualmente invisibles por un ID duplicado en el CSV fuente (dato, no código) — ver `QA_REPORT.md`.
