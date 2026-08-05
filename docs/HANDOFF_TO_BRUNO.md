# Entrega para Bruno — rodrigo/supabase-migration

Este documento debería bastarte para revisar la rama sin tener que preguntar nada más. Si algo no queda claro, es un fallo de este documento — dilo y se corrige.

## Qué se hizo

Se validaron funcionalmente los 8 commits que ya tenías en la rama, se encontró y corrigió una fuga de permisos real durante esa validación, se limpió deuda técnica menor, se cargaron y auditaron los datos reales del censo/registro sobre un entorno aislado, y se dejó completamente preparado (sin ejecutar) el procedimiento de migración de usuarios desde tu Supabase antiguo.

**No se ha hecho `push`.** Todo vive en local en `rodrigo/supabase-migration`, a la espera de tu autorización.

## Qué commits incluye

10 commits sobre `main` — ver el detalle completo en `docs/CHANGELOG.md`. Resumen:

- 8 tuyos: auditoría de borrados, cierre de lectura pública (Issue 21), pantalla de revisión en Gradio, FK `reservado_por_user` (Issue 24), limpieza de URLs de AWS, `SECURE_PROXY_SSL_HEADER`, aviso de `SECRET_KEY`, comando `import_legacy_users`.
- 2 nuevos de esta sesión: fix de desarrollo local (no afecta producción) + limpieza de código muerto; y **el fix de seguridad** (`4b438b1`) — ver siguiente sección, es el más importante de revisar.

## El hallazgo que debes revisar con más atención

Durante las pruebas de permisos (creando una cuenta de prueba nueva, no-staff, exactamente como un miembro real del equipo) se confirmó que **cualquier usuario logueado podía editar o borrar el trabajo ya aprobado de cualquier otro miembro**, vía una petición directa a la API — el frontend ya ocultaba los botones correctamente, pero el servidor nunca lo comprobaba. Se demostró en vivo contra un registro real de Wilson y se corrigió en el commit `4b438b1`. Detalle técnico completo en `docs/QA_REPORT.md` §4.

## Qué se probó (con evidencia real, no solo lectura de código)

- Login, catálogo, reservar/liberar vídeos, abrir Gradio con el `video_id` correcto, carga y análisis de un vídeo real de Google Drive, pantalla de metadatos con validación, guardado, aparición en Registro, aprobación como admin.
- Permisos: tu cuenta de admin (todo lo que debe poder, confirmado) y una cuenta de estilizador completamente nueva (todo lo que NO debe poder, confirmado — incluido el intento explícito de romper las restricciones que encontró el fallo de arriba).
- Integridad de datos: se cargaron los 406 vídeos reales del censo (desde `censo.csv`, ya en el repo) sobre una base aislada — ver el hallazgo de IDs duplicados abajo.

## Qué NO pudo probarse

- **Generación real de imagen/vídeo en Gradio** (Wavespeed). Investigado exhaustivamente — evidencia técnica completa en `docs/TECHNICAL_REPORT.md` §3. Resumen: la key actual es rechazada por el propio servidor de Wavespeed (`401 Invalid API key`), confirmado por dos vías independientes (curl directo y el SDK oficial). No es un problema de cómo el código usa la key. Necesita tu revisión en el dashboard de Wavespeed.
- **Infraestructura de producción real** (Cloud Run, Vercel) — sin acceso, no verificable desde aquí. Checklist exacta de qué comprobar en `docs/DEPLOY_CHECKLIST.md`.
- **Migración de usuarios** — no ejecutada porque no tienes acceso a la Supabase antigua ahora mismo. Procedimiento 100% listo en `docs/SUPABASE_USER_MIGRATION.md`.

## Qué queda pendiente

1. Tú: renovar/confirmar la Wavespeed key.
2. Tú: recuperar acceso a la Supabase antigua y generar el export de usuarios cuando puedas.
3. Tú: las 3 validaciones de infraestructura de `docs/DEPLOY_CHECKLIST.md`.
4. Alguien del equipo: corregir en la fuente (Sheets/CSV) el ID de censo duplicado que hace invisibles a 14 vídeos reales (`docs/QA_REPORT.md` §2 — baja urgencia, son de un ex-empleado, pero hay que arreglarlo antes de que le pase a un vídeo activo).
5. Deuda técnica no bloqueante listada en `docs/TECHNICAL_REPORT.md` §5.

## Cómo desplegar

1. Revisa y haz merge de esta rama a `main` (o el flujo que uses habitualmente).
2. Sigue `docs/DEPLOY_CHECKLIST.md` de arriba a abajo — variables de entorno, migración, validación post-despliegue.
3. La migración `0021` es aditiva (columna nullable) — segura de aplicar sin downtime.

## Cómo validar

Recorrido mínimo tras desplegar, con dos cuentas reales de miembros distintas:
1. Login de ambas.
2. Cada una reserva y estiliza un vídeo distinto.
3. **Confirmar específicamente que ninguna puede editar o borrar el trabajo de la otra** — es la prueba directa del fix de seguridad.
4. Tú apruebas uno y rechazas otro.
5. Confirmar que el catálogo, tras corregir el CSV, muestra los vídeos que antes colapsaban por el ID duplicado.

## Cómo hacer rollback

- Nada en esta rama es destructivo por sí mismo — todos los cambios son aditivos o cierran huecos de permisos.
- Si algo falla tras el despliegue: `git revert` del commit problemático (nunca fuerces un `reset --hard` sobre una rama ya publicada).
- La migración `0021` se revierte con `python manage.py migrate sheets 0020` sin pérdida de datos (la columna es nueva).

## Checklist antes del merge

- [ ] Leíste `docs/QA_REPORT.md` §4 (el fix de seguridad).
- [ ] Leíste `docs/TECHNICAL_REPORT.md` §3 (evidencia de Wavespeed).
- [ ] Tienes plan para renovar la Wavespeed key.
- [ ] Tienes plan para recuperar acceso a la Supabase antigua.
- [ ] Revisaste `docs/DEPLOY_CHECKLIST.md` y sabes qué falta validar en infraestructura.
- [ ] Decidiste qué hacer con los 4 archivos huérfanos de `gradio-service/` (uno de ellos parece ser tuyo — `flask_wrapper.py` menciona instrucciones para "el jefe").
- [ ] `git log --oneline -10` en tu máquina, tras el `pull`, coincide con lo descrito en `docs/CHANGELOG.md`.
