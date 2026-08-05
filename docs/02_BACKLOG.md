# 02 — Backlog por responsable

Fabio, Wilson, Katty y Olenka **no son desarrolladores** — son el equipo de estilizado. Sus tareas se limitan a validar su propio flujo de trabajo dentro de la plataforma y reportar errores funcionales que encuentren usándola con normalidad. Ninguna tarea técnica se les asigna aquí; eso queda para Rodrigo y Bruno.

## Fabio, Wilson, Katty, Olenka

| Tarea | Prioridad | Depende de |
|---|---|---|
| Iniciar sesión en el entorno donde se despliegue esta rama y confirmar que su cuenta funciona con normalidad | Alta | Despliegue de la rama |
| Reservar y liberar al menos un vídeo del censo, confirmar que aparece correctamente a su nombre | Alta | Login |
| Completar un estilizado real de principio a fin (una vez la key de Wavespeed esté activa) y confirmar que aparece en Registro | Alta | Wavespeed activo (Bruno) |
| Comprobar que sus reservas y trabajos históricos (previos a esta rama) siguen viéndose correctamente | Media | Despliegue |
| Intentar editar/ver algo que no les corresponda (con conocimiento de que es una prueba, no una travesura) y confirmar que el sistema lo bloquea correctamente, reportando si no fuera así | Media | Despliegue |
| Reportar cualquier error funcional encontrado (login, reservas, Gradio, guardado, registros) directamente a Rodrigo, con el ID del vídeo afectado | Continua | — |
| Dar feedback sobre si los campos obligatorios (Mapa/Especie) de la nueva pantalla de guardado interfieren con su flujo real de trabajo | Baja | Prueba de estilizado real |

## Rodrigo

| Tarea | Prioridad | Dependencia | Tiempo estimado | Riesgo |
|---|---|---|---|---|
| Coordinar con Bruno la renovación de la Wavespeed key y el acceso a Supabase | Alta | Bruno | — (no técnico) | Bajo |
| Ejecutar las pruebas de infraestructura diferidas (`03_DESPLIEGUE.md`) una vez desplegado | Alta | Despliegue de Bruno | ~1h | Bajo |
| Ejecutar la migración de usuarios cuando Bruno entregue el export (`05_MIGRACION_SUPABASE.md`) | Media | Export de Bruno | ~30 min | Bajo (idempotente, con dry-run) |
| Recorrido de regresión con el equipo real siguiendo `02_BACKLOG.md` de arriba, y consolidar el feedback | Alta | Despliegue | ~1 día calendario | Bajo |
| Reescribir `users/migrations/0002_add_avatar.py` de forma portable (no bloqueante) | Baja | — | ~1h | Medio (migración ya aplicada en prod, requiere cuidado) |
| Decidir sobre los archivos huérfanos de `gradio-service/` (`app_backup.py`, `gradio_app.py`, `flask_wrapper.py`, `temp_patch.txt`) | Baja | — | ~15 min (decisión) | Ninguno |

## Bruno

| Tarea | Prioridad | Bloquea |
|---|---|---|
| Renovar/confirmar la Wavespeed API key | Crítica | Toda generación real de imagen/vídeo, en cualquier entorno |
| Recuperar acceso a la Supabase antigua y entregar el export de usuarios en el formato de `05_MIGRACION_SUPABASE.md` | Alta | Migración de usuarios legacy |
| Validar `SECRET_KEY` en Cloud Run, `SECURE_PROXY_SSL_HEADER` con el proxy real, y el despliegue en Vercel | Alta | Confirmar que esta rama funciona igual en producción que en local |
| Revisar y hacer merge de esta rama | Alta | Publicación |
| Decidir sobre el ID de censo duplicado (`192`) en la fuente (Sheets/CSV) — 14 vídeos reales de un ex-empleado invisibles hoy | Baja | Solo esos 14 vídeos concretos |
