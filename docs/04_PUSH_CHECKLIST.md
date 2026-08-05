# 04 — Checklist final antes del push

Este checklist se completa inmediatamente antes de ejecutar `git push origin rodrigo/supabase-migration`. No sustituye a `03_DESPLIEGUE.md` (que es para después del merge) — este es exclusivamente el gate de publicación de la rama.

- [x] Los 13 commits aplican limpio, cada uno es funcional por sí mismo.
- [x] `git status` — working tree limpio, sin cambios sin comitear.
- [x] `git diff` — vacío.
- [x] `git log` — historial revisado, sin commits sorpresa ni mensajes incompletos.
- [x] `git fetch origin` — sin cambios nuevos en `origin/rodrigo/supabase-migration` durante la sesión (0 atrás).
- [x] `git merge-base` con `main` — sin divergencia, fast-forward limpio, sin riesgo de conflicto.
- [x] Sin archivos sin seguimiento fuera de lo ya ignorado (`.env`, bases de datos QA, etc.).
- [x] Los 11+ documentos de `docs/` existen y están comiteados.
- [x] El hallazgo de seguridad (`4b438b1`) está probado y documentado en `01_QA_REPORT.md`.
- [x] Los tres bloqueos externos (Wavespeed, Supabase, infraestructura) están documentados como pendientes de Bruno, no como trabajo sin terminar de esta rama.
- [ ] **Autorización explícita del usuario para publicar** — pendiente, ver `10_ENTREGA_A_BRUNO.md`.

## Tras el push

1. Verificar que GitHub recibió los 13 commits (`git log origin/rodrigo/supabase-migration --oneline` tras el `fetch`, o revisar directamente en la interfaz de GitHub).
2. Comparar el hash de `HEAD` local con el de `origin/rodrigo/supabase-migration` — deben coincidir exactamente.
3. Confirmar en GitHub que la rama remota no reporta conflictos con `main`.
4. Notificar a Bruno con el mensaje de entrega (generado al autorizar el push).
