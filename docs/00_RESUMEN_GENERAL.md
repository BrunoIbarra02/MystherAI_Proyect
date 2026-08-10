# 00 — Resumen general del proyecto

Rama: `rodrigo/supabase-migration` · Última actualización: 2026-08-10 · Estado: publicada en `origin`, lista para PR a `main`.

## Qué es esta rama

Cierra el diagnóstico de vídeos "desaparecidos" del Registro, cierra la lectura pública del catálogo (Issue 21), añade la pantalla de revisión de metadatos en Gradio, empieza la migración de `reservado_por` a una FK real (Issue 24), corrige las URLs muertas del ALB de AWS, y añade correcciones encontradas durante la QA de esta propia rama: un fix de desarrollo local, **un fix de seguridad real** (ver `01_QA_REPORT.md`), la key de Wavespeed renovada y probada, y el guardado permanente de los estilizados en **Supabase Storage**.

15 commits sobre `main` — detalle en `10_ENTREGA_A_BRUNO.md`.

## Qué funciona (probado con evidencia real, no solo lectura de código)

- Login, sesión persistente, recarga de sesión.
- Catálogo con los 406 vídeos reales del censo (cargados desde `censo.csv`, ya en el repo).
- Reservar, liberar vídeos.
- Abrir Gradio con el `video_id`/`usuario`/`video_url` correctos.
- Carga y análisis de un vídeo real de Google Drive (174 fotogramas).
- Pantalla de metadatos con validación (Mapa/Especie obligatorios).
- Guardado, aparición en Registro.
- Aprobación y denegación por un administrador real.
- Subida de avatar.
- Editar/borrar el propio trabajo — y **no poder** editar/borrar el ajeno (fix de esta rama).
- Todos los permisos de administrador (panel `/admin/`, aprobar, denegar, repartir censo, ver todo).
- Todas las restricciones de un estilizador nuevo (no puede aprobar, denegar, repartir, administrar, ni tocar trabajo ajeno).
- **Generación real de imagen y vídeo con Wavespeed** — probado de extremo a extremo el 2026-08-10 con una key válida (I2I y V2V reales, guardado, aparición en Registro, aprobación).

## Qué falta (bloqueos externos, fuera del alcance de esta rama)

1. **Almacenamiento permanente en Supabase Storage** — se encontró (con la generación real) que las URLs de Wavespeed caducan a los 7 días, y se corrigió el código para re-alojarlas en Supabase Storage (el mismo proyecto Supabase que ya usa `DATABASE_URL`, no AWS S3) antes de guardar. **Falta solo `SUPABASE_SERVICE_ROLE_KEY`** — es el proyecto Supabase propio de Rodrigo, así que no depende de Bruno; el bucket se crea solo la primera vez que se guarda. Ver `06_WAVESPEED.md` para el paso a paso exacto. Hasta que esa key esté puesta, el guardado en Gradio queda bloqueado a propósito (con un mensaje claro) en vez de guardar URLs que van a caducar.
2. **Migración de usuarios de la Supabase antigua** — Bruno no tiene acceso a esa instancia ahora mismo. Procedimiento completo y probado (con datos ficticios), no ejecutado. Ver `05_MIGRACION_SUPABASE.md`.
3. **Validaciones de infraestructura de producción** (Cloud Run `SECRET_KEY`, proxy SSL real, despliegue Vercel, variables de Supabase en el entorno de Cloud Run) — requieren acceso que no está disponible desde este entorno. Ver `03_DESPLIEGUE.md`.

## Qué no depende de esta rama

- El estado de la API key de Wavespeed no es un problema introducido por estos commits — es una cuestión de cuenta externa que existiría igual sin esta rama.
- Dos hallazgos de calidad de datos en el censo real (IDs duplicados, un enlace vacío) vienen de la fuente (Sheets/CSV), no del código de esta rama — ver `01_QA_REPORT.md`.
- La deuda técnica preexistente listada en `07_ROLES_Y_PERMISOS.md` y `01_QA_REPORT.md` (migración `0002_add_avatar` no portable, archivos huérfanos en `gradio-service/`, configuración CORS con vestigios de AWS) tampoco es de esta rama — se documenta porque se encontró durante la auditoría, no porque la haya causado.

## Mapa de la documentación

| Documento | Para quién | Contenido |
|---|---|---|
| `00_RESUMEN_GENERAL.md` | Todos | Este documento |
| `01_QA_REPORT.md` | Bruno, Rodrigo | Todas las pruebas ejecutadas, resultados, evidencias |
| `02_BACKLOG.md` | Rodrigo, equipo | Tareas por responsable |
| `03_DESPLIEGUE.md` | Bruno | Cómo desplegar y qué validar |
| `04_PUSH_CHECKLIST.md` | Quien publique la rama | Checklist final antes del push |
| `05_MIGRACION_SUPABASE.md` | Bruno | Procedimiento preparado, no ejecutado |
| `06_WAVESPEED.md` | Bruno | Estado de la key, evidencia, sin más investigación posible desde aquí |
| `07_ROLES_Y_PERMISOS.md` | Bruno, Rodrigo | Matriz completa de permisos del sistema |
| `08_MANUAL_ESTILIZADOR.md` / `TEAM_OPERATIONS.md` | Fabio, Wilson, Katty, Olenka | Cómo trabajar día a día |
| `09_MANUAL_ADMIN.md` / `TEAM_LEAD_GUIDE.md` | Rodrigo | Cómo gestionar al equipo |
| `10_ENTREGA_A_BRUNO.md` | Bruno | Entrega formal: commits, pruebas, pendientes, cómo revisar/desplegar/rollback |
| `PULL_REQUEST.md` | Quien abra el PR | Descripción lista para pegar en GitHub |
