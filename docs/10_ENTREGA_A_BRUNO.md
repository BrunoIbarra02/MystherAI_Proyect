# 10 — Leer Bruno

## Estado de la rama

`rodrigo/supabase-migration`, publicada en `origin` (push hecho el 2026-08-10), working tree limpio, sin conflictos con `main`. Incluye además, sobre lo descrito abajo: una key de Wavespeed válida ya integrada y probada con generación real, y el guardado permanente de los estilizados migrado a **Supabase Storage** (mismo proyecto que ya usa `DATABASE_URL`) — ver `06_WAVESPEED.md` para el único paso que falta (una clave de Supabase) antes de que el equipo pueda guardar en producción.

## Qué se hizo

Se validaron funcionalmente los 8 commits que ya tenías en la rama (no solo lectura de código — pruebas reales de backend, frontend y Gradio), se encontró y corrigió una fuga de permisos real durante esa validación, se limpió deuda técnica menor, se cargaron y auditaron los 406 vídeos reales del censo sobre un entorno aislado, se organizó toda la documentación operativa del equipo, y se dejó completamente preparado (sin ejecutar) el procedimiento de migración de usuarios desde tu Supabase antiguo.

## Qué commits incluye

13 commits sobre `main`:

- **8 tuyos**: auditoría de borrados (`03417c5`), cierre de lectura pública Issue 21 (`008f9ea`), pantalla de revisión en Gradio (`d22fa4c`), FK `reservado_por_user` Issue 24 (`5adb5f6`), limpieza de URLs de AWS (`c53c26d`), `SECURE_PROXY_SSL_HEADER` (`bcea197`), aviso de `SECRET_KEY` (`f0c399d`), comando `import_legacy_users` (`936d857`).
- **5 nuevos de esta auditoría**: fix de desarrollo local + limpieza de código muerto (`78f3ff4`); **el fix de seguridad** (`4b438b1`, ver abajo, el más importante de revisar); y 3 commits de documentación completa en `docs/`.

## El hallazgo que debes revisar con más atención

Durante las pruebas de permisos (creando una cuenta de prueba **completamente nueva**, no-staff, exactamente como un miembro real del equipo, e intentando deliberadamente romper las restricciones) se confirmó que **cualquier usuario logueado podía editar o borrar el trabajo ya aprobado de cualquier otro miembro**, vía una petición directa a la API — el frontend ya ocultaba los botones correctamente, pero el servidor nunca lo comprobaba. Se demostró en vivo contra un registro real de Wilson y se corrigió en el commit `4b438b1`. Detalle técnico completo en `01_QA_REPORT.md` §4 y la matriz de permisos en `07_ROLES_Y_PERMISOS.md`.

## Qué se probó (con evidencia real)

- Login, sesión persistente, catálogo, reservar/liberar vídeos, abrir Gradio con `video_id` correcto, carga y análisis de un vídeo real de Google Drive, pantalla de metadatos con validación, guardado, edición/borrado propio, subida de avatar, aparición en Registro, aprobación y denegación como admin.
- Permisos: tu cuenta de admin (todo lo que debe poder, confirmado) y una cuenta de estilizador completamente nueva (todo lo que NO debe poder, confirmado exhaustivamente).
- Integridad de datos: se cargaron los 406 vídeos reales del censo (desde `censo.csv`, ya en el repo) sobre una base aislada — ver el hallazgo de IDs duplicados abajo.

## Qué NO pudo probarse

- **Subida real a Supabase Storage** — no existe todavía la clave `service_role` en este entorno. La lógica está probada exhaustivamente contra un servidor que replica el contrato HTTP exacto de la API de Supabase Storage (descarga, subida, creación de bucket, manejo de errores, sin dejar URLs temporales guardadas ni archivos huérfanos) — ver `06_WAVESPEED.md`.
- **Infraestructura de producción real** (Cloud Run, Vercel) — sin acceso, no verificable desde aquí. Checklist exacta en `03_DESPLIEGUE.md`.
- **Migración de usuarios** — no ejecutada porque no tienes acceso a la Supabase antigua ahora mismo. Procedimiento 100% listo en `05_MIGRACION_SUPABASE.md`.

## Qué queda pendiente

1. Rodrigo: poner `SUPABASE_SERVICE_ROLE_KEY` en local y en producción — es su propio proyecto Supabase, no depende de ti. Ver `06_WAVESPEED.md` para el paso a paso exacto. **Es el único bloqueo real para que el equipo pueda guardar estilizados hoy.**
2. Tú: recuperar acceso a la Supabase antigua y generar el export de usuarios cuando puedas (`05_MIGRACION_SUPABASE.md`).
3. Tú: las validaciones de infraestructura de `03_DESPLIEGUE.md` (Cloud Run, Vercel, variables de entorno de producción).
4. Alguien del equipo: corregir en la fuente (Sheets/CSV) el ID de censo duplicado que hace invisibles a 14 vídeos reales (`01_QA_REPORT.md` §2 — baja urgencia, son de un ex-empleado, pero hay que arreglarlo antes de que le pase a un vídeo activo).
5. Deuda técnica no bloqueante listada en `01_QA_REPORT.md` §6.

## Cómo revisar

1. Empieza por `00_RESUMEN_GENERAL.md` para el mapa completo de la documentación.
2. Lee `01_QA_REPORT.md` §4 (el fix de seguridad) — es lo más importante.
3. Lee `06_WAVESPEED.md` — para que tengas la evidencia a mano cuando revises tu dashboard.
4. Repasa `02_BACKLOG.md` para saber qué se espera de cada persona, incluido tú.

## Cómo desplegar

1. Revisa y haz merge de esta rama a `main`.
2. Sigue `03_DESPLIEGUE.md` de arriba a abajo.
3. La migración `0021` es aditiva (columna nullable) — segura de aplicar sin downtime.

## Cómo validar

Recorrido mínimo tras desplegar, con dos cuentas reales de miembros distintas — detalle en `03_DESPLIEGUE.md` §Validación post-despliegue. El punto que más te recomiendo verificar tú mismo: que ninguna de las dos cuentas puede editar o borrar el trabajo de la otra.

## Cómo hacer rollback

Nada en esta rama es destructivo por sí mismo. `git revert` del commit problemático si algo falla (nunca `reset --hard` sobre una rama ya publicada). La migración `0021` se revierte con `python manage.py migrate sheets 0020` sin pérdida de datos.

## Checklist antes del merge

Ver `04_PUSH_CHECKLIST.md` para la versión completa. Resumen: rama probada, fix de seguridad documentado y verificado, bloqueos externos identificados con evidencia (no hipótesis), documentación completa en `docs/`.
