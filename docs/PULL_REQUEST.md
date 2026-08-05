# Pull Request — rodrigo/supabase-migration → main

*(Contenido listo para pegar directamente en la descripción del PR de GitHub.)*

## Resumen

Cierra el diagnóstico de vídeos "desaparecidos" del Registro, cierra la lectura pública del catálogo (Issue 21), añade la pantalla de revisión de metadatos en Gradio, empieza la migración de `reservado_por` a una FK real (Issue 24), y corrige las URLs muertas del ALB de AWS. Incluye además un fix de seguridad encontrado durante la QA de esta rama: cualquier miembro podía editar o borrar el trabajo ya aprobado de otro.

## Qué incluye

13 commits — detalle completo en [`docs/10_ENTREGA_A_BRUNO.md`](./10_ENTREGA_A_BRUNO.md).

## Cómo se probó

Validación funcional real (no solo revisión de código) sobre un entorno local aislado: backend, frontend y Gradio corriendo en local, base de datos SQLite separada cargada con los 406 vídeos reales del censo (`censo.csv`, ya en el repo). Se probaron los dos roles del sistema con cuentas reales — la de administrador y una cuenta de estilizador **completamente nueva**, creada específicamente para intentar romper las restricciones de permisos. Detalle completo en [`docs/01_QA_REPORT.md`](./01_QA_REPORT.md).

## Hallazgo de seguridad

Durante la prueba de permisos se confirmó y corrigió una fuga real: cualquier usuario autenticado podía modificar o borrar el registro ya aprobado de otro miembro vía la API, pese a que el frontend ya ocultaba los botones correctamente. Ver `docs/01_QA_REPORT.md` §4 y `docs/07_ROLES_Y_PERMISOS.md` para el detalle técnico y la matriz completa.

## Qué no se pudo probar

- Generación real de imagen/vídeo (Wavespeed) — key rechazada por su propio servidor, investigación exhaustiva en `docs/06_WAVESPEED.md`.
- 3 validaciones de infraestructura de producción (Cloud Run, Vercel) — requieren acceso que no está disponible desde este entorno, ver `docs/03_DESPLIEGUE.md`.
- Migración de usuarios de la Supabase antigua — Bruno no tiene acceso ahora mismo, procedimiento listo en `docs/05_MIGRACION_SUPABASE.md`.

## Checklist

- [x] Los 13 commits aplican limpio y son funcionales individualmente.
- [x] Sin regresiones detectadas en el recorrido completo del producto.
- [x] Datos reales del censo cargados y auditados — 2 hallazgos de calidad de datos documentados (no de código).
- [x] Fuga de permisos encontrada y corregida, con pruebas de los 4 escenarios relevantes.
- [x] Documentación operativa completa para el equipo de estilizado y para Rodrigo.
- [ ] Wavespeed API key — pendiente de Bruno.
- [ ] Export de usuarios de la Supabase antigua — pendiente de Bruno.
- [ ] Validaciones de infraestructura — pendientes de acceso a Cloud Run/Vercel.

## Documentación añadida

Ver `docs/00_RESUMEN_GENERAL.md` para el mapa completo de los 14 documentos en `docs/`.
